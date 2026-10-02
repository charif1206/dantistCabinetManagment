import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDatabase, seedTestPatient } from '../fixtures/testDb'
import { BillingRepository } from '../../src/main/database/repositories/billingRepo'

describe('BillingRepository - Invoicing, Algerian Dinars (DA) & Debts Management', () => {
  let db: Database.Database
  let billingRepo: BillingRepository

  beforeEach(() => {
    // Empty database without demo seeds so invoice numbering starts clean from count = 0
    db = createTestDatabase(false)
    billingRepo = new BillingRepository(db)
  })

  afterEach(() => {
    if (db && db.open) {
      db.close()
    }
  })

  // =========================================================================
  // 1. توليد الرقم التسلسلي للفاتورة (FAC-YYYY-XXXX)
  // =========================================================================
  describe('1. Sequential Invoice Number Generation (FAC-YYYY-XXXX)', () => {
    it('generates sequential invoice numbers starting from FAC-YYYY-0001 in Algerian Dinars', () => {
      const year = new Date().getFullYear()
      const patient = seedTestPatient(db, {
        firstName: 'Farid',
        lastName: 'Zidane',
        phone: '0555112233'
      })

      // Invoice 1
      const inv1 = billingRepo.saveInvoice({
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        date: '2026-10-01',
        totalAmount: 10000,
        paidAmount: 0,
        paymentMethod: 'CASH',
        itemsJson: JSON.stringify([
          { description: 'Consultation & Bilan', quantity: 1, unitPrice: 2000, amount: 2000 },
          { description: 'Détartrage complet', quantity: 1, unitPrice: 8000, amount: 8000 }
        ])
      })

      expect(inv1.invoiceNumber).toBe(`FAC-${year}-0001`)
      expect(inv1.totalAmount).toBe(10000)
      expect(inv1.remainingAmount).toBe(10000)
      expect(inv1.status).toBe('PENDING')

      // Invoice 2
      const inv2 = billingRepo.saveInvoice({
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        date: '2026-10-02',
        totalAmount: 15000,
        paidAmount: 5000,
        paymentMethod: 'CASH',
        itemsJson: JSON.stringify([
          { description: 'Traitement canalaire', quantity: 1, unitPrice: 15000, amount: 15000 }
        ])
      })

      expect(inv2.invoiceNumber).toBe(`FAC-${year}-0002`)
      expect(inv2.paidAmount).toBe(5000)
      expect(inv2.remainingAmount).toBe(10000)
      expect(inv2.status).toBe('PARTIAL')
    })

    it('preserves custom invoice number if explicitly provided', () => {
      const patient = seedTestPatient(db)
      const customInv = billingRepo.saveInvoice({
        invoiceNumber: 'FAC-2026-SPEC-099',
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        date: '2026-10-05',
        totalAmount: 6000,
        paidAmount: 6000,
        paymentMethod: 'CASH',
        itemsJson: '[]'
      })

      expect(customInv.invoiceNumber).toBe('FAC-2026-SPEC-099')
      expect(customInv.status).toBe('PAID')
      expect(customInv.remainingAmount).toBe(0)
    })
  })

  // =========================================================================
  // 2. العمليات الحسابية: (مجموع البنود) - (الخصم Remise DA) = الصافي الإجمالي
  // =========================================================================
  describe('2. Financial Calculations: Subtotal - Remise (DA) = Net Total', () => {
    it('computes exact subtotal from items, subtracts discount (Remise DA), and stores net total without precision error', () => {
      const patient = seedTestPatient(db, {
        firstName: 'Samira',
        lastName: 'Benali',
        phone: '0661223344'
      })

      // Item 1: Détartrage 5,000 DA
      // Item 2: Composite photo 2 faces 6,000 DA x 2 = 12,000 DA
      // Item 3: Extraction dentaire simple 4,500 DA
      const items = [
        { description: 'Détartrage et polissage complet', quantity: 1, unitPrice: 5000, amount: 5000 },
        { description: 'Obturation composite 2 faces', quantity: 2, unitPrice: 6000, amount: 12000 },
        { description: 'Extraction dentaire simple', quantity: 1, unitPrice: 4500, amount: 4500 }
      ]

      const itemsSubtotalDA = items.reduce((acc, it) => acc + it.amount, 0)
      expect(itemsSubtotalDA).toBe(21500) // 5000 + 12000 + 4500 = 21500 DA

      const remiseDA = 2000 // 2,000 DA discount
      const expectedNetTotalDA = itemsSubtotalDA - remiseDA // 19,500 DA

      const savedInvoice = billingRepo.saveInvoice({
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        date: '2026-10-10',
        totalAmount: expectedNetTotalDA,
        paidAmount: 0,
        paymentMethod: 'CASH',
        itemsJson: JSON.stringify([
          ...items,
          { description: 'Remise commerciale accordée (-2000 DA)', quantity: 1, unitPrice: -remiseDA, amount: -remiseDA }
        ])
      })

      expect(savedInvoice.totalAmount).toBe(19500)
      expect(savedInvoice.paidAmount).toBe(0)
      expect(savedInvoice.remainingAmount).toBe(19500)
      expect(savedInvoice.status).toBe('PENDING')

      // Query from database to verify persistence
      const persisted = billingRepo.getInvoiceById(savedInvoice.id)
      expect(persisted).not.toBeNull()
      expect(persisted?.totalAmount).toBe(19500)
      expect(persisted?.remainingAmount).toBe(19500)

      const parsedItems = JSON.parse(persisted?.itemsJson as string)
      expect(parsedItems.length).toBe(4)
      expect(parsedItems[3].amount).toBe(-2000)
    })
  })

  // =========================================================================
  // 3. تسجيل دفعة جزئية (Acompte) وتحديث المبلغ المتبقي (Reste à payer)
  // =========================================================================
  describe('3. Partial Payments (Acomptes) & Remaining Amount Tracking', () => {
    it('creates an invoice with initial deposit, records payment, and transitions through PARTIAL to PAID', () => {
      const patient = seedTestPatient(db, {
        firstName: 'Karim',
        lastName: 'Mebarek',
        phone: '0770334455'
      })

      const totalBilled = 30000 // 30,000 DA
      const initialAcompte = 10000 // 10,000 DA

      // 1. Create invoice with initial deposit of 10,000 DA
      const invoice = billingRepo.saveInvoice({
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        date: '2026-10-15',
        totalAmount: totalBilled,
        paidAmount: initialAcompte,
        paymentMethod: 'CASH',
        itemsJson: JSON.stringify([
          { description: 'Couronne céramo-métallique', quantity: 1, unitPrice: 30000, amount: 30000 }
        ])
      })

      expect(invoice.totalAmount).toBe(30000)
      expect(invoice.paidAmount).toBe(10000)
      expect(invoice.remainingAmount).toBe(20000) // 30,000 - 10,000 = 20,000 DA
      expect(invoice.status).toBe('PARTIAL')

      // Verify that initial acompte created an automatic record in payments table
      const initialPayments = db.prepare('SELECT * FROM payments WHERE invoiceId = ?').all(invoice.id) as any[]
      expect(initialPayments.length).toBe(1)
      expect(initialPayments[0].amount).toBe(10000)
      expect(initialPayments[0].method).toBe('CASH')

      // 2. Record second installment payment of 8,000 DA
      const payment2 = billingRepo.recordPayment({
        patientId: patient.id,
        invoiceId: invoice.id,
        amount: 8000,
        date: '2026-10-20',
        method: 'CASH',
        notes: 'Second versement en espèces'
      })

      expect(payment2.amount).toBe(8000)

      // Verify invoice update in database
      const afterSecondPay = billingRepo.getInvoiceById(invoice.id)
      expect(afterSecondPay?.paidAmount).toBe(18000) // 10,000 + 8,000 = 18,000 DA
      expect(afterSecondPay?.remainingAmount).toBe(12000) // 30,000 - 18,000 = 12,000 DA
      expect(afterSecondPay?.status).toBe('PARTIAL')

      // 3. Record final installment of 12,000 DA to settle invoice completely
      billingRepo.recordPayment({
        patientId: patient.id,
        invoiceId: invoice.id,
        amount: 12000,
        date: '2026-10-25',
        method: 'TRANSFER',
        notes: 'Solde final par virement bancaire'
      })

      const finalInvoice = billingRepo.getInvoiceById(invoice.id)
      expect(finalInvoice?.paidAmount).toBe(30000)
      expect(finalInvoice?.remainingAmount).toBe(0)
      expect(finalInvoice?.status).toBe('PAID')

      // Total payments recorded should be 3 (10k + 8k + 12k = 30k)
      const allPayments = db.prepare('SELECT * FROM payments WHERE invoiceId = ?').all(invoice.id) as any[]
      expect(allPayments.length).toBe(3)
      const sumPayments = allPayments.reduce((acc, p) => acc + p.amount, 0)
      expect(sumPayments).toBe(30000)
    })
  })

  // =========================================================================
  // 4. تصفية المرضى المدينين (Debts List) وحساب إجمالي ديون العيادة
  // =========================================================================
  describe('4. Debtor Filtering (Debts List) & Total Clinic Outstanding Debts', () => {
    it('accurately filters debtor patients and computes clinic-wide outstanding debts in DA', () => {
      // Patient 1: Has unpaid debt
      const pat1 = seedTestPatient(db, {
        id: 'pat-debtor-1',
        patientNumber: 'DZ-2026-0001',
        firstName: 'Ahmed',
        lastName: 'Mansour'
      })

      // Patient 2: Has unpaid debt on multiple invoices
      const pat2 = seedTestPatient(db, {
        id: 'pat-debtor-2',
        patientNumber: 'DZ-2026-0002',
        firstName: 'Nadia',
        lastName: 'Touati'
      })

      // Patient 3: Fully paid (Zero debt)
      const pat3 = seedTestPatient(db, {
        id: 'pat-paid-3',
        patientNumber: 'DZ-2026-0003',
        firstName: 'Youcef',
        lastName: 'Brahimi'
      })

      // Invoices for Patient 1: 20,000 DA total, 5,000 DA paid -> Remaining debt: 15,000 DA
      billingRepo.saveInvoice({
        patientId: pat1.id,
        patientName: 'Ahmed Mansour',
        date: '2026-10-01',
        totalAmount: 20000,
        paidAmount: 5000,
        paymentMethod: 'CASH',
        itemsJson: '[]'
      })

      // Invoices for Patient 2:
      // Invoice A: 35,000 DA total, 15,000 DA paid -> Remaining: 20,000 DA
      // Invoice B: 10,000 DA total, 0 paid -> Remaining: 10,000 DA
      // Total debt for Patient 2 = 20,000 + 10,000 = 30,000 DA
      billingRepo.saveInvoice({
        patientId: pat2.id,
        patientName: 'Nadia Touati',
        date: '2026-10-02',
        totalAmount: 35000,
        paidAmount: 15000,
        paymentMethod: 'CASH',
        itemsJson: '[]'
      })
      billingRepo.saveInvoice({
        patientId: pat2.id,
        patientName: 'Nadia Touati',
        date: '2026-10-03',
        totalAmount: 10000,
        paidAmount: 0,
        paymentMethod: 'CASH',
        itemsJson: '[]'
      })

      // Invoice for Patient 3: 18,000 DA total, 18,000 DA paid -> Remaining: 0 DA
      billingRepo.saveInvoice({
        patientId: pat3.id,
        patientName: 'Youcef Brahimi',
        date: '2026-10-04',
        totalAmount: 18000,
        paidAmount: 18000,
        paymentMethod: 'CASH',
        itemsJson: '[]'
      })

      // All clinic invoices
      const allInvoices = billingRepo.getInvoices()
      expect(allInvoices.length).toBe(4)

      // Calculate debts per patient
      const patientDebtsMap = new Map<string, { totalBilled: number; totalPaid: number; remainingDebt: number }>()

      allInvoices.forEach((inv) => {
        const prev = patientDebtsMap.get(inv.patientId) || { totalBilled: 0, totalPaid: 0, remainingDebt: 0 }
        patientDebtsMap.set(inv.patientId, {
          totalBilled: prev.totalBilled + inv.totalAmount,
          totalPaid: prev.totalPaid + inv.paidAmount,
          remainingDebt: prev.remainingDebt + inv.remainingAmount
        })
      })

      // Patient 1 Debts
      const pat1Debts = patientDebtsMap.get(pat1.id)
      expect(pat1Debts?.totalBilled).toBe(20000)
      expect(pat1Debts?.totalPaid).toBe(5000)
      expect(pat1Debts?.remainingDebt).toBe(15000)

      // Patient 2 Debts
      const pat2Debts = patientDebtsMap.get(pat2.id)
      expect(pat2Debts?.totalBilled).toBe(45000)
      expect(pat2Debts?.totalPaid).toBe(15000)
      expect(pat2Debts?.remainingDebt).toBe(30000)

      // Patient 3 Debts
      const pat3Debts = patientDebtsMap.get(pat3.id)
      expect(pat3Debts?.remainingDebt).toBe(0)

      // Debtor list: only patients with remainingDebt > 0
      const debtorPatientIds = Array.from(patientDebtsMap.entries())
        .filter(([_, d]) => d.remainingDebt > 0)
        .map(([id]) => id)

      expect(debtorPatientIds).toHaveLength(2)
      expect(debtorPatientIds).toContain(pat1.id)
      expect(debtorPatientIds).toContain(pat2.id)
      expect(debtorPatientIds).not.toContain(pat3.id)

      // Total clinic debts = 15,000 DA (pat1) + 30,000 DA (pat2) = 45,000 DA
      const totalClinicDebts = Array.from(patientDebtsMap.values()).reduce(
        (sum, d) => sum + d.remainingDebt,
        0
      )
      expect(totalClinicDebts).toBe(45000)

      // Check against getFinancialStats()
      const stats = billingRepo.getFinancialStats()
      expect(stats.totalDebtsDA).toBe(45000)
      expect(stats.debtorPatientsCount).toBe(2)
    })
  })
})
