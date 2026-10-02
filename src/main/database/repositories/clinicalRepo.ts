import Database from 'better-sqlite3'
import { ToothRecord, ClinicalNote, Prescription, PrescriptionItem, MedicalAct } from '@shared/types'
import { SyncQueueRepository } from './syncQueueRepo'

export class ClinicalRepository {
  private syncQueue: SyncQueueRepository

  constructor(private db: Database.Database) {
    this.syncQueue = new SyncQueueRepository(db)
  }

  // Dental Chart (Schéma dentaire)
  getToothRecords(patientId: string): ToothRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM dental_chart_records
      WHERE patientId = ?
      ORDER BY toothNumber ASC
    `)
    return stmt.all(patientId) as ToothRecord[]
  }

  saveToothRecord(record: Omit<ToothRecord, 'id' | 'updatedAt'>): ToothRecord {
    const now = new Date().toISOString()
    const id = `tooth_${record.patientId}_${record.toothNumber}`
    const fullRecord: ToothRecord = {
      ...record,
      id,
      updatedAt: now,
      syncStatus: 'pending'
    }

    const recordRow = {
      id,
      patientId: record.patientId,
      toothNumber: record.toothNumber,
      condition: record.condition,
      surfaces: Array.isArray(record.surfaces) ? JSON.stringify(record.surfaces) : (record.surfaces ?? '[]'),
      notes: record.notes ?? null,
      updatedAt: now,
      syncStatus: 'pending' as const
    }

    const stmt = this.db.prepare(`
      INSERT INTO dental_chart_records (id, patientId, toothNumber, condition, surfaces, notes, updatedAt, syncStatus)
      VALUES (@id, @patientId, @toothNumber, @condition, @surfaces, @notes, @updatedAt, @syncStatus)
      ON CONFLICT(patientId, toothNumber) DO UPDATE SET
        condition = excluded.condition,
        surfaces = excluded.surfaces,
        notes = excluded.notes,
        updatedAt = excluded.updatedAt,
        syncStatus = 'pending'
    `)
    stmt.run(recordRow)

    this.syncQueue.enqueue('tooth_record', id, 'UPDATE', fullRecord)
    return fullRecord
  }

  // Clinical Notes
  getClinicalNotes(patientId: string): ClinicalNote[] {
    const stmt = this.db.prepare(`
      SELECT * FROM clinical_notes
      WHERE patientId = ?
      ORDER BY date DESC, createdAt DESC
    `)
    return stmt.all(patientId) as ClinicalNote[]
  }

  saveClinicalNote(note: Omit<ClinicalNote, 'id' | 'createdAt' | 'updatedAt'>): ClinicalNote {
    const now = new Date().toISOString()
    const id = `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const fullNote: ClinicalNote = {
      ...note,
      id,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending'
    }

    const noteRow = {
      id,
      patientId: note.patientId,
      practitioner: note.practitioner,
      date: note.date,
      title: note.title,
      category: note.category,
      content: note.content,
      attachments: note.attachments ? JSON.stringify(note.attachments) : null,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending' as const
    }

    const stmt = this.db.prepare(`
      INSERT INTO clinical_notes (id, patientId, practitioner, date, title, category, content, attachments, createdAt, updatedAt, syncStatus)
      VALUES (@id, @patientId, @practitioner, @date, @title, @category, @content, @attachments, @createdAt, @updatedAt, @syncStatus)
    `)
    stmt.run(noteRow)

