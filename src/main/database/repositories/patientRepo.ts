import Database from 'better-sqlite3'
import { Patient } from '@shared/types'
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

  getByPhone(phone: string, excludeId?: string): Patient | null {
    const cleaned = phone.trim().replace(/[\s\-_.]/g, '')
    const sql = excludeId
      ? `SELECT * FROM patients
         WHERE deletedAt IS NULL
           AND replace(replace(replace(replace(phone, ' ', ''), '-', ''), '_', ''), '.', '') = ?
           AND id != ?`
      : `SELECT * FROM patients
         WHERE deletedAt IS NULL
           AND replace(replace(replace(replace(phone, ' ', ''), '-', ''), '_', ''), '.', '') = ?`

    const stmt = this.db.prepare(sql)
    const row = excludeId ? stmt.get(cleaned, excludeId) : stmt.get(cleaned)
    return (row as Patient) || null
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
        throw new Error('Ce numéro de téléphone existe déjà pour un autre patient.')
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

  getCount(): number {
    const row = this.db.prepare('SELECT count(*) as count FROM patients WHERE deletedAt IS NULL').get() as { count: number }
    return row.count
  }
}
