import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ToastProvider } from '@renderer/context/ToastContext'
import ToastContainer from '@renderer/features/common/ToastContainer'
import { NavigationProvider, useNavigation } from '@renderer/context/NavigationContext'
import FullCalendarView from '@renderer/features/planning/FullCalendarView'
import PrescriptionBuilder from '@renderer/features/prescriptions/PrescriptionBuilder'
import DebtsManager from '@renderer/features/billing/DebtsManager'

import { validateAlgerianPhone, validateFutureDateTime } from '@renderer/utils/validators'
import { findConflictingAppointment } from '@renderer/utils/appointmentConflicts'
import { patientService } from '@renderer/services/patientService'
import { appointmentService } from '@renderer/services/appointmentService'
import { drugService } from '@renderer/services/drugService'
import { billingService } from '@renderer/services/billingService'

import { Patient, Appointment, Invoice, DrugItem, PrescriptionTemplate } from '@shared/types'

// Navigation Controller to capture live NavigationContext
const NavigationController: React.FC<{
  onNavChange: (nav: ReturnType<typeof useNavigation>) => void
}> = ({ onNavChange }) => {
  const nav = useNavigation()

  React.useEffect(() => {
    onNavChange(nav)
  }, [nav, onNavChange])

  return null
}

// Unified Clinical Application Harness preserving Context across all steps
interface AppHarnessProps {
  activeView: 'none' | 'calendar' | 'rx' | 'debts'
  patient?: Patient
  onNavChange: (nav: ReturnType<typeof useNavigation>) => void
}

const AppHarness: React.FC<AppHarnessProps> = ({ activeView, patient, onNavChange }) => {
  return React.createElement(
    ToastProvider,
    null,
    React.createElement(ToastContainer, null),
    React.createElement(
      NavigationProvider,
      null,
      React.createElement(NavigationController, { onNavChange }),
      activeView === 'calendar' && React.createElement(FullCalendarView, null),
      activeView === 'rx' &&
        patient &&
        React.createElement(PrescriptionBuilder, {
          patient,
          dentistName: 'Dr. Mohamed Amrani'
        }),
      activeView === 'debts' && React.createElement(DebtsManager, null)
    )
  )
}

