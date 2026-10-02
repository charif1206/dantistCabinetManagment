import Database from 'better-sqlite3'
import { Patient, PatientRadio } from '@shared/types'
import { SyncQueueRepository } from './syncQueueRepo'

export class PatientRepository {
  private syncQueue: SyncQueueRepository

  constructor(private db: Database.Database) {
    this.syncQueue = new SyncQueueRepository(db)
  }

  private generatePatientNumber(): string {
    const year = new Date().getFullYear()
    const row = this.db.prepare('SELECT count(*) as count FROM patients').get() as { count: number }
    const nextSeq = (row?.count || 0) + 1
    return `DZ-${year}-${String(nextSeq).padStart(4, '0')}`
  }

  getAll(search?: string): Patient[] {
    if (search && search.trim().length > 0) {
      const q = `%${search.trim()}%`
      const stmt = this.db.prepare(`
        SELECT * FROM patients
        WHERE deletedAt IS NULL AND (
          firstName LIKE ? OR lastName LIKE ? OR phone LIKE ? OR cin LIKE ? OR patientNumber LIKE ? OR wilaya LIKE ?
        )
        ORDER BY lastName ASC, firstName ASC
      `)
      return stmt.all(q, q, q, q, q, q) as Patient[]
    }

    const stmt = this.db.prepare('SELECT * FROM patients WHERE deletedAt IS NULL ORDER BY lastName ASC, firstName ASC')
    return stmt.all() as Patient[]
  }

  getById(id: string): Patient | null {
    const stmt = this.db.prepare('SELECT * FROM patients WHERE id = ? AND deletedAt IS NULL')
    const row = stmt.get(id)
    return (row as Patient) || null
  }

  private cleanPhone(phone: string): string {
    let p = (phone || '').trim().replace(/[\s\-_.()\u00A0]/g, '')
    if (p.startsWith('+213')) {
      p = '0' + p.slice(4)
    } else if (p.startsWith('00213')) {
      p = '0' + p.slice(5)
    } else if (p.startsWith('213') && p.length === 12) {
      p = '0' + p.slice(3)
    }
    return p
  }

  getByPhone(phone: string, excludeId?: string): Patient | null {
    const cleaned = this.cleanPhone(phone)
    if (!cleaned) return null

    const sql = excludeId
      ? `SELECT * FROM patients
         WHERE deletedAt IS NULL
           AND replace(replace(replace(replace(replace(phone, ' ', ''), '-', ''), '_', ''), '.', ''), '(', '') = ?
           AND id != ?`
      : `SELECT * FROM patients
         WHERE deletedAt IS NULL
           AND replace(replace(replace(replace(replace(phone, ' ', ''), '-', ''), '_', ''), '.', ''), '(', '') = ?`

    const stmt = this.db.prepare(sql)
    const row = excludeId ? stmt.get(cleaned, excludeId) : stmt.get(cleaned)
    if (row) return row as Patient

    // Fallback search across all active patients
    const all = this.getAll()
    const found = all.find(
      (p) => (!excludeId || p.id !== excludeId) && this.cleanPhone(p.phone) === cleaned
    )
    return found || null
  }

