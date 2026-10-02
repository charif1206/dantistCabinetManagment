import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import NewProthesisOrderModal from '../../src/renderer/src/features/prothesis/NewProthesisOrderModal'
import { ToastProvider } from '../../src/renderer/src/context/ToastContext'
import ToastContainer from '../../src/renderer/src/features/common/ToastContainer'
import { Patient, ProstheticLaboratory, ProthesisOrder } from '@shared/types'

const samplePatient: Patient = {
  id: 'pat-proth-01',
  patientNumber: 'DZ-2026-0088',
  firstName: 'Nadia',
  lastName: 'Belkacem',
  phone: '0555998877',
  dateOfBirth: '1990-05-15',
  wilaya: '16 - Alger',
  address: 'Bab El Oued, Alger',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01'
}

const sampleLab: ProstheticLaboratory = {
  id: 'lab-alger-01',
  name: 'Laboratoire Dentaire Central Alger',
  phone: '021654321',
  wilaya: 'Alger',
  contactPerson: 'M. Karim Prothésiste',
  active: 1,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01'
}

describe('Prompt 7: Prothesis Orders UX, FDI Tooth Selector, VITA Shade Guide & Auto Patient Retrieval', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.api.getPatients = vi.fn().mockResolvedValue([samplePatient])
    window.api.getProstheticLabs = vi.fn().mockResolvedValue([sampleLab])
    window.api.saveProthesisOrder = vi.fn().mockImplementation((order) =>
      Promise.resolve({
        id: 'ord-101',
        orderNumber: 'LAB-2026-0009',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...order
      })
    )
  })

  // 1. إزالة الحقول غير المنطقية وجلب بيانات المريض تلقائياً
  describe('1. Auto-retrieval of Patient Identity & Fast Search (No Manual Phone/Address Typing)', () => {
    it('automatically displays patient phone, address, wilaya, age and dossier number when initialPatient is provided', async () => {
      render(
        <ToastProvider>
          <ToastContainer />
          <NewProthesisOrderModal
            isOpen={true}
            onClose={vi.fn()}
            onSuccess={vi.fn()}
            initialPatient={samplePatient}
          />
        </ToastProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('BELKACEM Nadia')).toBeInTheDocument()
      })

      // Auto-retrieved information from patient record
      expect(screen.getByText('DZ-2026-0088')).toBeInTheDocument()
      expect(screen.getByText('0555998877')).toBeInTheDocument()
      expect(screen.getByText(/16 - Alger/i)).toBeInTheDocument()
      expect(screen.getByText(/Bab El Oued/i)).toBeInTheDocument()
      expect(screen.getByText(/\b\d+\s*ans\b/)).toBeInTheDocument() // Age dynamically calculated

      // Confirm there is NO manual text input for phone or address
      expect(screen.queryByPlaceholderText(/Téléphone du patient/i)).not.toBeInTheDocument()
      expect(screen.queryByPlaceholderText(/Adresse du patient/i)).not.toBeInTheDocument()
    })

    it('allows searching and selecting a patient via fast search by name or dossier number', async () => {
      render(
        <ToastProvider>
          <ToastContainer />
          <NewProthesisOrderModal
            isOpen={true}
            onClose={vi.fn()}
            onSuccess={vi.fn()}
          />
        </ToastProvider>
      )

      // Search input is rendered
      const searchInput = screen.getByPlaceholderText(/Rechercher par Nom, Prénom/i)
      expect(searchInput).toBeInTheDocument()

      fireEvent.change(searchInput, { target: { value: 'Belkacem' } })

      await waitFor(() => {
        expect(screen.getByText('DZ-2026-0088')).toBeInTheDocument()
      })

      // Click the searched patient
      fireEvent.click(screen.getByText('DZ-2026-0088'))

      // Patient card becomes active
      await waitFor(() => {
        expect(screen.getByText('BELKACEM Nadia')).toBeInTheDocument()
        expect(screen.getByText('0555998877')).toBeInTheDocument()
      })
    })
  })

  // 2. محدد الأسنان التفاعلي بنظام FDI (11-48) والجسور (Bridges)
  describe('2. Interactive FDI Tooth Selector (11-48) & Bridge Multi-Selection', () => {
    it('allows selecting single tooth (e.g. 21) or multiple teeth (e.g. 14, 15, 16) for a bridge', async () => {
      render(
        <ToastProvider>
          <ToastContainer />
          <NewProthesisOrderModal
            isOpen={true}
            onClose={vi.fn()}
            onSuccess={vi.fn()}
            initialPatient={samplePatient}
          />
        </ToastProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('BELKACEM Nadia')).toBeInTheDocument()
      })

      // Click tooth 16
      const tooth16Btn = screen.getByTitle('Dent 16 (Cadran 1 - Haut Droit)')
      fireEvent.click(tooth16Btn)

      // Click tooth 15
      const tooth15Btn = screen.getByTitle('Dent 15 (Cadran 1 - Haut Droit)')
      fireEvent.click(tooth15Btn)

      // Click tooth 14
      const tooth14Btn = screen.getByTitle('Dent 14 (Cadran 1 - Haut Droit)')
      fireEvent.click(tooth14Btn)

      // Selected teeth summary bar should show all 3 teeth and indicate a bridge
      await waitFor(() => {
        expect(screen.getByText(/Bridge \/ Dents multiples \(3 éléments\)/i)).toBeInTheDocument()
        expect(screen.getByText('Configuration Bridge Prothétique')).toBeInTheDocument()
      })
    })
  })

  // 3. مواصفات المعمل، حساب المهلة ودليل VITA
  describe('3. Partner Labs, Auto Lead Time Calculation & VITA Shade Guide', () => {
    it('calculates expected delivery date and lead time with presets', async () => {
      render(
        <ToastProvider>
          <ToastContainer />
          <NewProthesisOrderModal
            isOpen={true}
            onClose={vi.fn()}
            onSuccess={vi.fn()}
            initialPatient={samplePatient}
          />
        </ToastProvider>
      )

      await waitFor(() => {
        expect(screen.getByText(/Laboratoire Dentaire Central Alger/i)).toBeInTheDocument()
      })

      // Click Express 3j preset
      const expressBtn = screen.getByRole('button', { name: /Express \(3j\)/i })
      fireEvent.click(expressBtn)

      // Lead time indicator should display 3 jours
      await waitFor(() => {
        expect(screen.getByText('3 jours')).toBeInTheDocument()
      })
    })

    it('allows picking shades from VITA Classical guide (A1, A2, A3, B1...) and updates active shade preview', async () => {
      render(
        <ToastProvider>
          <ToastContainer />
          <NewProthesisOrderModal
            isOpen={true}
            onClose={vi.fn()}
            onSuccess={vi.fn()}
            initialPatient={samplePatient}
          />
        </ToastProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('BELKACEM Nadia')).toBeInTheDocument()
      })

      // Click A3 shade swatch button
      const shadeA3Btn = screen.getByRole('button', { name: 'Teinte A3' })
      fireEvent.click(shadeA3Btn)

      // Active shade preview badge updates to A3
      expect(screen.getAllByText('A3').length).toBeGreaterThanOrEqual(1)
    })
  })

  // 4. رسائل التحقق المفهومة والحفظ الناجح
  describe('4. Understandable Validation Messages & Order Submission', () => {
    it('blocks submission and displays understandable error message when tooth is missing for crown/bridge', async () => {
      render(
        <ToastProvider>
          <ToastContainer />
          <NewProthesisOrderModal
            isOpen={true}
            onClose={vi.fn()}
            onSuccess={vi.fn()}
            initialPatient={samplePatient}
          />
        </ToastProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('BELKACEM Nadia')).toBeInTheDocument()
      })

      // Do NOT select any teeth, attempt to submit
      const submitBtn = screen.getByRole('button', { name: /Créer la Commande & Bon Labo/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(
          screen.getByText(/Veuillez sélectionner au moins une dent concernée sur le schéma dentaire FDI \(11 à 48\)\./i)
        ).toBeInTheDocument()
      })

      expect(window.api.saveProthesisOrder).not.toHaveBeenCalled()
    })

    it('successfully saves complete order with multiple teeth (bridge) and auto-retrieved patient info', async () => {
      const onSuccess = vi.fn()
      const onClose = vi.fn()

      render(
        <ToastProvider>
          <ToastContainer />
          <NewProthesisOrderModal
            isOpen={true}
            onClose={onClose}
            onSuccess={onSuccess}
            initialPatient={samplePatient}
          />
        </ToastProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('BELKACEM Nadia')).toBeInTheDocument()
      })

      // Select teeth 21 and 22
      fireEvent.click(screen.getByTitle('Dent 21 (Cadran 2 - Haut Gauche)'))
      fireEvent.click(screen.getByTitle('Dent 22 (Cadran 2 - Haut Gauche)'))

      // Select shade A2
      fireEvent.click(screen.getByRole('button', { name: 'Teinte A2' }))

      // Submit order
      const submitBtn = screen.getByRole('button', { name: /Créer la Commande & Bon Labo/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(window.api.saveProthesisOrder).toHaveBeenCalledWith(
          expect.objectContaining({
            patientId: samplePatient.id,
            patientName: 'BELKACEM Nadia',
            labId: sampleLab.id,
            toothNumber: 21,
            teeth: '21, 22',
            shade: 'A2'
          })
        )
      })

      expect(onSuccess).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })
})