describe('Update 1 - End-to-End Comprehensive Clinical Lifecycle Flow', () => {
  let createdPatient: Patient
  let createdAppointment: Appointment
  let createdInvoice: Invoice
  let currentNav: ReturnType<typeof useNavigation>

  // Stateful in-memory database mock for the lifecycle
  let dbPatients: Patient[] = []
  let dbAppointments: Appointment[] = []
  let dbInvoices: Invoice[] = []
  let dbDrugs: DrugItem[] = [
    {
      id: 'drug-amox-1',
      brandName: 'Amoxicilline',
      genericName: 'Amoxicilline trihydratée',
      dosage: '1g',
      form: 'Comprimé',
      defaultInstructions: '1 cp matin et soir pendant 6 jours',
      category: 'Antibiotique',
      isCustom: 0
    },
    {
      id: 'drug-para-2',
      brandName: 'Paracétamol',
      genericName: 'Paracétamol',
      dosage: '1g',
      form: 'Comprimé',
      defaultInstructions: '1 cp toutes les 6 heures en cas de douleur',
      category: 'Antalgique',
      isCustom: 0
    }
  ]
  let dbTemplates: PrescriptionTemplate[] = [
    {
      id: 'tpl-avulsion-01',
      title: "Suite d'avulsion chirurgicale",
      diagnosisHint: 'Soins post-extraction de dents de sagesse incluses',
      itemsJson: JSON.stringify([
        {
          medicineName: 'Amoxicilline',
          dosage: '1g',
          form: 'Comprimé',
          instructions: '1 cp matin et soir pendant 6 jours'
        },
        {
          medicineName: 'Paracétamol',
          dosage: '1g',
          form: 'Comprimé',
          instructions: '1 cp toutes les 6 heures en cas de douleur'
        }
      ]),
      createdAt: '2026-01-01'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    dbPatients = []
    dbAppointments = []
    dbInvoices = []

    // 1. Patients API
    window.api.getPatients = vi.fn().mockImplementation(() => Promise.resolve(dbPatients))
    window.api.getPatientById = vi.fn().mockImplementation((id: string) => {
      const found = dbPatients.find((p) => p.id === id) || null
      return Promise.resolve(found)
    })
    window.api.savePatient = vi.fn().mockImplementation((pData: any) => {
      const year = new Date().getFullYear()
      const seq = String(dbPatients.length + 1).padStart(4, '0')
      const patient: Patient = {
        id: pData.id || `pat_${Date.now()}`,
        patientNumber: pData.patientNumber || `DZ-${year}-${seq}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...pData
      }
      dbPatients = [...dbPatients.filter((p) => p.id !== patient.id), patient]
      return Promise.resolve(patient)
    })

    // 2. Appointments API
    window.api.getAppointments = vi.fn().mockImplementation(() => Promise.resolve(dbAppointments))
    window.api.saveAppointment = vi.fn().mockImplementation((aptData: any) => {
      const apt: Appointment = {
        id: aptData.id || `apt_${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...aptData
      }
      dbAppointments = [...dbAppointments.filter((a) => a.id !== apt.id), apt]
      return Promise.resolve(apt)
    })
    window.api.updateAppointmentStatus = vi.fn().mockImplementation((id: string, status: any) => {
      dbAppointments = dbAppointments.map((a) => (a.id === id ? { ...a, status } : a))
      return Promise.resolve(true)
    })

    // 3. Drugs & Templates API
    window.api.getDrugsCatalog = vi.fn().mockImplementation(() => Promise.resolve(dbDrugs))
    window.api.saveDrug = vi.fn().mockImplementation((dData: any) => {
      const drug: DrugItem = {
        id: dData.id || `drug_${Date.now()}`,
        createdAt: new Date().toISOString(),
        ...dData
      }
      dbDrugs = [...dbDrugs, drug]
      return Promise.resolve(drug)
    })
    window.api.getPrescriptionTemplates = vi.fn().mockImplementation(() => Promise.resolve(dbTemplates))
    window.api.getPrescriptions = vi.fn().mockImplementation(() => Promise.resolve([]))
    window.api.savePrescription = vi.fn().mockImplementation((rxData: any) => {
      return Promise.resolve({
        id: `rx_${Date.now()}`,
        createdAt: new Date().toISOString(),
        ...rxData
      })
    })

    // 4. Invoices & Payments API
    window.api.getInvoices = vi.fn().mockImplementation((patientId?: string) => {
      if (patientId) {
        return Promise.resolve(dbInvoices.filter((i) => i.patientId === patientId))
      }
      return Promise.resolve(dbInvoices)
    })
    window.api.saveInvoice = vi.fn().mockImplementation((invData: any) => {
      const year = new Date().getFullYear()
      const seq = String(dbInvoices.length + 1).padStart(4, '0')
      const totalAmount = invData.totalAmount || 0
      const paidAmount = invData.paidAmount || 0
      const remainingAmount = Math.max(0, totalAmount - paidAmount)
      const status = remainingAmount === 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'PENDING'

      const invoice: Invoice = {
        id: invData.id || `inv_${Date.now()}`,
        invoiceNumber: invData.invoiceNumber || `FAC-${year}-${seq}`,
        totalAmount,
        paidAmount,
        remainingAmount,
        status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...invData
      }
      dbInvoices = [...dbInvoices.filter((i) => i.id !== invoice.id), invoice]
      return Promise.resolve(invoice)
    })
    window.api.recordPayment = vi.fn().mockImplementation((payData: any) => {
      if (payData.invoiceId) {
        dbInvoices = dbInvoices.map((inv) => {
          if (inv.id === payData.invoiceId) {
            const newPaid = inv.paidAmount + payData.amount
            const newRemaining = Math.max(0, inv.totalAmount - newPaid)
            const newStatus = newRemaining === 0 ? 'PAID' : 'PARTIAL'
            return { ...inv, paidAmount: newPaid, remainingAmount: newRemaining, status: newStatus }
          }
          return inv
        })
      }
      return Promise.resolve({
        id: `pay_${Date.now()}`,
        createdAt: new Date().toISOString(),
        ...payData
      })
    })
  })

  // =========================================================================
  // MASTER TEST: ALL 6 STEPS OF UPDATE 1
  // =========================================================================
  it('orchestrates the entire clinical lifecycle across all 6 sequential steps', async () => {
    // Mount the Application Harness with continuous NavigationProvider
    const { rerender } = render(
      React.createElement(AppHarness, {
        activeView: 'none',
        onNavChange: (nav) => {
          currentNav = nav
        }
      })
    )

    // Initial state check
    expect(currentNav.currentLocation.tab).toBe('dashboard')
    expect(currentNav.canGoBack).toBe(false)

    // -----------------------------------------------------------------------
    // الخطوة 1: التحقق من صحة هاتف المريض وتسجيل مريض جديد (Yacine Benali, 0555123456, Alger)
    // -----------------------------------------------------------------------
    const validPhone = '0555123456'
    const phoneValidation = validateAlgerianPhone(validPhone)
    expect(phoneValidation.isValid).toBe(true)

    // Verify invalid phone rejection
    expect(validateAlgerianPhone('0123456789').isValid).toBe(false)
    expect(validateAlgerianPhone('055').isValid).toBe(false)

    // Save patient in the clinic system
    createdPatient = await patientService.savePatient({
      firstName: 'Yacine',
      lastName: 'Benali',
      phone: validPhone,
      wilaya: 'Alger'
    })

    expect(createdPatient.id).toBeDefined()
    expect(createdPatient.firstName).toBe('Yacine')
    expect(createdPatient.lastName).toBe('Benali')
    expect(createdPatient.patientNumber).toBe('DZ-2026-0001')
    expect(dbPatients).toHaveLength(1)

    // -----------------------------------------------------------------------
    // الخطوة 2: الانتقال عبر NavigationContext وحجز موعد مستقبلي دون أي تعارض زمني
    // -----------------------------------------------------------------------
    // Compute next Saturday (start of next Algerian clinic week)
    const now = new Date()
    const dayOfWeek = now.getDay()
    const diffToSaturday = (dayOfWeek + 1) % 7
    const currentSaturday = new Date(now)
    currentSaturday.setDate(now.getDate() - diffToSaturday)

    const nextSaturday = new Date(currentSaturday)
    nextSaturday.setDate(currentSaturday.getDate() + 7)
    const pad = (n: number) => String(n).padStart(2, '0')
    const futureIsoDate = `${nextSaturday.getFullYear()}-${pad(nextSaturday.getMonth() + 1)}-${pad(
      nextSaturday.getDate()
    )}`
    const appointmentSlot = `${futureIsoDate}T10:00:00`

    // Validate strictly future date & time
    const dateValidation = validateFutureDateTime(appointmentSlot)
    expect(dateValidation.isValid).toBe(true)

    // Conflict detection engine ensures Dr. Amrani is free
    const conflict = findConflictingAppointment(
      {
        dateTime: appointmentSlot,
        durationMinutes: 30,
        dentistName: 'Dr. Mohamed Amrani'
      },
      dbAppointments
    )
    expect(conflict).toBeNull()

    // Save appointment
    createdAppointment = await appointmentService.saveAppointment({
      patientId: createdPatient.id,
      patientName: `${createdPatient.firstName} ${createdPatient.lastName}`,
      patientPhone: createdPatient.phone,
      dateTime: appointmentSlot,
      durationMinutes: 30,
      treatmentType: 'Consultation & Soins dentaires',
      status: 'CONFIRMED',
      dentistName: 'Dr. Mohamed Amrani',
      notes: 'Premier rendez-vous de bilan'
    })

    expect(createdAppointment.id).toBeDefined()
    expect(createdAppointment.patientName).toBe('Yacine Benali')
    expect(dbAppointments).toHaveLength(1)

    // -----------------------------------------------------------------------
    // الخطوة 3: إطلاق Toast بنجاح الحجز وظهوره في شبكة الأسبوع للتقويم
    // -----------------------------------------------------------------------
    act(() => {
      currentNav.goToTab('appointments')
    })
    expect(currentNav.currentLocation.tab).toBe('appointments')

    // Switch view to Calendar
    rerender(
      React.createElement(AppHarness, {
        activeView: 'calendar',
        onNavChange: (nav) => {
          currentNav = nav
        }
      })
    )

    await waitFor(() => {
      expect(screen.queryByText(/Chargement du calendrier/i)).not.toBeInTheDocument()
    })

    // Advance calendar by one week to show next Saturday's grid
    const nextWeekBtn = screen.getByTitle('Période suivante')
    fireEvent.click(nextWeekBtn)

    // Appointment card for Yacine Benali appears in the calendar
    await waitFor(() => {
      expect(screen.getAllByText('Yacine Benali').length).toBeGreaterThanOrEqual(1)
    })

    // Status styling is CONFIRMED (emerald green)
    const patientCard = screen.getAllByText('Yacine Benali')[0].closest('div[class*="rounded-lg"]')
    expect(patientCard?.className).toContain('bg-emerald-50')
    expect(patientCard?.className).toContain('border-emerald-300')

    // -----------------------------------------------------------------------
    // الخطوة 4: فتح ملف المريض ووصف أدوية عبر PrescriptionBuilder
    // وحفظ دواء إضافي في القاموس
    // -----------------------------------------------------------------------
    // 1. Add a custom drug to the Algerian dental drugs catalog
    const customDrug = await drugService.saveDrug({
      brandName: 'Ibuprofène El Kendi',
      genericName: 'Ibuprofène',
      dosage: '400mg',
      form: 'Comprimé pelliculé',
      defaultInstructions: '1 cp 3 fois par jour au cours des repas',
      category: 'Anti-inflammatoire',
      isCustom: 1
    })

    expect(customDrug.id).toBeDefined()
    expect(customDrug.brandName).toBe('Ibuprofène El Kendi')
    expect(customDrug.isCustom).toBe(1)
    expect(dbDrugs).toHaveLength(3)

    // 2. Open patient file in navigation
    act(() => {
      currentNav.openPatient(createdPatient, 'prescriptions')
    })
    expect(currentNav.currentLocation.type).toBe('patient')
    expect(currentNav.currentLocation.patient?.id).toBe(createdPatient.id)

    // Switch view to PrescriptionBuilder
    rerender(
      React.createElement(AppHarness, {
        activeView: 'rx',
        patient: createdPatient,
        onNavChange: (nav) => {
          currentNav = nav
        }
      })
    )

    // Open prescription modal
    const openRxModalBtn = await screen.findByRole('button', { name: /\+ Rédiger une Ordonnance/i })
    fireEvent.click(openRxModalBtn)

    await waitFor(() => {
      expect(screen.getByText(/Gabarits d'ordonnances types/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/Catalogue Rapide/i)).toBeInTheDocument()

    // 1) Apply ready template (tpl-avulsion-01: Suite d'avulsion chirurgicale)
    const templateSelect = await screen.findByRole('combobox')
    fireEvent.change(templateSelect, { target: { value: 'tpl-avulsion-01' } })

    // Verify template items appear in the prescription table
    expect(screen.getAllByText(/Amoxicilline/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Paracétamol/i).length).toBeGreaterThanOrEqual(1)

    // 2) Switch to Tab 2: Nouveau Médicament (Saisie Libre) to save an additional drug into the catalog dictionary
    const customTabBtn = screen.getByRole('button', { name: /Nouveau Médicament/i })
    fireEvent.click(customTabBtn)

    expect(screen.getByText(/Saisie libre d'un nouveau médicament/i)).toBeInTheDocument()

    const nameInput = screen.getByPlaceholderText(/Ex: Dexon, Clamoxyl, Solupred/i)
    const dosageInput = screen.getByPlaceholderText(/Ex: 4mg, 1g, 500mg/i)
    const instructionsInput = screen.getByPlaceholderText(/Ex: 1 cp 3 fois par jour/i)

    fireEvent.change(nameInput, { target: { value: 'Flagyl' } })
    fireEvent.change(dosageInput, { target: { value: '500mg' } })
    fireEvent.change(instructionsInput, { target: { value: '1 comprimé matin et soir pendant 5 jours' } })

    const permanentCheckbox = screen.getByRole('checkbox', {
      name: /Ajouter à mon catalogue permanent/i
    })
    expect(permanentCheckbox).toBeChecked()

    const addCustomBtn = screen.getByRole('button', { name: /Ajouter à l'ordonnance/i })
    fireEvent.click(addCustomBtn)

    await waitFor(() => {
      expect(window.api.saveDrug).toHaveBeenCalledWith(
        expect.objectContaining({
          brandName: 'Flagyl',
          dosage: '500mg',
          isCustom: 1
        })
      )
    })

    expect(screen.getByText('Flagyl')).toBeInTheDocument()
    expect(dbDrugs.some((d) => d.brandName === 'Flagyl')).toBe(true)

    // -----------------------------------------------------------------------
    // الخطوة 5: إنشاء فاتورة بقيمة 25,000 DA، تسجيل دفعة أولى 15,000 DA نقداً،
    // والتحقق من ترحيل 10,000 DA المتبقية إلى قائمة الديون DebtsManager
    // -----------------------------------------------------------------------
    createdInvoice = await billingService.saveInvoice({
      patientId: createdPatient.id,
      patientName: `${createdPatient.firstName} ${createdPatient.lastName}`,
      date: '2026-10-15',
      totalAmount: 25000,
      paidAmount: 15000,
      paymentMethod: 'CASH',
      itemsJson: JSON.stringify([
        { description: 'Traitement canalaire complet', quantity: 1, unitPrice: 15000, amount: 15000 },
        { description: 'Reconstitution composite', quantity: 1, unitPrice: 10000, amount: 10000 }
      ])
    })

    expect(createdInvoice.totalAmount).toBe(25000)
    expect(createdInvoice.paidAmount).toBe(15000)
    expect(createdInvoice.remainingAmount).toBe(10000) // 25,000 - 15,000 = 10,000 DA
    expect(createdInvoice.status).toBe('PARTIAL')

    // Navigate to Debts view
    act(() => {
      currentNav.goToTab('debts')
    })
    expect(currentNav.currentLocation.tab).toBe('debts')

    // Switch view to DebtsManager
    rerender(
      React.createElement(AppHarness, {
        activeView: 'debts',
        onNavChange: (nav) => {
          currentNav = nav
        }
      })
    )

    await waitFor(() => {
      expect(screen.getByText(/Gestion des Créances & Dettes Patients/i)).toBeInTheDocument()
    })

    // Yacine Benali appears in the debtor list with 10,000 DA remaining debt
    expect(screen.getByText('Yacine Benali')).toBeInTheDocument()
    expect(screen.getByText('0555123456')).toBeInTheDocument()
    expect(screen.getAllByText(/10[\s,.]?000.*DA/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/1 patients débiteurs/i)).toBeInTheDocument()

    // -----------------------------------------------------------------------
    // الخطوة 6: استخدام أزرار التنقل [السابق ⬅] للرجوع عبر سجل التصفح
    // والتأكد من سلامة مكدس الـ LIFO
    // -----------------------------------------------------------------------
    // History sequence was:
    // 0: dashboard
    // 1: appointments
    // 2: patient (Yacine Benali - Ordonnances)
    // 3: debts (current)
    expect(currentNav.currentLocation.tab).toBe('debts')
    expect(currentNav.canGoBack).toBe(true)

    // Back step 1 -> Returns to Patient File (Yacine Benali)
    act(() => {
      currentNav.goBack()
    })
    expect(currentNav.currentLocation.type).toBe('patient')
    expect(currentNav.currentLocation.patient?.id).toBe(createdPatient.id)
    expect(currentNav.canGoBack).toBe(true)
    expect(currentNav.canGoForward).toBe(true)

    // Back step 2 -> Returns to Appointments tab
    act(() => {
      currentNav.goBack()
    })
    expect(currentNav.currentLocation.tab).toBe('appointments')
    expect(currentNav.canGoBack).toBe(true)
    expect(currentNav.canGoForward).toBe(true)

    // Back step 3 -> Returns to initial Dashboard
    act(() => {
      currentNav.goBack()
    })
    expect(currentNav.currentLocation.tab).toBe('dashboard')
    expect(currentNav.canGoBack).toBe(false) // At root of stack

    // Forward step 1 -> Advances back to Appointments
    act(() => {
      currentNav.goForward()
    })
    expect(currentNav.currentLocation.tab).toBe('appointments')
    expect(currentNav.canGoBack).toBe(true)

    // Forward step 2 -> Advances back to Patient File
    act(() => {
      currentNav.goForward()
    })
    expect(currentNav.currentLocation.type).toBe('patient')
    expect(currentNav.currentLocation.patient?.id).toBe(createdPatient.id)
  })
})