  save(
    patientData: Omit<Patient, 'id' | 'patientNumber' | 'createdAt' | 'updatedAt' | 'syncStatus'> & {
      id?: string
      patientNumber?: string
    }
  ): Patient {
    const now = new Date().toISOString()
    const id = patientData.id || `pat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const isNew = !patientData.id || !this.getById(id)

    // Check for duplicate phone number
    if (patientData.phone) {
      const duplicate = this.getByPhone(patientData.phone, patientData.id)
      if (duplicate) {
        throw new Error(
          `Ce numéro de téléphone est déjà associé au patient ${duplicate.firstName} ${duplicate.lastName} (Dossier N° ${duplicate.patientNumber}).`
        )
      }
    }

    if (isNew) {
      const patientNumber = patientData.patientNumber || this.generatePatientNumber()
      const patient = {
        id,
        patientNumber,
        firstName: patientData.firstName,
        lastName: patientData.lastName,
        cin: patientData.cin ?? null,
        phone: patientData.phone,
        email: patientData.email ?? null,
        dateOfBirth: patientData.dateOfBirth ?? null,
        gender: patientData.gender ?? null,
        address: patientData.address ?? null,
        wilaya: patientData.wilaya ?? null,
        medicalAlerts: patientData.medicalAlerts ?? null,
        bloodGroup: patientData.bloodGroup ?? null,
        notes: patientData.notes ?? null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'pending' as const
      }

      const stmt = this.db.prepare(`
        INSERT INTO patients (id, patientNumber, firstName, lastName, cin, phone, email, dateOfBirth, gender, address, wilaya, medicalAlerts, bloodGroup, notes, createdAt, updatedAt, deletedAt, syncStatus)
        VALUES (@id, @patientNumber, @firstName, @lastName, @cin, @phone, @email, @dateOfBirth, @gender, @address, @wilaya, @medicalAlerts, @bloodGroup, @notes, @createdAt, @updatedAt, @deletedAt, @syncStatus)
      `)
      stmt.run(patient)

      this.syncQueue.enqueue('patient', id, 'INSERT', patient as Patient)
      return patient as Patient
    } else {
      const existing = this.getById(id)!
      const updatedPatient = {
        id,
        patientNumber: existing.patientNumber,
        firstName: patientData.firstName ?? existing.firstName,
        lastName: patientData.lastName ?? existing.lastName,
        cin: patientData.cin !== undefined ? (patientData.cin ?? null) : (existing.cin ?? null),
        phone: patientData.phone ?? existing.phone,
        email: patientData.email !== undefined ? (patientData.email ?? null) : (existing.email ?? null),
        dateOfBirth: patientData.dateOfBirth !== undefined ? (patientData.dateOfBirth ?? null) : (existing.dateOfBirth ?? null),
        gender: patientData.gender !== undefined ? (patientData.gender ?? null) : (existing.gender ?? null),
        address: patientData.address !== undefined ? (patientData.address ?? null) : (existing.address ?? null),
        wilaya: patientData.wilaya !== undefined ? (patientData.wilaya ?? null) : (existing.wilaya ?? null),
        medicalAlerts: patientData.medicalAlerts !== undefined ? (patientData.medicalAlerts ?? null) : (existing.medicalAlerts ?? null),
        bloodGroup: patientData.bloodGroup !== undefined ? (patientData.bloodGroup ?? null) : (existing.bloodGroup ?? null),
        notes: patientData.notes !== undefined ? (patientData.notes ?? null) : (existing.notes ?? null),
        updatedAt: now,
        deletedAt: existing.deletedAt ?? null,
        syncStatus: 'pending' as const
      }

      const stmt = this.db.prepare(`
        UPDATE patients
        SET firstName = @firstName, lastName = @lastName, cin = @cin, phone = @phone, email = @email,
            dateOfBirth = @dateOfBirth, gender = @gender, address = @address, wilaya = @wilaya,
            medicalAlerts = @medicalAlerts, bloodGroup = @bloodGroup, notes = @notes,
            updatedAt = @updatedAt, syncStatus = @syncStatus
        WHERE id = @id
      `)
      stmt.run(updatedPatient)

      this.syncQueue.enqueue('patient', id, 'UPDATE', updatedPatient as Patient)
      return updatedPatient as Patient
    }
  }

  // Soft delete as required by Master Context rules
  delete(id: string): boolean {
    const existing = this.getById(id)
    if (!existing) return false

    const now = new Date().toISOString()
    const stmt = this.db.prepare('UPDATE patients SET deletedAt = ?, syncStatus = "pending" WHERE id = ?')
    stmt.run(now, id)

    this.syncQueue.enqueue('patient', id, 'DELETE', { id, deletedAt: now })
    return true
  }

  // Hard delete (permanent removal of patient and associated records)
  permanentDelete(id: string): boolean {
    const existing = this.db.prepare('SELECT id FROM patients WHERE id = ?').get(id)
    if (!existing) return false

    const tx = this.db.transaction(() => {
      try { this.db.prepare('DELETE FROM waiting_room WHERE patientId = ?').run(id) } catch {}
      try { this.db.prepare('DELETE FROM tooth_records WHERE patientId = ?').run(id) } catch {}
      try { this.db.prepare('DELETE FROM medical_antecedents WHERE patientId = ?').run(id) } catch {}
      try { this.db.prepare('DELETE FROM clinical_notes WHERE patientId = ?').run(id) } catch {}
      try { this.db.prepare('DELETE FROM prescriptions WHERE patientId = ?').run(id) } catch {}
      try { this.db.prepare('DELETE FROM prothesis_orders WHERE patientId = ?').run(id) } catch {}
      try { this.db.prepare('DELETE FROM lab_tests WHERE patientId = ?').run(id) } catch {}
      try { this.db.prepare('DELETE FROM devis WHERE patientId = ?').run(id) } catch {}
      try { this.db.prepare('DELETE FROM patient_radios WHERE patientId = ?').run(id) } catch {}
      try {
        this.db.prepare('DELETE FROM payments WHERE invoiceId IN (SELECT id FROM invoices WHERE patientId = ?)').run(id)
        this.db.prepare('DELETE FROM invoice_items WHERE invoiceId IN (SELECT id FROM invoices WHERE patientId = ?)').run(id)
        this.db.prepare('DELETE FROM invoices WHERE patientId = ?').run(id)
      } catch {}
      try { this.db.prepare('DELETE FROM appointments WHERE patientId = ?').run(id) } catch {}
      this.db.prepare('DELETE FROM patients WHERE id = ?').run(id)
      this.syncQueue.enqueue('patient', id, 'DELETE', { id, permanent: true })
    })

    tx()
    return true
  }

  getCount(): number {
    const row = this.db.prepare('SELECT count(*) as count FROM patients WHERE deletedAt IS NULL').get() as { count: number }
    return row.count
  }

  // Radiographies & Imaging (Prompt 8)
  getRadios(patientId: string): PatientRadio[] {
    const stmt = this.db.prepare(`
      SELECT * FROM patient_radios
      WHERE patientId = ? AND deletedAt IS NULL
      ORDER BY date DESC, createdAt DESC
    `)
    return stmt.all(patientId) as PatientRadio[]
  }

  saveRadio(
    radioData: Omit<PatientRadio, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): PatientRadio {
    const now = new Date().toISOString()
    const id = radioData.id || `rad_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const isNew = !radioData.id || !this.db.prepare('SELECT id FROM patient_radios WHERE id = ?').get(id)

    if (isNew) {
      const radio: PatientRadio = {
        id,
        patientId: radioData.patientId,
        radioType: radioData.radioType,
        toothNumber: radioData.toothNumber ?? null,
        date: radioData.date || now.split('T')[0],
        imageData: radioData.imageData,
        fileName: radioData.fileName ?? null,
        fileSize: radioData.fileSize ?? null,
        notes: radioData.notes ?? null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      }

      const stmt = this.db.prepare(`
        INSERT INTO patient_radios (id, patientId, radioType, toothNumber, date, imageData, fileName, fileSize, notes, createdAt, updatedAt, deletedAt)
        VALUES (@id, @patientId, @radioType, @toothNumber, @date, @imageData, @fileName, @fileSize, @notes, @createdAt, @updatedAt, @deletedAt)
      `)
      stmt.run(radio)
      return radio
    } else {
      const stmt = this.db.prepare(`
        UPDATE patient_radios
        SET radioType = @radioType, toothNumber = @toothNumber, date = @date,
            imageData = @imageData, fileName = @fileName, fileSize = @fileSize,
            notes = @notes, updatedAt = @updatedAt
        WHERE id = @id
      `)
      stmt.run({
        id,
        radioType: radioData.radioType,
        toothNumber: radioData.toothNumber ?? null,
        date: radioData.date || now.split('T')[0],
        imageData: radioData.imageData,
        fileName: radioData.fileName ?? null,
        fileSize: radioData.fileSize ?? null,
        notes: radioData.notes ?? null,
        updatedAt: now
      })
      const stmtGet = this.db.prepare('SELECT * FROM patient_radios WHERE id = ?')
      return stmtGet.get(id) as PatientRadio
    }
  }

  deleteRadio(id: string): boolean {
    const now = new Date().toISOString()
    const stmt = this.db.prepare('UPDATE patient_radios SET deletedAt = ?, updatedAt = ? WHERE id = ?')
    const res = stmt.run(now, now, id)
    return res.changes > 0
  }
}
