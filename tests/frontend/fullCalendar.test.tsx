import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { NavigationProvider } from '@renderer/context/NavigationContext'
import { ToastProvider } from '@renderer/context/ToastContext'
import ToastContainer from '@renderer/features/common/ToastContainer'
import FullCalendarView from '@renderer/features/planning/FullCalendarView'
import { Appointment, Patient } from '@shared/types'

// Helper to compute Algerian week dates (Saturday to Thursday)
const getTestWeekDates = () => {
  const d = new Date()
  const dayOfWeek = d.getDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diffToSaturday = (dayOfWeek + 1) % 7
  const saturday = new Date(d)
  saturday.setDate(d.getDate() - diffToSaturday)

  const formatIso = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const days = Array.from({ length: 6 }).map((_, i) => {
    const date = new Date(saturday)
    date.setDate(saturday.getDate() + i)
    return {
      date,
      iso: formatIso(date)
    }
  })

  return {
    saturdayIso: days[0].iso,
    sundayIso: days[1].iso,
    mondayIso: days[2].iso,
    tuesdayIso: days[3].iso,
    wednesdayIso: days[4].iso,
    thursdayIso: days[5].iso
  }
}

const { saturdayIso, sundayIso, mondayIso } = getTestWeekDates()

const samplePatient: Patient = {
  id: 'pat-cal-101',
  patientNumber: 'DZ-2026-0042',
  firstName: 'Amine',
  lastName: 'Mansouri',
  phone: '0555112233',
  wilaya: '16 - Alger',
  dateOfBirth: '1990-05-15',
  bloodGroup: 'B+',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01'
}

const sampleAppointments: Appointment[] = [
  {
    id: 'apt-conf-01',
    patientId: samplePatient.id,
    patientName: 'Amine Mansouri',
    patientPhone: '0555112233',
    dateTime: `${saturdayIso}T09:00:00`,
    durationMinutes: 30,
    treatmentType: 'Détartrage & Polissage',
    status: 'CONFIRMED',
    dentistName: 'Dr. Mohamed Amrani',
    notes: 'Patient régulier - RAS'
  },
  {
    id: 'apt-chair-02',
    patientId: 'pat-cal-102',
    patientName: 'Khadidja Belkacem',
    patientPhone: '0666223344',
    dateTime: `${sundayIso}T10:00:00`,
    durationMinutes: 45,
    treatmentType: 'Extraction chirurgicale',
    status: 'IN_CHAIR',
    dentistName: 'Dr. Sarah Benali',
    notes: 'Urgence molaire'
  },
  {
    id: 'apt-canc-03',
    patientId: 'pat-cal-103',
    patientName: 'Sofiane Touati',
    patientPhone: '0777334455',
    dateTime: `${mondayIso}T11:00:00`,
    durationMinutes: 30,
    treatmentType: 'Consultation de contrôle',
    status: 'CANCELLED',
    dentistName: 'Dr. Walid Mansouri',
    notes: 'Annulé par le patient'
  }
]

const renderCalendar = () => {
  return render(
    <ToastProvider>
      <ToastContainer />
      <NavigationProvider>
        <FullCalendarView />
      </NavigationProvider>
    </ToastProvider>
  )
}

