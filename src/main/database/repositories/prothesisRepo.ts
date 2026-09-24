import Database from 'better-sqlite3'
import { ProstheticLaboratory, ProthesisOrder, ProthesisOrderStatus } from '@shared/types'

export class ProthesisRepository {
  constructor(private db: Database.Database) {}

  // 1. Laboratories
  getLabs(): ProstheticLaboratory[] {
    const stmt = this.db.prepare(`
      SELECT * FROM prosthetic_laboratories
      WHERE deletedAt IS NULL
      ORDER BY name ASC
    `)
    const rows = stmt.all() as any[]
    return rows.map((r) => ({
      ...r,
      active: Boolean(r.active)
    }))
  }

  getLabById(id: string): ProstheticLaboratory | null {
    const stmt = this.db.prepare(`
      SELECT * FROM prosthetic_laboratories
      WHERE id = ? AND deletedAt IS NULL
    `)
    const row = stmt.get(id) as any
    if (!row) return null
    return {
      ...row,
      active: Boolean(row.active)
    }
  }

  saveLab(data: Omit<ProstheticLaboratory, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): ProstheticLaboratory {
    const now = new Date().toISOString()
    const id = data.id || `lab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const isNew = !data.id || !this.getLabById(id)

    if (isNew) {
      const record: ProstheticLaboratory = {
        id,
        name: data.name,
        phone: data.phone,
        wilaya: data.wilaya || 'Alger',
        address: data.address || null,
        contactPerson: data.contactPerson || null,
        active: data.active !== undefined ? (data.active ? 1 : 0) : 1,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      }

      const stmt = this.db.prepare(`
        INSERT INTO prosthetic_laboratories (id, name, phone, wilaya, address, contactPerson, active, createdAt, updatedAt)
        VALUES (@id, @name, @phone, @wilaya, @address, @contactPerson, @active, @createdAt, @updatedAt)
      `)
      stmt.run(record)
      return { ...record, active: Boolean(record.active) }
    } else {
      const stmt = this.db.prepare(`
        UPDATE prosthetic_laboratories
        SET name = @name,
            phone = @phone,
            wilaya = @wilaya,
            address = @address,
            contactPerson = @contactPerson,
            active = @active,
            updatedAt = @updatedAt
        WHERE id = @id
      `)
      stmt.run({
        id,
        name: data.name,
        phone: data.phone,
        wilaya: data.wilaya || 'Alger',
        address: data.address || null,
        contactPerson: data.contactPerson || null,
        active: data.active ? 1 : 0,
        updatedAt: now
      })
      return this.getLabById(id)!
    }
  }

  deleteLab(id: string): boolean {
    const now = new Date().toISOString()
    const stmt = this.db.prepare(`
      UPDATE prosthetic_laboratories
      SET deletedAt = ?, active = 0
      WHERE id = ?
    `)
    const result = stmt.run(now, id)
    return result.changes > 0
  }

  // 2. Prothesis Orders
  private generateOrderNumber(): string {
    const year = new Date().getFullYear()
    const row = this.db.prepare('SELECT count(*) as count FROM prothesis_orders').get() as { count: number }
    const nextSeq = (row?.count || 0) + 1
    return `LAB-${year}-${String(nextSeq).padStart(4, '0')}`
  }

  getOrders(filters?: { patientId?: string; labId?: string; status?: ProthesisOrderStatus }): ProthesisOrder[] {
    let query = 'SELECT * FROM prothesis_orders WHERE deletedAt IS NULL'
    const params: string[] = []

    if (filters?.patientId) {
      query += ' AND patientId = ?'
      params.push(filters.patientId)
    }
    if (filters?.labId) {
      query += ' AND labId = ?'
      params.push(filters.labId)
    }
    if (filters?.status) {
      query += ' AND status = ?'
      params.push(filters.status)
    }

    query += ' ORDER BY createdAt DESC'
    const stmt = this.db.prepare(query)
    return stmt.all(...params) as ProthesisOrder[]
  }

  getOrderById(id: string): ProthesisOrder | null {
    const stmt = this.db.prepare(`
      SELECT * FROM prothesis_orders
      WHERE id = ? AND deletedAt IS NULL
    `)
    const row = stmt.get(id)
    return (row as ProthesisOrder) || null
  }

  saveOrder(
    data: Omit<ProthesisOrder, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'> & {
      id?: string
      orderNumber?: string
    }
  ): ProthesisOrder {
    const now = new Date().toISOString()
    const id = data.id || `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const isNew = !data.id || !this.getOrderById(id)

    if (isNew) {
      const orderNumber = data.orderNumber || this.generateOrderNumber()
      const record: ProthesisOrder = {
        id,
        orderNumber,
        patientId: data.patientId,
        patientName: data.patientName,
        dentistName: data.dentistName,
        labId: data.labId,
        labName: data.labName,
        actName: data.actName,
        toothNumber: data.toothNumber ?? null,
        shade: data.shade,
        nature: data.nature,
        status: data.status || 'PREPARATION',
        sentDate: data.sentDate ?? null,
        expectedDate: data.expectedDate ?? null,
        receivedDate: data.receivedDate ?? null,
        deliveryDate: data.deliveryDate ?? null,
        labCostDA: Number(data.labCostDA) || 0,
        clinicPriceDA: Number(data.clinicPriceDA) || 0,
        notes: data.notes ?? null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      }

      const stmt = this.db.prepare(`
        INSERT INTO prothesis_orders (
          id, orderNumber, patientId, patientName, dentistName, labId, labName, actName,
          toothNumber, shade, nature, status, sentDate, expectedDate, receivedDate,
          deliveryDate, labCostDA, clinicPriceDA, notes, createdAt, updatedAt
        ) VALUES (
          @id, @orderNumber, @patientId, @patientName, @dentistName, @labId, @labName, @actName,
          @toothNumber, @shade, @nature, @status, @sentDate, @expectedDate, @receivedDate,
          @deliveryDate, @labCostDA, @clinicPriceDA, @notes, @createdAt, @updatedAt
        )
      `)
      stmt.run(record)
      return record
    } else {
      const stmt = this.db.prepare(`
        UPDATE prothesis_orders
        SET patientId = @patientId,
            patientName = @patientName,
            dentistName = @dentistName,
            labId = @labId,
            labName = @labName,
            actName = @actName,
            toothNumber = @toothNumber,
            shade = @shade,
            nature = @nature,
            status = @status,
            sentDate = @sentDate,
            expectedDate = @expectedDate,
            receivedDate = @receivedDate,
            deliveryDate = @deliveryDate,
            labCostDA = @labCostDA,
            clinicPriceDA = @clinicPriceDA,
            notes = @notes,
            updatedAt = @updatedAt
        WHERE id = @id
      `)
      stmt.run({
        id,
        patientId: data.patientId,
        patientName: data.patientName,
        dentistName: data.dentistName,
        labId: data.labId,
        labName: data.labName,
        actName: data.actName,
        toothNumber: data.toothNumber ?? null,
        shade: data.shade,
        nature: data.nature,
        status: data.status,
        sentDate: data.sentDate ?? null,
        expectedDate: data.expectedDate ?? null,
        receivedDate: data.receivedDate ?? null,
        deliveryDate: data.deliveryDate ?? null,
        labCostDA: Number(data.labCostDA) || 0,
        clinicPriceDA: Number(data.clinicPriceDA) || 0,
        notes: data.notes ?? null,
        updatedAt: now
      })
      return this.getOrderById(id)!
    }
  }

  updateOrderStatus(id: string, status: ProthesisOrderStatus): boolean {
    const now = new Date().toISOString()
    const stmt = this.db.prepare(`
      UPDATE prothesis_orders
      SET status = ?,
          updatedAt = ?,
          deliveryDate = CASE WHEN ? = 'DELIVERED' THEN ? ELSE deliveryDate END,
          receivedDate = CASE WHEN ? = 'RECEIVED' THEN ? ELSE receivedDate END,
          sentDate = CASE WHEN ? = 'SENT' AND sentDate IS NULL THEN ? ELSE sentDate END
      WHERE id = ?
    `)
    const result = stmt.run(status, now, status, now, status, now, status, now, id)
    return result.changes > 0
  }

  deleteOrder(id: string): boolean {
    const now = new Date().toISOString()
    const stmt = this.db.prepare(`
      UPDATE prothesis_orders
      SET deletedAt = ?
      WHERE id = ?
    `)
    const result = stmt.run(now, id)
    return result.changes > 0
  }
}
