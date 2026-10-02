import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ToastProvider } from '@renderer/context/ToastContext'
import ToastContainer from '@renderer/features/common/ToastContainer'
import { NavigationProvider } from '@renderer/context/NavigationContext'
import PrintablePatientFile from '@renderer/features/patients/PrintablePatientFile'
import PatientOverview from '@renderer/features/patients/PatientOverview'
import { Patient, Treatment } from '@shared/types'

// Mock Electron window.api
const mockPatient: Patient = {
  id: 'pat-print-101',
  patientNumber: 'DZ-2026-0042',
  firstName: 'Farid',
  lastName: 'Zidane',
  phone: '0550123456',
  dateOfBirth: '1990-05-15',
  gender: 'M',
  bloodGroup: 'O+',
  wilaya: '16 - Alger',
  cin: '1600123456',
  medicalAlerts: 'Allergie Pénicilline',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01'
}

const mockTreatments: Treatment[] = [
  {
    id: 'trt-1',
    patientId: 'pat-print-101',
    toothNumber: 16,
    actName: 'Dévitalisation molaire 16',
    price: 15000,
    status: 'COMPLETED',
    date: '2026-09-10',
    createdAt: '2026-09-10',
    updatedAt: '2026-09-10'
  }
]

describe('PrintablePatientFile & Official Clinic Header Print View', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.api.getTreatments = vi.fn().mockResolvedValue(mockTreatments)
    window.api.getClinicalNotes = vi.fn().mockResolvedValue([])
    window.api.getPrescriptions = vi.fn().mockResolvedValue([])
    window.api.getInvoices = vi.fn().mockResolvedValue([])
    window.api.getPatientMedicalHistory = vi.fn().mockResolvedValue(null)
    window.api.printDocument = vi.fn().mockResolvedValue(true)
    window.api.exportToPDF = vi.fn().mockResolvedValue({ success: true, filePath: 'C:/docs/dossier.pdf' })
  })

  // =========================================================================
  // 1. الهيدر الرسمي للعيادة في ملف الطباعة
  // =========================================================================
  describe('1. Official Clinic Header Specifications', () => {
    it('renders the official clinic header with practitioner, clinic name, order number and Algerian contact details', async () => {
      render(
        <ToastProvider>
          <PrintablePatientFile patient={mockPatient} onClose={vi.fn()} />
        </ToastProvider>
      )

      await waitFor(() => {
        // Practitioner name & qualification
        expect(screen.getByText(/Dr Mohamed Amrani - Chirurgien-Dentiste/i)).toBeInTheDocument()
        // Clinic title
        expect(screen.getByText('Cabinet Dentaire Médico-Chirurgical DentaFlow')).toBeInTheDocument()
        // Ordre des dentistes
        expect(screen.getByText(/N° Ordre des Dentistes: 16\/XXXX/i)).toBeInTheDocument()
        // Address & Algerian Phone
        expect(screen.getByText(/14, Boulevard Colonel Amirouche, Alger Centre, 16000 Alger/i)).toBeInTheDocument()
        expect(screen.getByText('0550 12 34 56')).toBeInTheDocument()
        expect(screen.getByText('021 65 43 21')).toBeInTheDocument()
      })
    })
  })

  // =========================================================================
  // 2. الحساب الدقيق لبيانات المريض والعمر الديناميكي
  // =========================================================================
  describe('2. Patient Identity & Dynamic Age Calculation', () => {
    it('accurately calculates and displays patient age dynamically from date of birth (e.g., 36 ans)', async () => {
      render(
        <ToastProvider>
          <PrintablePatientFile patient={mockPatient} onClose={vi.fn()} />
        </ToastProvider>
      )

      await waitFor(() => {
        // Patient Name & Number
        expect(screen.getByText('Farid Zidane')).toBeInTheDocument()
        expect(screen.getByText(/DZ-2026-0042/)).toBeInTheDocument()
        // Blood Group
        expect(screen.getByText(/Groupe Sanguin : O\+/)).toBeInTheDocument()
        // Dynamic age calculation (1990-05-15 in 2026 = 36 ans)
        expect(screen.getByText(/36 ans/i)).toBeInTheDocument()
        // Medical alerts badge (formatted as Allergie Majeure : Pénicilline)
        expect(screen.getByText(/Pénicilline/i)).toBeInTheDocument()
      })
    })
  })

  // =========================================================================
  // 3. التذييل ومنطقة الختم والسر الطبي
  // =========================================================================
  describe('3. Footer, Legal Medical Secret & Zone Cachet et Signature', () => {
    it('displays the legal medical secret text and dedicated doctor signature zone', async () => {
      render(
        <ToastProvider>
          <PrintablePatientFile patient={mockPatient} onClose={vi.fn()} />
        </ToastProvider>
      )

      await waitFor(() => {
        // Legal medical secret
        expect(screen.getByText(/Document Médical Confidentiel · Secret Médical Légal/i)).toBeInTheDocument()
        expect(screen.getByText(/Article 206 du Code de Déontologie Médicale/i)).toBeInTheDocument()

        // Zone Cachet et Signature
        expect(screen.getByText('Zone Cachet et Signature')).toBeInTheDocument()
        expect(screen.getByText(/Dr Mohamed Amrani · Chirurgien-Dentiste/i)).toBeInTheDocument()
      })
    })
  })

  // =========================================================================
  // 4. اختصار لوحة المفاتيح Ctrl+P
  // =========================================================================
  describe('4. Keyboard Shortcut Ctrl+P Interception', () => {
    it('opens PrintablePatientFile modal when Ctrl+P or Cmd+P is pressed in PatientOverview', async () => {
      render(
        <NavigationProvider>
          <ToastProvider>
            <ToastContainer />
            <PatientOverview
              patient={mockPatient}
              onPatientUpdated={vi.fn()}
              onBack={vi.fn()}
            />
          </ToastProvider>
        </NavigationProvider>
      )

      // Initially, print modal is not open
      expect(screen.queryByText('Aperçu avant Impression — Dossier Médical Patient (Format A4)')).not.toBeInTheDocument()

      // Fire Ctrl+P keydown event
      fireEvent.keyDown(window, {
        key: 'p',
        ctrlKey: true
      })

      // The print modal should open
      await waitFor(() => {
        expect(screen.getByText('Aperçu avant Impression — Dossier Médical Patient (Format A4)')).toBeInTheDocument()
      })

      // Official header elements are present
      expect(screen.getByText(/Dr Mohamed Amrani - Chirurgien-Dentiste/i)).toBeInTheDocument()
      expect(screen.getByText('Cabinet Dentaire Médico-Chirurgical DentaFlow')).toBeInTheDocument()
      expect(screen.getByText('Zone Cachet et Signature')).toBeInTheDocument()
    })
  })
})