describe('FullCalendarView Frontend Tests (Month, Week, Day & Interactivity)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.api.getAppointments = vi.fn().mockResolvedValue(sampleAppointments)
    window.api.getPatients = vi.fn().mockResolvedValue([samplePatient])
    window.api.getPatientById = vi.fn().mockResolvedValue(samplePatient)
    window.api.saveAppointment = vi.fn().mockImplementation((apt) =>
      Promise.resolve({
        id: apt.id || 'new-apt-id',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...apt
      })
    )
    window.api.updateAppointmentStatus = vi.fn().mockResolvedValue(true)
  })

  // =========================================================================
  // 1. اختبار التبديل بين طرق العرض (View Switching: MONTH, WEEK, DAY)
  // =========================================================================
  describe('1. Navigation & View Switching (MONTH, WEEK, DAY)', () => {
    it('starts by default in WEEK view and renders the 6 Algerian working day headers', async () => {
      renderCalendar()

      await waitFor(() => {
        expect(screen.queryByText(/Chargement du calendrier/i)).not.toBeInTheDocument()
      })

      // Algerian working week headers (Saturday to Thursday)
      expect(screen.getByText('Samedi')).toBeInTheDocument()
      expect(screen.getByText('Dimanche')).toBeInTheDocument()
      expect(screen.getByText('Lundi')).toBeInTheDocument()
      expect(screen.getByText('Mardi')).toBeInTheDocument()
      expect(screen.getByText('Mercredi')).toBeInTheDocument()
      expect(screen.getByText('Jeudi')).toBeInTheDocument()

      // Friday (Vendredi) is off in the clinic week view
      expect(screen.queryByText('Vendredi')).not.toBeInTheDocument()

      // Hours column indicator
      expect(screen.getByText('Heure')).toBeInTheDocument()
    })

    it('switches to MONTH view and updates grid structure with 7 Algerian day columns', async () => {
      renderCalendar()

      await waitFor(() => {
        expect(screen.queryByText(/Chargement du calendrier/i)).not.toBeInTheDocument()
      })

      // Click on Month switch button
      const monthBtn = screen.getByRole('button', { name: 'Mois' })
      fireEvent.click(monthBtn)

      // Month view includes Friday (Vendredi) in its 7-column calendar
      expect(screen.getByText('Vendredi')).toBeInTheDocument()
      expect(screen.getByText('Samedi')).toBeInTheDocument()
      expect(screen.getByText('Dimanche')).toBeInTheDocument()

      // The period label should update to "Ce mois"
      expect(screen.getByRole('button', { name: /Ce mois/i })).toBeInTheDocument()
    })

    it('switches to DAY view and renders the single day timeline banner', async () => {
      renderCalendar()

      await waitFor(() => {
        expect(screen.queryByText(/Chargement du calendrier/i)).not.toBeInTheDocument()
      })

      // Click on Day switch button
      const dayBtn = screen.getByRole('button', { name: 'Jour' })
      fireEvent.click(dayBtn)

      // Day view banner elements
      expect(screen.getByText('+ Nouveau Rendez-vous')).toBeInTheDocument()
      expect(screen.getByText(/rendez-vous programmés pour cette journée/i)).toBeInTheDocument()

      // Period label should update to "Aujourd'hui"
      expect(screen.getByRole('button', { name: /Aujourd'hui/i })).toBeInTheDocument()
    })

    it('allows cycling between all views (WEEK -> MONTH -> DAY -> WEEK) seamlessly without errors', async () => {
      renderCalendar()

      await waitFor(() => {
        expect(screen.queryByText(/Chargement du calendrier/i)).not.toBeInTheDocument()
      })

      // WEEK -> MONTH
      fireEvent.click(screen.getByRole('button', { name: 'Mois' }))
      expect(screen.getByText('Vendredi')).toBeInTheDocument()

      // MONTH -> DAY
      fireEvent.click(screen.getByRole('button', { name: 'Jour' }))
      expect(screen.getByText('+ Nouveau Rendez-vous')).toBeInTheDocument()

      // DAY -> WEEK
      fireEvent.click(screen.getByRole('button', { name: 'Semaine' }))
      expect(screen.getByText('Heure')).toBeInTheDocument()
      expect(screen.queryByText('Vendredi')).not.toBeInTheDocument()
    })
  })

  // =========================================================================
  // 2. عرض الشهر (Month View: Algerian Days & Appointment Badges)
  // =========================================================================
  describe('2. Month View (Calculation of days starting on Saturday & Badges)', () => {
    beforeEach(async () => {
      renderCalendar()
      await waitFor(() => {
        expect(screen.queryByText(/Chargement du calendrier/i)).not.toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: 'Mois' }))
    })

    it('displays the 7 Algerian weekday headers starting from Samedi', () => {
      const headers = ['Samedi', 'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']
      headers.forEach((dayName) => {
        expect(screen.getByText(dayName)).toBeInTheDocument()
      })
    })

    it('displays appointment count badges and mini appointment cards on corresponding days', () => {
      // Days with appointments should have "1 RDV" badge
      const rdvBadges = screen.getAllByText('1 RDV')
      expect(rdvBadges.length).toBeGreaterThanOrEqual(1)

      // Mini appointment cards should display patient names
      expect(screen.getByText('Amine Mansouri')).toBeInTheDocument()
      expect(screen.getByText('Khadidja Belkacem')).toBeInTheDocument()
    })

    it('navigates to DAY view when clicking on a day cell', async () => {
      // Click on a day cell that displays "Voir jour →" on hover
      const dayLink = screen.getAllByText('Voir jour →')[0]
      fireEvent.click(dayLink.parentElement || dayLink)

      // Should automatically transition to DAY view
      await waitFor(() => {
        expect(screen.getByText('+ Nouveau Rendez-vous')).toBeInTheDocument()
      })
    })

    it('opens appointment detail modal directly when clicking a mini appointment card in Month view', async () => {
      const patientCard = screen.getByText('Amine Mansouri')
      fireEvent.click(patientCard)

      await waitFor(() => {
        expect(screen.getByText('Détails du Rendez-vous')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Ouvrir Fiche Patient/i })).toBeInTheDocument()
      })
    })
  })

  // =========================================================================
  // 3. عرض الأسبوع (Week View: 6 Columns, Hours Grid & Status Colors)
  // =========================================================================
  describe('3. Week View (6 Working Columns, Hours Grid & Status Color Coding)', () => {
    it('verifies the 6 working day columns and time slots from 08:00 to 22:00', async () => {
      renderCalendar()

      await waitFor(() => {
        expect(screen.queryByText(/Chargement du calendrier/i)).not.toBeInTheDocument()
      })

      const expectedHours = [
        '08:00', '09:00', '10:00', '11:00', '12:00',
        '13:00', '14:00', '15:00', '16:00', '17:00',
        '18:00', '19:00', '20:00', '21:00', '22:00'
      ]

      expectedHours.forEach((hour) => {
        expect(screen.getAllByText(hour).length).toBeGreaterThan(0)
      })
    })

    it('verifies appointment cards positioning and status color coding', async () => {
      renderCalendar()

      await waitFor(() => {
        expect(screen.queryByText(/Chargement du calendrier/i)).not.toBeInTheDocument()
      })

      // 1. CONFIRMED status card: Green styling (emerald)
      const confirmedPatient = screen.getByText('Amine Mansouri')
      const confirmedCard = confirmedPatient.closest('div[class*="rounded-lg"]')
      expect(confirmedCard).not.toBeNull()
      expect(confirmedCard?.className).toContain('bg-emerald-50')
      expect(confirmedCard?.className).toContain('border-emerald-300')

      // 2. IN_CHAIR status card: Purple styling & ring
      const inChairPatient = screen.getByText('Khadidja Belkacem')
      const inChairCard = inChairPatient.closest('div[class*="rounded-lg"]')
      expect(inChairCard).not.toBeNull()
      expect(inChairCard?.className).toContain('bg-purple-50')
      expect(inChairCard?.className).toContain('border-purple-300')
      expect(inChairCard?.className).toContain('ring-purple-400')

      // 3. CANCELLED status card: Rose background & strikethrough (line-through)
      const cancelledPatient = screen.getByText('Sofiane Touati')
      const cancelledCard = cancelledPatient.closest('div[class*="rounded-lg"]')
      expect(cancelledCard).not.toBeNull()
      expect(cancelledCard?.className).toContain('bg-rose-50')
      expect(cancelledCard?.className).toContain('line-through')
    })
  })

  // =========================================================================
  // 4. التفاعلية (Interactivity: Empty slot & Appointment modal / actions)
  // =========================================================================
  describe('4. Interactivity (Slot Booking & Appointment Action Modal)', () => {
    it('opens NewAppointmentDrawer with pre-filled date & time when clicking an empty slot', async () => {
      renderCalendar()

      await waitFor(() => {
        expect(screen.queryByText(/Chargement du calendrier/i)).not.toBeInTheDocument()
      })

      // Find an empty slot by its title attribute on Samedi at 14:00
      const emptySlot = screen.getByTitle('Cliquer pour réserver le Samedi à 14:00')
      expect(emptySlot).toBeInTheDocument()

      fireEvent.click(emptySlot)

      // The NewAppointmentDrawer should open
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Nouveau Rendez-vous' })).toBeInTheDocument()
      })

      // The date-time input should have the preselected hour 14:00
      const dateTimeInput = document.querySelector('input[type="datetime-local"]') as HTMLInputElement
      expect(dateTimeInput).not.toBeNull()
      expect(dateTimeInput.value).toContain('14:00')
    })

    it('opens the appointment details modal with [Ouvrir Fiche Patient] and [Modifier] on card click', async () => {
      renderCalendar()

      await waitFor(() => {
        expect(screen.queryByText(/Chargement du calendrier/i)).not.toBeInTheDocument()
      })

      // Click on the existing confirmed appointment
      const appointmentCard = screen.getByText('Amine Mansouri')
      fireEvent.click(appointmentCard)

      // Modal appears
      await waitFor(() => {
        expect(screen.getByText('Détails du Rendez-vous')).toBeInTheDocument()
      })

      // Both requested action buttons must be available
      const openPatientBtn = screen.getByRole('button', { name: /Ouvrir Fiche Patient/i })
      const modifyBtn = screen.getByRole('button', { name: /Modifier \/ Déplacer/i })

      expect(openPatientBtn).toBeInTheDocument()
      expect(modifyBtn).toBeInTheDocument()
    })

    it('opens the Edit/Reschedule modal when clicking [Modifier / Déplacer]', async () => {
      renderCalendar()

      await waitFor(() => {
        expect(screen.queryByText(/Chargement du calendrier/i)).not.toBeInTheDocument()
      })

      // Open detail modal
      fireEvent.click(screen.getByText('Amine Mansouri'))

      await waitFor(() => {
        expect(screen.getByText('Détails du Rendez-vous')).toBeInTheDocument()
      })

      // Click Modifier / Déplacer
      const modifyBtn = screen.getByRole('button', { name: /Modifier \/ Déplacer/i })
      fireEvent.click(modifyBtn)

      // Edit modal should open
      await waitFor(() => {
        expect(screen.getByText('Modifier / Déplacer le Rendez-vous')).toBeInTheDocument()
      })

      // Edit modal inputs
      expect(screen.getByText(/Nouvelle Date & Heure/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeInTheDocument()
    })

    it('triggers patient file navigation when clicking [Ouvrir Fiche Patient]', async () => {
      renderCalendar()

      await waitFor(() => {
        expect(screen.queryByText(/Chargement du calendrier/i)).not.toBeInTheDocument()
      })

      // Open detail modal
      fireEvent.click(screen.getByText('Amine Mansouri'))

      await waitFor(() => {
        expect(screen.getByText('Détails du Rendez-vous')).toBeInTheDocument()
      })

      // Click Ouvrir Fiche Patient
      const openPatientBtn = screen.getByRole('button', { name: /Ouvrir Fiche Patient/i })
      fireEvent.click(openPatientBtn)

      // Toast notification confirms patient file opened
      await waitFor(() => {
        expect(screen.getByText(/Dossier patient ouvert/i)).toBeInTheDocument()
      })
    })

    it('filters appointments when changing the status filter dropdown', async () => {
      renderCalendar()

      await waitFor(() => {
        expect(screen.queryByText(/Chargement du calendrier/i)).not.toBeInTheDocument()
      })

      const statusSelect = screen.getByRole('combobox')

      // Filter by 'CONFIRMED' only
      fireEvent.change(statusSelect, { target: { value: 'CONFIRMED' } })

      // Confirmed appointment should be visible
      expect(screen.getByText('Amine Mansouri')).toBeInTheDocument()

      // Other appointments should be filtered out
      expect(screen.queryByText('Khadidja Belkacem')).not.toBeInTheDocument()
      expect(screen.queryByText('Sofiane Touati')).not.toBeInTheDocument()

      // Reset to ALL
      fireEvent.change(statusSelect, { target: { value: 'ALL' } })
      expect(screen.getByText('Khadidja Belkacem')).toBeInTheDocument()
      expect(screen.getByText('Sofiane Touati')).toBeInTheDocument()
    })

    it('opens NewAppointmentDrawer with pre-filled date & time when clicking available slot in DAY view', async () => {
      renderCalendar()

      await waitFor(() => {
        expect(screen.queryByText(/Chargement du calendrier/i)).not.toBeInTheDocument()
      })

      // Switch to Day view
      fireEvent.click(screen.getByRole('button', { name: 'Jour' }))

      // Click on an available slot button (e.g. 15:00)
      const slotBtn = screen.getByRole('button', { name: /Créneau disponible à 15:00/i })
      expect(slotBtn).toBeInTheDocument()
      fireEvent.click(slotBtn)

      // Drawer should open with 15:00
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Nouveau Rendez-vous' })).toBeInTheDocument()
      })

      const dateTimeInput = document.querySelector('input[type="datetime-local"]') as HTMLInputElement
      expect(dateTimeInput.value).toContain('15:00')
    })
  })
})
