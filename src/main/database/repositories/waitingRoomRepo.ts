import Database from 'better-sqlite3'
import { WaitingRoomEntry, WaitingRoomStatus } from '@shared/types'

export class WaitingRoomRepository {
  constructor(private db: Database.Database) {}

  getAll(status?: WaitingRoomStatus): WaitingRoomEntry[] {
    let query = 'SELECT * FROM waiting_room_entries WHERE 1=1'
    const params: string[] = []

    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }

    query += ' ORDER BY isUrgent DESC, arrivalTime ASC'
    const rows = this.db.prepare(query).all(...params) as any[]
    return rows.map((r) => ({
      ...r,
      isUrgent: Boolean(r.isUrgent)
    }))
  }

  // Exact named helper for active queue
  getWaitingQueue(activeOnly = true): WaitingRoomEntry[] {
    let query = 'SELECT * FROM waiting_room_entries WHERE 1=1'
    if (activeOnly) {
      query += " AND status IN ('WAITING', 'IN_CHAIR')"
    }
    query += ' ORDER BY isUrgent DESC, arrivalTime ASC'
    const rows = this.db.prepare(query).all() as any[]
    return rows.map((r) => ({
      ...r,
      isUrgent: Boolean(r.isUrgent)
    }))
  }

  getById(id: string): WaitingRoomEntry | null {
    const stmt = this.db.prepare('SELECT * FROM waiting_room_entries WHERE id = ?')
    const row = stmt.get(id) as any
    if (!row) return null
    return {
      ...row,
      isUrgent: Boolean(row.isUrgent)
    }
  }

  add(
    data: Omit<WaitingRoomEntry, 'id' | 'createdAt' | 'arrivalTime'> & {
      id?: string
      arrivalTime?: string
    }
  ): WaitingRoomEntry {
    const now = new Date().toISOString()
    const id = data.id || `wait_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const arrivalTime = data.arrivalTime || now

    const record: WaitingRoomEntry = {
      id,
      patientId: data.patientId,
      patientName: data.patientName,
      patientPhone: data.patientPhone ?? null,
      appointmentId: data.appointmentId ?? null,
      arrivalTime,
      calledTime: data.calledTime ?? null,
      departureTime: data.departureTime ?? null,
      status: data.status || 'WAITING',
      isUrgent: data.isUrgent ? 1 : 0,
      priorityNote: data.priorityNote ?? null,
      assignedDentist: data.assignedDentist ?? null,
      createdAt: now
    }

    const stmt = this.db.prepare(`
      INSERT INTO waiting_room_entries (
        id, patientId, patientName, patientPhone, appointmentId,
        arrivalTime, calledTime, departureTime, status, isUrgent,
        priorityNote, assignedDentist, createdAt
      ) VALUES (
        @id, @patientId, @patientName, @patientPhone, @appointmentId,
        @arrivalTime, @calledTime, @departureTime, @status, @isUrgent,
        @priorityNote, @assignedDentist, @createdAt
      )
    `)
    stmt.run(record)
    return { ...record, isUrgent: Boolean(record.isUrgent) }
  }

  addToWaitingQueue(
    data: Omit<WaitingRoomEntry, 'id' | 'createdAt' | 'arrivalTime'> & {
      id?: string
      arrivalTime?: string
    }
  ): WaitingRoomEntry {
    return this.add(data)
  }

  updateStatus(
    id: string,
    status: WaitingRoomStatus,
    calledTime?: string,
    departureTime?: string
  ): boolean {
    const now = new Date().toISOString()
    let setClause = 'status = ?'
    const params: (string | null)[] = [status]

    if (status === 'IN_CHAIR') {
      setClause += ', calledTime = ?'
      params.push(calledTime || now)
    } else if (status === 'DONE' || status === 'LEFT') {
      setClause += ', departureTime = ?'
      params.push(departureTime || now)
    }

    params.push(id)
    const stmt = this.db.prepare(`UPDATE waiting_room_entries SET ${setClause} WHERE id = ?`)
    const result = stmt.run(...params)
    return result.changes > 0
  }

  callPatientToChair(id: string): boolean {
    return this.updateStatus(id, 'IN_CHAIR')
  }

  finishVisit(id: string): boolean {
    return this.updateStatus(id, 'DONE')
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM waiting_room_entries WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  removeFromQueue(id: string): boolean {
    return this.delete(id)
  }
}