    this.syncQueue.enqueue('clinical_note', id, 'INSERT', fullNote)
    return fullNote
  }

  // Prescriptions
  getPrescriptions(patientId: string): Prescription[] {
    const pStmt = this.db.prepare(`
      SELECT * FROM prescriptions
      WHERE patientId = ? AND deletedAt IS NULL
      ORDER BY date DESC, createdAt DESC
    `)
    const prescriptions = pStmt.all(patientId) as Prescription[]
    const itemStmt = this.db.prepare('SELECT * FROM prescription_items WHERE prescriptionId = ?')
    for (const pres of prescriptions) {
      pres.items = itemStmt.all(pres.id) as PrescriptionItem[]
    }
    return prescriptions
  }

  savePrescription(prescription: Omit<Prescription, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Prescription {
    const now = new Date().toISOString()
    const id = prescription.id || `pres_${Date.now()}`
    const isNew = !prescription.id

    const fullPres: Prescription = {
      ...prescription,
      id,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending'
    }

    const presRow = {
      id,
      patientId: prescription.patientId,
      patientName: prescription.patientName,
      dentistName: prescription.dentistName ?? null,
      date: prescription.date,
      notes: prescription.notes ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending' as const
    }

    const tx = this.db.transaction(() => {
      if (isNew) {
        this.db.prepare(`
          INSERT INTO prescriptions (id, patientId, patientName, dentistName, date, notes, createdAt, updatedAt, deletedAt, syncStatus)
          VALUES (@id, @patientId, @patientName, @dentistName, @date, @notes, @createdAt, @updatedAt, @deletedAt, @syncStatus)
        `).run(presRow)
      } else {
        this.db.prepare(`
          UPDATE prescriptions
          SET patientName = @patientName, dentistName = @dentistName, date = @date, notes = @notes, updatedAt = @updatedAt
          WHERE id = @id
        `).run(presRow)
        this.db.prepare('DELETE FROM prescription_items WHERE prescriptionId = ?').run(id)
      }

      const itemInsert = this.db.prepare(`
        INSERT INTO prescription_items (id, prescriptionId, medicineName, dosage, form, instructions)
        VALUES (?, ?, ?, ?, ?, ?)
      `)

      for (const item of prescription.items || []) {
        const itemId = item.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
        itemInsert.run(itemId, id, item.medicineName, item.dosage, item.form, item.instructions)
      }
    })

    tx()
    this.syncQueue.enqueue('prescription', id, isNew ? 'INSERT' : 'UPDATE', fullPres)
    return fullPres
  }

  deletePrescription(id: string): boolean {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM prescription_items WHERE prescriptionId = ?').run(id)
      const result = this.db.prepare('DELETE FROM prescriptions WHERE id = ?').run(id)
      return result.changes > 0
    })
    const deleted = tx()
    if (deleted) {
      this.syncQueue.enqueue('prescription', id, 'DELETE', { id })
    }
    return deleted
  }

  // Medical Acts (Catalogue d'actes dentaires - 8 Spécialités)
  getMedicalActs(category?: string, search?: string): MedicalAct[] {
    let query = 'SELECT * FROM medical_acts WHERE deletedAt IS NULL AND active = 1'
    const params: (string | number)[] = []

    if (category && category !== 'ALL') {
      query += ' AND category = ?'
      params.push(category)
    }

    if (search && search.trim()) {
      query += ' AND (name LIKE ? OR code LIKE ?)'
      const term = `%${search.trim()}%`
      params.push(term, term)
    }

    query += ' ORDER BY category ASC, defaultPrice ASC'
    return this.db.prepare(query).all(...params) as MedicalAct[]
  }

  saveMedicalAct(act: Omit<MedicalAct, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): MedicalAct {
    const now = new Date().toISOString()
    const id = act.id || `act_${Date.now()}`
    const isNew = !act.id

    if (isNew) {
      const fullAct: MedicalAct = {
        ...act,
        id,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      }
      const stmt = this.db.prepare(`
        INSERT INTO medical_acts (id, code, name, category, defaultPrice, durationMinutes, active, createdAt, updatedAt)
        VALUES (@id, @code, @name, @category, @defaultPrice, @durationMinutes, @active, @createdAt, @updatedAt)
      `)
      stmt.run({ ...fullAct, active: fullAct.active ? 1 : 0 })
      return fullAct
    } else {
      const stmt = this.db.prepare(`
        UPDATE medical_acts
        SET code = @code, name = @name, category = @category, defaultPrice = @defaultPrice,
            durationMinutes = @durationMinutes, active = @active, updatedAt = @updatedAt
        WHERE id = @id
      `)
      stmt.run({ ...act, active: act.active ? 1 : 0, updatedAt: now })
      return { ...act, updatedAt: now } as MedicalAct
    }
  }
}

