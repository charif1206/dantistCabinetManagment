import Database from 'better-sqlite3'
import { Appointment } from '@shared/types'
import { SyncQueueRepository } from './syncQueueRepo'

export class AppointmentRepository {
  private syncQueue: SyncQueueRepository

  constructor(private db: Database.Database) {
    this.syncQueue = new SyncQueueRepository(db)
  }

  getAll(startDate?: string, endDate?: string): Appointment[] {
    if (startDate && endDate) {
      const stmt = this.db.prepare(`
        SELECT * FROM appointments
        WHERE deletedAt IS NULL AND dateTime >= ? AND dateTime <= ?
        ORDER BY dateTime ASC
      `)
      return stmt.all(startDate, endDate) as Appointment[]
    }

    const stmt = this.db.prepare('SELECT * FROM appointments WHERE deletedAt IS NULL ORDER BY dateTime ASC')
    return stmt.all() as Appointment[]
  }

  getTodayAppointments(): Appointment[] {
    const today = new Date().toISOString().split('T')[0]
    const stmt = this.db.prepare(`
      SELECT * FROM appointments
      WHERE deletedAt IS NULL AND dateTime LIKE ?
      ORDER BY dateTime ASC
    `)
    return stmt.all(`${today}%`) as Appointment[]
  }

  getById(id: string): Appointment | null {
    const stmt = this.db.prepare('SELECT * FROM appointments WHERE id = ? AND deletedAt IS NULL')
    const row = stmt.get(id)
    return (row as Appointment) || null
  }

  save(data: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'> & { id?: string }): Appointment {
    const now = new Date().toISOString()
    const id = data.id || `apt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const isNew = !data.id || !this.getById(id)

    if (isNew) {
      const apt = {
        id,
        patientId: data.patientId,
        patientName: data.patientName,
        patientPhone: data.patientPhone ?? null,
        dateTime: data.dateTime,
        durationMinutes: data.durationMinutes ?? 30,
        treatmentType: data.treatmentType ?? 'Consultation',
        status: data.status ?? 'SCHEDULED',
        dentistName: data.dentistName ?? null,
        notes: data.notes ?? null,
        colorTag: data.colorTag ?? null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'pending' as const
      }

      const stmt = this.db.prepare(`
        INSERT INTO appointments (id, patientId, patientName, patientPhone, dateTime, durationMinutes, treatmentType, status, dentistName, notes, colorTag, createdAt, updatedAt, deletedAt, syncStatus)
        VALUES (@id, @patientId, @patientName, @patientPhone, @dateTime, @durationMinutes, @treatmentType, @status, @dentistName, @notes, @colorTag, @createdAt, @updatedAt, @deletedAt, @syncStatus)
      `)
      stmt.run(apt)
      this.syncQueue.enqueue('appointment', id, 'INSERT', apt as Appointment)
      return apt as Appointment
    } else {
      const existing = this.getById(id)!
      const updated = {
        id,
        patientId: data.patientId ?? existing.patientId,
        patientName: data.patientName ?? existing.patientName,
        patientPhone: data.patientPhone !== undefined ? (data.patientPhone ?? null) : (existing.patientPhone ?? null),
        dateTime: data.dateTime ?? existing.dateTime,
        durationMinutes: data.durationMinutes ?? existing.durationMinutes ?? 30,
        treatmentType: data.treatmentType ?? existing.treatmentType ?? 'Consultation',
        status: data.status ?? existing.status ?? 'SCHEDULED',
        dentistName: data.dentistName !== undefined ? (data.dentistName ?? null) : (existing.dentistName ?? null),
        notes: data.notes !== undefined ? (data.notes ?? null) : (existing.notes ?? null),
        colorTag: data.colorTag !== undefined ? (data.colorTag ?? null) : (existing.colorTag ?? null),
        createdAt: existing.createdAt,
        updatedAt: now,
        deletedAt: existing.deletedAt ?? null,
        syncStatus: 'pending' as const
      }

      const stmt = this.db.prepare(`
        UPDATE appointments
        SET patientId = @patientId, patientName = @patientName, patientPhone = @patientPhone,
            dateTime = @dateTime, durationMinutes = @durationMinutes, treatmentType = @treatmentType,
            status = @status, dentistName = @dentistName, notes = @notes, colorTag = @colorTag,
            updatedAt = @updatedAt, syncStatus = @syncStatus
        WHERE id = @id
      `)
      stmt.run(updated)
      this.syncQueue.enqueue('appointment', id, 'UPDATE', updated as Appointment)
      return updated as Appointment
    }
  }

  updateStatus(id: string, status: Appointment['status']): boolean {
    const existing = this.getById(id)
    if (!existing) return false

    const now = new Date().toISOString()
    const stmt = this.db.prepare(`
      UPDATE appointments
      SET status = ?, updatedAt = ?, syncStatus = 'pending'
      WHERE id = ?
    `)
    stmt.run(status, now, id)

    this.syncQueue.enqueue('appointment', id, 'UPDATE', { ...existing, status, updatedAt: now })
    return true
  }

  delete(id: string): boolean {
    const existing = this.getById(id)
    if (!existing) return false

    const now = new Date().toISOString()
    const stmt = this.db.prepare('UPDATE appointments SET deletedAt = ?, syncStatus = "pending" WHERE id = ?')
    stmt.run(now, id)

    this.syncQueue.enqueue('appointment', id, 'DELETE', { id, deletedAt: now })
    return true
  }

  getTodayStats(): { todayCount: number; waitingCount: number; completedCount: number } {
    const today = new Date().toISOString().split('T')[0]
    const row = this.db.prepare(`
      SELECT 
        COUNT(*) as todayCount,
        SUM(CASE WHEN status IN ('SCHEDULED', 'CONFIRMED', 'IN_CHAIR') THEN 1 ELSE 0 END) as waitingCount,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completedCount
      FROM appointments
      WHERE deletedAt IS NULL AND dateTime LIKE ?
    `).get(`${today}%`) as { todayCount: number; waitingCount: number; completedCount: number }

    return {
      todayCount: row?.todayCount || 0,
      waitingCount: row?.waitingCount || 0,
      completedCount: row?.completedCount || 0
    }
  }
}
