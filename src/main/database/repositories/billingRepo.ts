import Database from 'better-sqlite3'
import { MedicalAct, Invoice, Payment, Treatment } from '@shared/types'
import { SyncQueueRepository } from './syncQueueRepo'

export class BillingRepository {
  private syncQueue: SyncQueueRepository

  constructor(private db: Database.Database) {
    this.syncQueue = new SyncQueueRepository(db)
  }

  // 1. Medical Acts
  getAllActs(category?: string, search?: string): MedicalAct[] {
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

  saveAct(act: Omit<MedicalAct, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): MedicalAct {
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

  // 2. Treatments (Actes Réalisés)
  getTreatmentsByPatient(patientId: string): Treatment[] {
    const stmt = this.db.prepare(`
      SELECT * FROM treatments
      WHERE patientId = ? AND deletedAt IS NULL
      ORDER BY date DESC, createdAt DESC
    `)
    return stmt.all(patientId) as Treatment[]
  }

  saveTreatment(treatment: Omit<Treatment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Treatment {
    const now = new Date().toISOString()
    const id = treatment.id || `trt_${Date.now()}`
    const isNew = !treatment.id

    if (isNew) {
      const fullTrt: Treatment = {
        ...treatment,
        id,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'pending'
      }
      const trtRow = {
        id,
        patientId: treatment.patientId,
        toothNumber: treatment.toothNumber ?? null,
        actId: treatment.actId ?? null,
        actName: treatment.actName,
        price: treatment.price ?? 0,
        status: treatment.status ?? 'PLANNED',
        date: treatment.date,
        notes: treatment.notes ?? null,
        dentistName: treatment.dentistName ?? null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'pending' as const
      }
      const stmt = this.db.prepare(`
        INSERT INTO treatments (id, patientId, toothNumber, actId, actName, price, status, date, notes, dentistName, createdAt, updatedAt, deletedAt, syncStatus)
        VALUES (@id, @patientId, @toothNumber, @actId, @actName, @price, @status, @date, @notes, @dentistName, @createdAt, @updatedAt, @deletedAt, @syncStatus)
      `)
      stmt.run(trtRow)
      this.syncQueue.enqueue('treatment', id, 'INSERT', fullTrt)
      return fullTrt
    } else {
      const updatedRow = {
        id,
        toothNumber: treatment.toothNumber ?? null,
        actName: treatment.actName,
        price: treatment.price ?? 0,
        status: treatment.status ?? 'PLANNED',
        date: treatment.date,
        notes: treatment.notes ?? null,
        dentistName: treatment.dentistName ?? null,
        updatedAt: now
      }
      const stmt = this.db.prepare(`
        UPDATE treatments
        SET toothNumber = @toothNumber, actName = @actName, price = @price, status = @status,
            date = @date, notes = @notes, dentistName = @dentistName, updatedAt = @updatedAt
        WHERE id = @id
      `)
      stmt.run(updatedRow)
      this.syncQueue.enqueue('treatment', id, 'UPDATE', { ...treatment, updatedAt: now })
      return { ...treatment, updatedAt: now } as Treatment
    }
  }

  // 3. Invoices & Payments
  getInvoices(patientId?: string): Invoice[] {
    if (patientId) {
      const stmt = this.db.prepare(`
        SELECT * FROM invoices
        WHERE patientId = ? AND deletedAt IS NULL
        ORDER BY date DESC
      `)
      return stmt.all(patientId) as Invoice[]
    }
    const stmt = this.db.prepare('SELECT * FROM invoices WHERE deletedAt IS NULL ORDER BY date DESC')
    return stmt.all() as Invoice[]
  }

  getInvoiceById(id: string): Invoice | null {
    const stmt = this.db.prepare('SELECT * FROM invoices WHERE id = ? AND deletedAt IS NULL')
    return (stmt.get(id) as Invoice) || null
  }

  saveInvoice(
    data: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt' | 'syncStatus'> & {
      id?: string
      invoiceNumber?: string
    }
  ): Invoice {
    const now = new Date().toISOString()
    const id = data.id || `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const isNew = !data.id || !this.getInvoiceById(id)

    if (isNew) {
      // Generate sequential invoice number: FAC-YYYY-XXXX
      let invoiceNumber = data.invoiceNumber
      if (!invoiceNumber) {
        const year = new Date().getFullYear()
        const countRow = this.db.prepare('SELECT count(*) as count FROM invoices').get() as { count: number }
        const seq = String(countRow.count + 1).padStart(4, '0')
        invoiceNumber = `FAC-${year}-${seq}`
      }

      const totalAmount = data.totalAmount || 0
      const paidAmount = data.paidAmount || 0
      const remainingAmount = Math.max(0, totalAmount - paidAmount)
      const status: Invoice['status'] =
        remainingAmount === 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'PENDING'

      const fullInv: Invoice = {
        ...data,
        id,
        invoiceNumber,
        totalAmount,
        paidAmount,
        remainingAmount,
        status,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'pending'
      }

      const invRow = {
        id,
        invoiceNumber,
        patientId: fullInv.patientId,
        patientName: fullInv.patientName,
        date: fullInv.date,
        dueDate: fullInv.dueDate ?? null,
        totalAmount,
        paidAmount,
        remainingAmount,
        status,
        paymentMethod: fullInv.paymentMethod ?? 'CASH',
        itemsJson: typeof fullInv.itemsJson === 'string' ? fullInv.itemsJson : JSON.stringify(fullInv.itemsJson || []),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'pending' as const
      }

      const stmt = this.db.prepare(`
        INSERT INTO invoices (id, invoiceNumber, patientId, patientName, date, dueDate, totalAmount, paidAmount, remainingAmount, status, paymentMethod, itemsJson, createdAt, updatedAt, deletedAt, syncStatus)
        VALUES (@id, @invoiceNumber, @patientId, @patientName, @date, @dueDate, @totalAmount, @paidAmount, @remainingAmount, @status, @paymentMethod, @itemsJson, @createdAt, @updatedAt, @deletedAt, @syncStatus)
      `)
      stmt.run(invRow)

      // Enqueue to cloud sync
      this.syncQueue.enqueue('invoice', id, 'INSERT', fullInv)

      // If initial payment was made at invoice creation, record payment
      if (paidAmount > 0) {
        const payId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
        const fullPay: Payment = {
          id: payId,
          patientId: fullInv.patientId,
          invoiceId: id,
          amount: paidAmount,
          date: fullInv.date,
          method: fullInv.paymentMethod || 'CASH',
          notes: 'Acompte initial à la création de la facture',
          createdAt: now,
          deletedAt: null,
          syncStatus: 'pending'
        }
        const payRow = {
          ...fullPay,
          notes: fullPay.notes ?? null,
          deletedAt: null,
          syncStatus: 'pending' as const
        }
        this.db.prepare(`
          INSERT INTO payments (id, patientId, invoiceId, amount, date, method, notes, createdAt, deletedAt, syncStatus)
          VALUES (@id, @patientId, @invoiceId, @amount, @date, @method, @notes, @createdAt, @deletedAt, @syncStatus)
        `).run(payRow)
        this.syncQueue.enqueue('payment', payId, 'INSERT', fullPay)
      }

      return fullInv
    } else {
      // Update existing
      const existing = this.getInvoiceById(id)
      const totalAmount = data.totalAmount ?? existing?.totalAmount ?? 0
      const paidAmount = data.paidAmount ?? existing?.paidAmount ?? 0
      const remainingAmount = Math.max(0, totalAmount - paidAmount)
      const status: Invoice['status'] =
        remainingAmount === 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'PENDING'

      const updated = {
        ...existing,
        ...data,
        id,
        totalAmount,
        paidAmount,
        remainingAmount,
        status,
        updatedAt: now
      }

      const invUpdateRow = {
        id,
        patientName: updated.patientName,
        date: updated.date,
        dueDate: updated.dueDate ?? null,
        totalAmount,
        paidAmount,
        remainingAmount,
        status,
        paymentMethod: updated.paymentMethod ?? 'CASH',
        itemsJson: typeof updated.itemsJson === 'string' ? updated.itemsJson : JSON.stringify(updated.itemsJson || []),
        updatedAt: now
      }

      this.db.prepare(`
        UPDATE invoices
        SET patientName = @patientName, date = @date, dueDate = @dueDate,
            totalAmount = @totalAmount, paidAmount = @paidAmount,
            remainingAmount = @remainingAmount, status = @status,
            paymentMethod = @paymentMethod, itemsJson = @itemsJson,
            updatedAt = @updatedAt
        WHERE id = @id
      `).run(invUpdateRow)

      this.syncQueue.enqueue('invoice', id, 'UPDATE', updated)
      return updated as Invoice
    }
  }

  recordPayment(payment: Omit<Payment, 'id' | 'createdAt'>): Payment {
    const now = new Date().toISOString()
    const id = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const fullPay: Payment = {
      ...payment,
      id,
      createdAt: now,
      deletedAt: null,
      syncStatus: 'pending'
    }

    const payRow = {
      id,
      patientId: payment.patientId,
      invoiceId: payment.invoiceId,
      amount: payment.amount,
      date: payment.date,
      method: payment.method || 'CASH',
      notes: payment.notes ?? null,
      createdAt: now,
      deletedAt: null,
      syncStatus: 'pending' as const
    }

    const stmt = this.db.prepare(`
      INSERT INTO payments (id, patientId, invoiceId, amount, date, method, notes, createdAt, deletedAt, syncStatus)
      VALUES (@id, @patientId, @invoiceId, @amount, @date, @method, @notes, @createdAt, @deletedAt, @syncStatus)
    `)
    stmt.run(payRow)

    // If attached to an invoice, update paidAmount and remainingAmount
    if (payment.invoiceId) {
      this.db.prepare(`
        UPDATE invoices
        SET paidAmount = paidAmount + ?,
            remainingAmount = MAX(0, totalAmount - (paidAmount + ?)),
            status = CASE WHEN (paidAmount + ?) >= totalAmount THEN 'PAID' ELSE 'PARTIAL' END,
            updatedAt = ?
        WHERE id = ?
      `).run(payment.amount, payment.amount, payment.amount, now, payment.invoiceId)
    }

    this.syncQueue.enqueue('payment', id, 'INSERT', fullPay)
    return fullPay
  }

  // Financial Stats in Algerian Dinars (DA)
  getFinancialStats(): { todayRevenueDA: number; totalDebtsDA: number } {
    const today = new Date().toISOString().split('T')[0]

    // Daily revenue from payments made today
    const revRow = this.db.prepare(`
      SELECT SUM(amount) as todayRevenue
      FROM payments
      WHERE deletedAt IS NULL AND date = ?
    `).get(today) as { todayRevenue: number | null }

    // Total outstanding debts from all unpaid / partial invoices
    const debtRow = this.db.prepare(`
      SELECT SUM(remainingAmount) as totalDebts
      FROM invoices
      WHERE deletedAt IS NULL AND remainingAmount > 0
    `).get() as { totalDebts: number | null }

    return {
      todayRevenueDA: revRow?.todayRevenue || 0,
      totalDebtsDA: debtRow?.totalDebts || 0
    }
  }
}
