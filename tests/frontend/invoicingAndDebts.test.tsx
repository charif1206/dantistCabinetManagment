import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ToastProvider } from '@renderer/context/ToastContext'
import ToastContainer from '@renderer/features/common/ToastContainer'
import CreateInvoiceModal from '@renderer/features/billing/CreateInvoiceModal'
import DebtsManager from '@renderer/features/billing/DebtsManager'
import RecordPaymentModal from '@renderer/features/billing/RecordPaymentModal'
import { Patient, Invoice, MedicalAct, Payment } from '@shared/types'

const sampleDebtorPatient: Patient = {
  id: 'pat-debtor-101',
  patientNumber: 'DZ-2026-0088',
  firstName: 'Ahmed',
  lastName: 'Mansour',
  phone: '0555112233',
  wilaya: '16 - Alger',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01'
}

const sampleFullyPaidPatient: Patient = {
  id: 'pat-paid-202',
  patientNumber: 'DZ-2026-0099',
  firstName: 'Youcef',
  lastName: 'Brahimi',
  phone: '0661998877',
  wilaya: '31 - Oran',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01'
}

const sampleCatalogActs: MedicalAct[] = [
  {
    id: 'act-1',
    code: 'DETARTRAGE',
    name: 'Détartrage & Polissage complet aux ultra-sons',
    category: 'Prévention',
    defaultPrice: 5000,
    durationMinutes: 30,
    active: 1
  },
  {
    id: 'act-2',
    code: 'COMP_2F',
    name: 'Obturation composite photo 2 faces',
    category: 'Soins conservateurs',
    defaultPrice: 6000,
    durationMinutes: 45,
    active: 1
  },
  {
    id: 'act-3',
    code: 'COURONNE_CCM',
    name: 'Couronne céramo-métallique',
    category: 'Prothèse fixée',
    defaultPrice: 18000,
    durationMinutes: 60,
    active: 1
  }
]

const sampleUnpaidInvoices: Invoice[] = [
  {
    id: 'inv-prev-01',
    invoiceNumber: 'FAC-2026-0005',
    patientId: sampleDebtorPatient.id,
    patientName: 'Ahmed Mansour',
    date: '2026-09-10',
    totalAmount: 20000,
    paidAmount: 5000,
    remainingAmount: 15000,
    status: 'PARTIAL',
    paymentMethod: 'CASH',
    itemsJson: '[]',
    createdAt: '2026-09-10',
    updatedAt: '2026-09-10'
  },
  {
    id: 'inv-prev-02',
    invoiceNumber: 'FAC-2026-0008',
    patientId: sampleDebtorPatient.id,
    patientName: 'Ahmed Mansour',
    date: '2026-09-20',
    totalAmount: 10000,
    paidAmount: 0,
    remainingAmount: 10000,
    status: 'PENDING',
    paymentMethod: 'CASH',
    itemsJson: '[]',
    createdAt: '2026-09-20',
    updatedAt: '2026-09-20'
  }
]

describe('Frontend Invoicing (CreateInvoiceModal) & Debts Management (DebtsManager)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.api.getPatients = vi.fn().mockResolvedValue([sampleDebtorPatient, sampleFullyPaidPatient])
    window.api.getMedicalActs = vi.fn().mockResolvedValue(sampleCatalogActs)
    window.api.getInvoices = vi.fn().mockImplementation((patientId?: string) => {
      if (patientId === sampleDebtorPatient.id) {
        return Promise.resolve(sampleUnpaidInvoices)
      }
      if (patientId === sampleFullyPaidPatient.id) {
        return Promise.resolve([])
      }
      return Promise.resolve(sampleUnpaidInvoices)
    })
    window.api.saveInvoice = vi.fn().mockImplementation((inv) =>
      Promise.resolve({
        id: 'new-inv-123',
        invoiceNumber: 'FAC-2026-0010',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: inv.paidAmount >= inv.totalAmount ? 'PAID' : inv.paidAmount > 0 ? 'PARTIAL' : 'PENDING',
        remainingAmount: Math.max(0, inv.totalAmount - (inv.paidAmount || 0)),
        ...inv
      })
    )
    window.api.recordPayment = vi.fn().mockImplementation((p) =>
      Promise.resolve({
        id: 'pay-rec-101',
        createdAt: new Date().toISOString(),
        ...p
      })
    )
  })

  // =========================================================================
  // 1. شارة تنبيه الديون السابقة عند اختيار المريض
  // =========================================================================
  describe('1. Debts Warning Banner on Patient Selection', () => {
    it('displays the previous debts warning badge with exact outstanding balance (25,000 DA) for a debtor patient', async () => {
      render(
        <ToastProvider>
          <ToastContainer />
          <CreateInvoiceModal
            initialPatientId={sampleDebtorPatient.id}
            onClose={vi.fn()}
            onSuccess={vi.fn()}
          />
        </ToastProvider>
      )

      // Wait for debtor patient details and previous invoices to load
      await waitFor(() => {
        expect(screen.getByText('Ahmed Mansour')).toBeInTheDocument()
      })

      // Debt warning banner: 15,000 + 10,000 = 25,000 DA
      await waitFor(() => {
        expect(screen.getByText(/Dettes & Créances antérieures non soldées/i)).toBeInTheDocument()
      })

      expect(screen.getByText(/25[\s,.]?000.*DA/)).toBeInTheDocument()
      expect(screen.getByText('À cumuler au dossier')).toBeInTheDocument()
    })

    it('does not display any debt alert when selecting a patient with zero debt', async () => {
      render(
        <ToastProvider>
          <ToastContainer />
          <CreateInvoiceModal
            initialPatientId={sampleFullyPaidPatient.id}
            onClose={vi.fn()}
            onSuccess={vi.fn()}
          />
        </ToastProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('Youcef Brahimi')).toBeInTheDocument()
      })

      // Zero debt -> warning banner should NOT be displayed
      expect(screen.queryByText(/Dettes & Créances antérieures non soldées/i)).not.toBeInTheDocument()
    })
  })

  // =========================================================================
  // 2. العمليات الحسابية وتطبيق خصم 2000 DA والتحديث اللحظي
  // =========================================================================
  describe('2. Treatment Lines, 2000 DA Discount & Instant Subtotal / Net Calculations', () => {
    it('adds treatment lines, applies a 2000 DA commercial discount, and instantly updates Net and Remaining amounts', async () => {
      const onSuccess = vi.fn()
      const onClose = vi.fn()

      render(
        <ToastProvider>
          <ToastContainer />
          <CreateInvoiceModal
            initialPatientId={sampleDebtorPatient.id}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        </ToastProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('Ahmed Mansour')).toBeInTheDocument()
      })

      // The modal starts with 2 default items:
      // Item 1: Détartrage 5,000 DA
      // Item 2: Composite photo 2 faces 6,000 DA
      // Initial subtotal = 11,000 DA
      expect(screen.getByText(/Total Brut des Soins/i)).toBeInTheDocument()

      // Add custom line: "Couronne céramo-métallique" at 18000 DA
      const descInput = screen.getByPlaceholderText('Autre soin ou libellé personnalisé...')
      const priceInput = screen.getByPlaceholderText('Tarif DA')
      const addLineBtn = screen.getByRole('button', { name: '+ Ligne libre' })

      fireEvent.change(descInput, { target: { value: 'Couronne céramo-métallique' } })
      fireEvent.change(priceInput, { target: { value: '18000' } })
      fireEvent.click(addLineBtn)

      // Total Brut should now be 11,000 + 18,000 = 29,000 DA
      await waitFor(() => {
        expect(screen.getAllByText(/29[\s,.]?000.*DA/).length).toBeGreaterThanOrEqual(1)
      })

      // Apply commercial discount (Remise DA) = 2000 DA
      const discountInput = screen.getByDisplayValue('1000')
      fireEvent.change(discountInput, { target: { value: '2000' } })

      // Net to pay should immediately update to: 29,000 - 2,000 = 27,000 DA
      await waitFor(() => {
        expect(screen.getAllByText(/27[\s,.]?000.*DA/).length).toBeGreaterThanOrEqual(1)
      })

      // Set initial acompte = 7,000 DA
      const acompteRow = screen.getByText('Acompte immédiat perçu :').closest('div')
      const acompteInput = acompteRow?.querySelector('input') as HTMLInputElement
      expect(acompteInput).not.toBeNull()
      fireEvent.change(acompteInput, { target: { value: '7000' } })

      // Remaining debt: 27,000 - 7,000 = 20,000 DA
      await waitFor(() => {
        expect(screen.getAllByText(/20[\s,.]?000.*DA/).length).toBeGreaterThanOrEqual(1)
      })

      // Save the invoice
      const saveBtn = screen.getByRole('button', { name: 'Enregistrer' })
      fireEvent.click(saveBtn)

      await waitFor(() => {
        expect(window.api.saveInvoice).toHaveBeenCalledTimes(1)
      })

      const savedPayload = vi.mocked(window.api.saveInvoice).mock.calls[0][0]
      expect(savedPayload.totalAmount).toBe(27000)
      expect(savedPayload.paidAmount).toBe(7000)
      expect(savedPayload.patientId).toBe(sampleDebtorPatient.id)

      // Check items payload includes the discount metadata line
      const parsedItems = JSON.parse(savedPayload.itemsJson as string)
      const discountItem = parsedItems.find((it: any) => it.description.includes('Remise commerciale'))
      expect(discountItem).toBeDefined()
      expect(discountItem.amount).toBe(-2000)

      // Toast confirms creation
      expect(screen.getByText(/enregistrée avec succès/i)).toBeInTheDocument()
      expect(onSuccess).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })

  // =========================================================================
  // 3. قسم الديون DebtsManager ونموذج سند القبض RecordPaymentModal
  // =========================================================================
  describe('3. DebtsManager Dashboard & RecordPaymentModal Receipt Workflow', () => {
    it('renders the debts dashboard with debtor list, opens payment receipt modal, and updates dashboard', async () => {
      render(
        <ToastProvider>
          <ToastContainer />
          <DebtsManager />
        </ToastProvider>
      )

      // Wait for debts list to load
      await waitFor(() => {
        expect(screen.getByText(/Gestion des Créances & Dettes Patients/i)).toBeInTheDocument()
      })

      // Debtor patient should appear
      expect(screen.getByText('Ahmed Mansour')).toBeInTheDocument()
      expect(screen.getByText('DZ-2026-0088')).toBeInTheDocument()

      // Fully paid patient should NOT appear
      expect(screen.queryByText('Youcef Brahimi')).not.toBeInTheDocument()

      // Outstanding debt for Ahmed Mansour: 25,000 DA
      expect(screen.getAllByText(/25[\s,.]?000.*DA/).length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText(/1 patients débiteurs/i)).toBeInTheDocument()

      // Click "+ Encaisser" button for the debtor
      const encaisserBtn = screen.getByRole('button', { name: '+ Encaisser' })
      fireEvent.click(encaisserBtn)

      // RecordPaymentModal (نموذج سند القبض) opens
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Enregistrer un Paiement' })).toBeInTheDocument()
      })

      expect(screen.getByText(/Caisse & Règlements \(DA\)/i)).toBeInTheDocument()
      expect(screen.getAllByText('Ahmed Mansour').length).toBeGreaterThanOrEqual(1)

      // Select payment method "Espèces"
      const cashBtn = screen.getByRole('button', { name: /Espèces/i })
      fireEvent.click(cashBtn)

      // Submit payment receipt
      const submitPaymentBtn = screen.getByRole('button', { name: /Valider l’encaissement/i })
      fireEvent.click(submitPaymentBtn)

      await waitFor(() => {
        expect(window.api.recordPayment).toHaveBeenCalledTimes(1)
      })

      const paymentCall = vi.mocked(window.api.recordPayment).mock.calls[0][0]
      expect(paymentCall.patientId).toBe(sampleDebtorPatient.id)
      expect(paymentCall.method).toBe('CASH')

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Enregistrer un Paiement' })).not.toBeInTheDocument()
      })
    })

    it('can independently render and submit RecordPaymentModal', async () => {
      const onClose = vi.fn()
      const onSuccess = vi.fn()

      render(
        <RecordPaymentModal
          initialPatientId={sampleDebtorPatient.id}
          initialInvoiceId="inv-prev-01"
          defaultAmount={15000}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Enregistrer un Paiement' })).toBeInTheDocument()
      })

      // Payment amount should be pre-filled with 15000 DA
      const amountInput = screen.getByDisplayValue('15000')
      expect(amountInput).toBeInTheDocument()

      // Submit payment
      const submitBtn = screen.getByRole('button', { name: /Valider l’encaissement/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(window.api.recordPayment).toHaveBeenCalledTimes(1)
      })

      expect(onSuccess).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })
})
