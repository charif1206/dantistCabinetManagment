import React, { useState, useEffect, useMemo } from 'react'
import { Appointment, Patient } from '@shared/types'
import { appointmentService } from '../../services/appointmentService'
import { patientService } from '../../services/patientService'
import { useNavigation } from '../../context/NavigationContext'
import { useToast } from '../../context/ToastContext'
import { validateFutureDateTime } from '../../utils/validators'
import {
  canTransitionTo,
  getAllowedTransitions,
  isTerminalStatus,
  STATUS_CONFIG
} from '../../utils/appointmentTransitions'
import NewAppointmentDrawer from './NewAppointmentDrawer'

export type CalendarViewMode = 'MONTH' | 'WEEK' | 'DAY'

const CLINIC_DENTISTS = [
  'Dr. Mohamed Amrani',
  'Dr. Sarah Benali',
  'Dr. Walid Mansouri'
]

const HOURS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
]

const ALGERIAN_WEEKDAYS = [
  { key: 6, label: 'Samedi', short: 'Sam' },
  { key: 0, label: 'Dimanche', short: 'Dim' },
  { key: 1, label: 'Lundi', short: 'Lun' },
  { key: 2, label: 'Mardi', short: 'Mar' },
  { key: 3, label: 'Mercredi', short: 'Mer' },
  { key: 4, label: 'Jeudi', short: 'Jeu' },
  { key: 5, label: 'Vendredi', short: 'Ven' }
]

export default function FullCalendarView(): JSX.Element {
  const { openPatient } = useNavigation()
  const { showToast } = useToast()

  const [viewMode, setViewMode] = useState<CalendarViewMode>('WEEK')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  // Modals & Drawers state
  const [showNewDrawer, setShowNewDrawer] = useState<boolean>(false)
  const [newDrawerInitialDate, setNewDrawerInitialDate] = useState<string | undefined>(undefined)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [isEditingAppointment, setIsEditingAppointment] = useState<boolean>(false)

  // Edit / Reschedule state
  const [editDateTime, setEditDateTime] = useState<string>('')
  const [editDuration, setEditDuration] = useState<number>(30)
  const [editStatus, setEditStatus] = useState<Appointment['status']>('SCHEDULED')
  const [editDentist, setEditDentist] = useState<string>('Dr. Mohamed Amrani')
  const [editTreatment, setEditTreatment] = useState<string>('Consultation & Soins dentaires')
  const [editNotes, setEditNotes] = useState<string>('Rendez-vous confirmé par téléphone avec le patient')
  const [editDateTimeError, setEditDateTimeError] = useState<string>('')
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false)

  // Load appointments from backend
  const loadAppointments = async (): Promise<void> => {
    try {
      const data = await appointmentService.getAppointments()
      setAppointments(data)
    } catch (err) {
      console.error('Failed to load appointments:', err)
      showToast('Erreur lors du chargement des rendez-vous', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAppointments()
  }, [])

  // Filtered appointments by status
  const filteredAppointments = useMemo(() => {
    if (statusFilter === 'ALL') return appointments
    return appointments.filter((a) => a.status === statusFilter)
  }, [appointments, statusFilter])

  // Navigation handlers
  const handlePrev = (): void => {
    const d = new Date(currentDate)
    if (viewMode === 'MONTH') {
      d.setMonth(d.getMonth() - 1)
    } else if (viewMode === 'WEEK') {
      d.setDate(d.getDate() - 7)
    } else {
      d.setDate(d.getDate() - 1)
    }
    setCurrentDate(d)
  }

  const handleNext = (): void => {
    const d = new Date(currentDate)
    if (viewMode === 'MONTH') {
      d.setMonth(d.getMonth() + 1)
    } else if (viewMode === 'WEEK') {
      d.setDate(d.getDate() + 7)
    } else {
      d.setDate(d.getDate() + 1)
    }
    setCurrentDate(d)
  }

  const handleToday = (): void => {
    setCurrentDate(new Date())
  }

  // Format date helper: YYYY-MM-DD
  const formatIsoDate = (d: Date): string => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const todayIso = formatIsoDate(new Date())

  // Open full patient file (LIFO stack navigation)
  const handleOpenPatientFile = async (apt: Appointment): Promise<void> => {
    setSelectedAppointment(null)
    try {
      if (apt.patientId && apt.patientId !== 'quick_patient') {
        const found = await patientService.getPatientById(apt.patientId)
        if (found) {
          openPatient(found, 'overview')
          showToast(`Dossier patient ouvert : ${found.firstName} ${found.lastName}`, 'info')
          return
        }
      }
    } catch (err) {
      console.error('Failed to get patient details:', err)
    }

    // Fallback patient object
    const names = (apt.patientName || 'Patient').split(' ')
    const fallbackPatient: Patient = {
      id: apt.patientId || `pat_${Date.now()}`,
      patientNumber: 'DZ-PAT',
      firstName: names[0] || apt.patientName,
      lastName: names.slice(1).join(' ') || '',
      phone: apt.patientPhone || '',
      gender: 'M',
      wilaya: 'Alger',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    openPatient(fallbackPatient, 'overview')
    showToast(`Dossier patient ouvert : ${apt.patientName}`, 'info')
  }

  // Quick Status Update
  const handleStatusUpdate = async (aptId: string, status: Appointment['status']): Promise<void> => {
    const apt = appointments.find((a) => a.id === aptId)
    if (apt && !canTransitionTo(apt.status, status)) {
      showToast(
        `Transition non autorisée : impossible de passer de "${STATUS_CONFIG[apt.status]?.label || apt.status}" à "${STATUS_CONFIG[status]?.label || status}"`,
        'error'
      )
      return
    }
    try {
      await appointmentService.updateStatus(aptId, status)
      await loadAppointments()
      if (selectedAppointment && selectedAppointment.id === aptId) {
        setSelectedAppointment((prev) => (prev ? { ...prev, status } : null))
      }
      showToast(`Statut mis à jour : ${STATUS_CONFIG[status]?.label || status}`, 'success')
    } catch (err) {
      console.error('Failed to update appointment status:', err)
      showToast('Erreur lors de la mise à jour du statut', 'error')
    }
  }

  // Open Edit / Reschedule Modal
  const handleOpenEdit = (apt: Appointment): void => {
    setEditDateTime(apt.dateTime ? apt.dateTime.slice(0, 16) : '')
    setEditDuration(apt.durationMinutes || 30)
    setEditStatus(apt.status)
    setEditDentist(apt.dentistName || 'Dr. Mohamed Amrani')
    setEditTreatment(apt.treatmentType || 'Consultation')
    setEditNotes(apt.notes || '')
    setEditDateTimeError('')
    setIsEditingAppointment(true)
  }

  // Save Edit / Reschedule with Validation & Conflict Guard
  const handleSaveEdit = async (): Promise<void> => {
    if (!selectedAppointment) return

    // 1. Past date check
    const dateRes = validateFutureDateTime(editDateTime)
    if (!dateRes.isValid) {
      setEditDateTimeError(dateRes.error || "La date et l'heure du rendez-vous doivent être strictement ultérieures au moment actuel.")
      showToast('Impossible de déplacer un rendez-vous dans le passé. Veuillez choisir une date et heure future.', 'error')
      return
    }
    setEditDateTimeError('')

    // 2. Conflict check for the practitioner
    const newStart = new Date(editDateTime).getTime()
    const newEnd = newStart + editDuration * 60 * 1000

    const conflict = appointments.find((a) => {
      if (a.id === selectedAppointment.id) return false
      if (a.status === 'CANCELLED') return false
      const isSameDentist = (a.dentistName || 'Dr. Mohamed Amrani') === editDentist
      if (!isSameDentist) return false

      const aStart = new Date(a.dateTime).getTime()
      const aEnd = aStart + (a.durationMinutes || 30) * 60 * 1000
      return newStart < aEnd && newEnd > aStart
    })

    if (conflict) {
      showToast(`Attention : Conflit d'horaire pour ${editDentist} avec le rendez-vous de ${conflict.patientName}`, 'warning')
      return
    }

    if (selectedAppointment && editStatus !== selectedAppointment.status) {
      if (!canTransitionTo(selectedAppointment.status, editStatus)) {
        showToast(
          `Transition interdite : impossible de passer de "${STATUS_CONFIG[selectedAppointment.status]?.label || selectedAppointment.status}" à "${STATUS_CONFIG[editStatus]?.label || editStatus}"`,
          'error'
        )
        return
      }
    }

    setIsSavingEdit(true)
    try {
      const updated: Appointment = {
        ...selectedAppointment,
        dateTime: new Date(editDateTime).toISOString(),
        durationMinutes: editDuration,
        status: editStatus,
        dentistName: editDentist,
        treatmentType: editTreatment,
        notes: editNotes
      }
      await appointmentService.saveAppointment(updated)
      await loadAppointments()
      setSelectedAppointment(updated)
      setIsEditingAppointment(false)
      showToast('Rendez-vous mis à jour avec succès !', 'success')
    } catch (err) {
      console.error('Failed to save appointment edit:', err)
      showToast('Erreur lors de la modification du rendez-vous', 'error')
    } finally {
      setIsSavingEdit(false)
    }
  }

  // Open booking drawer with a specific slot preselected
  const handleSlotClick = (dateStr: string, hourStr: string): void => {
    setNewDrawerInitialDate(`${dateStr}T${hourStr}`)
    setShowNewDrawer(true)
  }

  // Status Badge Helper
  const getStatusBadge = (status: Appointment['status']): JSX.Element => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">verified</span>
            Confirmé
          </span>
        )
      case 'IN_CHAIR':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300 animate-pulse flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">airline_seat_recline_extra</span>
            Au fauteuil
          </span>
        )
      case 'COMPLETED':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-100 text-cyan-900 border border-cyan-300 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">check_circle</span>
            Terminé
          </span>
        )
      case 'CANCELLED':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">cancel</span>
            Annulé
          </span>
        )
      case 'SCHEDULED':
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">schedule</span>
            Planifié
          </span>
        )
    }
  }

  // Card color styles by status
  const getCardColorClass = (status: Appointment['status']): string => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-emerald-50 border-emerald-300 text-emerald-950 hover:bg-emerald-100'
      case 'IN_CHAIR':
        return 'bg-purple-50 border-purple-300 text-purple-950 hover:bg-purple-100 ring-1 ring-purple-400'
      case 'COMPLETED':
        return 'bg-cyan-50 border-cyan-300 text-cyan-950 hover:bg-cyan-100'
      case 'CANCELLED':
        return 'bg-rose-50 border-rose-300 text-rose-950 opacity-60 line-through'
      case 'SCHEDULED':
      default:
        return 'bg-blue-50 border-blue-300 text-blue-950 hover:bg-blue-100'
    }
  }

  // ==========================================
  // 1. WEEK VIEW CALCULATIONS & RENDER
  // ==========================================
  const weekDays = useMemo(() => {
    // In Algeria, week begins on Saturday
    const d = new Date(currentDate)
    const dayOfWeek = d.getDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const diffToSaturday = (dayOfWeek + 1) % 7 // Saturday is 0 days back
    const saturday = new Date(d)
    saturday.setDate(d.getDate() - diffToSaturday)

    return Array.from({ length: 6 }).map((_, i) => {
      const dayDate = new Date(saturday)
      dayDate.setDate(saturday.getDate() + i)
      return {
        date: dayDate,
        iso: formatIsoDate(dayDate),
        dayName: ALGERIAN_WEEKDAYS[i].label,
        shortName: ALGERIAN_WEEKDAYS[i].short,
        dayNum: dayDate.getDate(),
        isToday: formatIsoDate(dayDate) === todayIso
      }
    })
  }, [currentDate, todayIso])

  const renderWeekView = (): JSX.Element => {
    return (
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-xs overflow-hidden flex flex-col flex-1 min-h-[620px]">
        {/* Week Day Header */}
        <div className="grid grid-cols-[70px_repeat(6,1fr)] border-b border-outline-variant/60 bg-surface-container-low text-center select-none sticky top-0 z-10">
          <div className="py-3 px-2 text-[11px] font-bold text-on-surface-variant border-r border-outline-variant/40 flex items-center justify-center">
            Heure
          </div>
          {weekDays.map((wd) => (
            <div
              key={wd.iso}
              className={`py-2.5 px-1 border-r border-outline-variant/40 last:border-r-0 transition-colors ${
                wd.isToday ? 'bg-secondary-fixed/30 text-secondary' : 'text-on-surface'
              }`}
            >
              <span className="text-[11px] uppercase tracking-wider font-semibold block text-on-surface-variant">
                {wd.dayName}
              </span>
              <span
                className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold mt-0.5 ${
                  wd.isToday ? 'bg-secondary text-on-secondary shadow-xs' : 'text-on-surface'
                }`}
              >
                {wd.dayNum}
              </span>
            </div>
          ))}
        </div>

        {/* Week Hours Grid */}
        <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/30">
          {HOURS.map((hour) => {
            const hourInt = parseInt(hour.split(':')[0], 10)
            return (
              <div key={hour} className="grid grid-cols-[70px_repeat(6,1fr)] min-h-[64px]">
                {/* Time Label */}
                <div className="py-2 pr-2 text-right text-[11px] font-mono text-outline border-r border-outline-variant/40 select-none bg-surface-container-lowest/50">
                  {hour}
                </div>

                {/* Day Columns for this hour */}
                {weekDays.map((wd) => {
                  // Find appointments starting in this hour slot
                  const slotApts = filteredAppointments.filter((a) => {
                    if (!a.dateTime.startsWith(wd.iso)) return false
                    const aHour = parseInt(a.dateTime.split('T')[1]?.slice(0, 2) || '0', 10)
                    return aHour === hourInt
                  })

                  return (
                    <div
                      key={wd.iso}
                      onClick={() => {
                        if (slotApts.length === 0) {
                          handleSlotClick(wd.iso, hour)
                        }
                      }}
                      className="border-r border-outline-variant/30 last:border-r-0 p-1 relative hover:bg-secondary-fixed/10 transition-colors group cursor-pointer"
                      title={slotApts.length === 0 ? `Cliquer pour réserver le ${wd.dayName} à ${hour}` : ''}
                    >
                      {/* Empty Slot Add Hint */}
                      {slotApts.length === 0 && (
                        <div className="hidden group-hover:flex items-center justify-center h-full text-[10px] text-secondary font-medium opacity-70">
                          + {hour}
                        </div>
                      )}

                      {/* Render Appointments */}
                      <div className="space-y-1">
                        {slotApts.map((apt) => (
                          <div
                            key={apt.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedAppointment(apt)
                            }}
                            className={`p-1.5 rounded-lg border text-xs shadow-2xs transition-all cursor-pointer ${getCardColorClass(
                              apt.status
                            )}`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-[11px] truncate">{apt.patientName}</span>
                              <span className="text-[10px] font-mono opacity-80 shrink-0">
                                {apt.dateTime.split('T')[1]?.slice(0, 5)}
                              </span>
                            </div>
                            <div className="text-[10px] truncate opacity-90 font-medium">
                              {apt.treatmentType}
                            </div>
                            <div className="flex items-center justify-between mt-1 text-[9px] opacity-75">
                              <span>{apt.durationMinutes || 30} min</span>
                              <span>{apt.status === 'IN_CHAIR' ? 'Au fauteuil' : apt.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ==========================================
  // 2. MONTH VIEW CALCULATIONS & RENDER
  // ==========================================
  const monthData = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    // Algerian start on Saturday (6)
    const firstDayOfWeek = firstDay.getDay()
    const leadingDaysCount = (firstDayOfWeek + 1) % 7

    const cells: { date: Date; iso: string; dayNum: number; isCurrentMonth: boolean; isToday: boolean }[] = []

    // Leading days from previous month
    for (let i = leadingDaysCount - 1; i >= 0; i--) {
      const d = new Date(year, month, 1 - i - 1)
      cells.push({
        date: d,
        iso: formatIsoDate(d),
        dayNum: d.getDate(),
        isCurrentMonth: false,
        isToday: formatIsoDate(d) === todayIso
      })
    }

    // Days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i)
      cells.push({
        date: d,
        iso: formatIsoDate(d),
        dayNum: i,
        isCurrentMonth: true,
        isToday: formatIsoDate(d) === todayIso
      })
    }

    // Trailing days to complete 35 or 42 grid
    const totalCells = cells.length <= 35 ? 35 : 42
    const remaining = totalCells - cells.length
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i)
      cells.push({
        date: d,
        iso: formatIsoDate(d),
        dayNum: i,
        isCurrentMonth: false,
        isToday: formatIsoDate(d) === todayIso
      })
    }

    return cells
  }, [currentDate, todayIso])

  const renderMonthView = (): JSX.Element => {
    return (
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-xs overflow-hidden flex flex-col flex-1 min-h-[620px]">
        {/* Month Day Names Header */}
        <div className="grid grid-cols-7 border-b border-outline-variant/60 bg-surface-container-low text-center select-none">
          {ALGERIAN_WEEKDAYS.map((wd) => (
            <div key={wd.key} className="py-2.5 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              {wd.label}
            </div>
          ))}
        </div>

        {/* Month Grid */}
        <div className="grid grid-cols-7 flex-1 divide-x divide-y divide-outline-variant/30">
          {monthData.map((cell) => {
            const dayApts = filteredAppointments.filter((a) => a.dateTime.startsWith(cell.iso))
            return (
              <div
                key={cell.iso}
                onClick={() => {
                  setCurrentDate(cell.date)
                  setViewMode('DAY')
                }}
                className={`min-h-[95px] p-2 flex flex-col justify-between transition-colors cursor-pointer group hover:bg-secondary-fixed/15 ${
                  cell.isCurrentMonth ? 'bg-surface-container-lowest' : 'bg-surface-container-low/40 opacity-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      cell.isToday
                        ? 'bg-secondary text-on-secondary shadow-xs'
                        : cell.isCurrentMonth
                        ? 'text-on-surface'
                        : 'text-outline'
                    }`}
                  >
                    {cell.dayNum}
                  </span>

                  {dayApts.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary-fixed text-secondary font-bold">
                      {dayApts.length} RDV
                    </span>
                  )}
                </div>

                {/* Day Mini-Appointments List */}
                <div className="space-y-1 my-1 flex-1 overflow-hidden">
                  {dayApts.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedAppointment(a)
                      }}
                      className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium flex items-center justify-between border ${getCardColorClass(
                        a.status
                      )}`}
                    >
                      <span className="truncate">{a.patientName}</span>
                      <span className="font-mono text-[9px] opacity-80">{a.dateTime.split('T')[1]?.slice(0, 5)}</span>
                    </div>
                  ))}
                  {dayApts.length > 3 && (
                    <span className="text-[10px] text-secondary font-semibold block text-center">
                      +{dayApts.length - 3} autre(s)
                    </span>
                  )}
                </div>

                <div className="text-[10px] text-outline text-right opacity-0 group-hover:opacity-100 transition-opacity">
                  Voir jour →
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ==========================================
  // 3. DAY VIEW CALCULATIONS & RENDER
  // ==========================================
  const renderDayView = (): JSX.Element => {
    const selectedIso = formatIsoDate(currentDate)
    const dayAppointments = filteredAppointments.filter((a) => a.dateTime.startsWith(selectedIso))

    return (
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-xs overflow-hidden flex flex-col flex-1 min-h-[620px]">
        {/* Day Header Banner */}
        <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant/60 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary-fixed text-secondary flex items-center justify-center font-bold text-lg shadow-xs">
              {currentDate.getDate()}
            </div>
            <div>
              <h3 className="font-bold text-base text-on-surface">
                {currentDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </h3>
              <p className="text-xs text-on-surface-variant font-medium">
                {dayAppointments.length} rendez-vous programmés pour cette journée
              </p>
            </div>
          </div>

          <button
            onClick={() => handleSlotClick(selectedIso, '09:00')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>+ Nouveau Rendez-vous</span>
          </button>
        </div>

        {/* Day Timeline */}
        <div className="p-6 flex-1 overflow-y-auto space-y-3">
          {HOURS.map((hour) => {
            const hourInt = parseInt(hour.split(':')[0], 10)
            const slotApts = dayAppointments.filter((a) => {
              const aHour = parseInt(a.dateTime.split('T')[1]?.slice(0, 2) || '0', 10)
              return aHour === hourInt
            })

            return (
              <div key={hour} className="flex items-start gap-4 p-3 rounded-xl border border-outline-variant/40 bg-surface/50 hover:bg-surface transition-all">
                {/* Hour Col */}
                <div className="w-16 font-mono font-bold text-sm text-secondary shrink-0 pt-1">
                  {hour}
                </div>

                {/* Content */}
                <div className="flex-1 space-y-2">
                  {slotApts.length === 0 ? (
                    <button
                      onClick={() => handleSlotClick(selectedIso, hour)}
                      className="w-full py-2.5 px-3 border border-dashed border-outline-variant/80 rounded-xl text-xs text-outline hover:text-secondary hover:border-secondary transition-all text-left flex items-center gap-2 cursor-pointer group"
                    >
                      <span className="material-symbols-outlined text-base group-hover:scale-110 transition-transform">add_circle</span>
                      <span>Créneau disponible à {hour} — Cliquer pour ajouter un rendez-vous</span>
                    </button>
                  ) : (
                    slotApts.map((apt) => (
                      <div
                        key={apt.id}
                        className={`p-4 rounded-xl border shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all ${getCardColorClass(
                          apt.status
                        )}`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{apt.patientName}</span>
                            {getStatusBadge(apt.status)}
                          </div>
                          <div className="text-xs opacity-90 flex items-center gap-3">
                            <span className="font-semibold">{apt.treatmentType}</span>
                            <span>·</span>
                            <span>{apt.durationMinutes || 30} minutes</span>
                            <span>·</span>
                            <span>Praticien : {apt.dentistName || 'Dr. Amrani'}</span>
                          </div>
                          {apt.patientPhone && (
                            <div className="text-xs font-mono opacity-80">
                              📞 {apt.patientPhone}
                            </div>
                          )}
                          {apt.notes && (
                            <div className="text-xs italic opacity-80 mt-1">
                              Note : {apt.notes}
                            </div>
                          )}
                        </div>

                        {/* Quick Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {apt.status !== 'IN_CHAIR' && apt.status !== 'COMPLETED' && (
                            <button
                              onClick={() => handleStatusUpdate(apt.id, 'IN_CHAIR')}
                              className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-sm">airline_seat_recline_extra</span>
                              <span>Au fauteuil</span>
                            </button>
                          )}
                          {apt.status !== 'COMPLETED' && (
                            <button
                              onClick={() => handleStatusUpdate(apt.id, 'COMPLETED')}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-sm">check_circle</span>
                              <span>Terminer</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenPatientFile(apt)}
                            className="px-2.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">folder_open</span>
                            <span>Fiche Patient</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Header Title
  const headerDateTitle = useMemo(() => {
    if (viewMode === 'MONTH') {
      return currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    } else if (viewMode === 'WEEK') {
      const first = weekDays[0].date
      const last = weekDays[weekDays.length - 1].date
      return `Semaine du ${first.getDate()} au ${last.getDate()} ${last.toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric'
      })}`
    } else {
      return currentDate.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    }
  }, [viewMode, currentDate, weekDays])

  // Dynamic label for returning to current period
  const currentPeriodLabel = useMemo(() => {
    if (viewMode === 'MONTH') return 'Ce mois'
    if (viewMode === 'WEEK') return 'Cette semaine'
    return "Aujourd'hui"
  }, [viewMode])

  return (
    <div className="space-y-4 flex flex-col h-full">
      {/* Top Calendar Toolbar */}
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Navigation & Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-surface-container rounded-xl p-1 border border-outline-variant/40">
            <button
              onClick={handlePrev}
              className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface transition-colors cursor-pointer"
              title="Période précédente"
            >
              <span className="material-symbols-outlined text-lg">chevron_left</span>
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1 rounded-lg text-xs font-bold text-secondary hover:bg-secondary-fixed/50 transition-colors cursor-pointer"
              title={`Revenir à : ${currentPeriodLabel}`}
            >
              {currentPeriodLabel}
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface transition-colors cursor-pointer"
              title="Période suivante"
            >
              <span className="material-symbols-outlined text-lg">chevron_right</span>
            </button>
          </div>

          <h2 className="text-base font-bold text-on-surface capitalize">{headerDateTitle}</h2>
        </div>

        {/* View Switcher & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-on-surface-variant font-medium hidden sm:inline">Statut :</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-2.5 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface focus:outline-none focus:border-secondary cursor-pointer"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="CONFIRMED">Confirmé</option>
              <option value="IN_CHAIR">Au fauteuil</option>
              <option value="SCHEDULED">Planifié</option>
              <option value="COMPLETED">Terminé</option>
              <option value="CANCELLED">Annulé</option>
            </select>
          </div>

          {/* Segmented View Mode Buttons */}
          <div className="flex items-center bg-surface-container p-1 rounded-xl border border-outline-variant/40">
            <button
              onClick={() => setViewMode('MONTH')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'MONTH'
                  ? 'bg-secondary text-on-secondary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Mois
            </button>
            <button
              onClick={() => setViewMode('WEEK')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'WEEK'
                  ? 'bg-secondary text-on-secondary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Semaine
            </button>
            <button
              onClick={() => setViewMode('DAY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'DAY'
                  ? 'bg-secondary text-on-secondary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Jour
            </button>
          </div>

          {/* Add Appointment Button */}
          <button
            onClick={() => {
              setNewDrawerInitialDate(undefined)
              setShowNewDrawer(true)
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-container hover:bg-on-secondary-fixed-variant text-on-primary text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>+ Nouveau RDV</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {isLoading ? (
        <div className="py-24 flex justify-center items-center gap-2 text-secondary">
          <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
          <span className="text-sm font-medium">Chargement du calendrier...</span>
        </div>
      ) : (
        <>
          {viewMode === 'WEEK' && renderWeekView()}
          {viewMode === 'MONTH' && renderMonthView()}
          {viewMode === 'DAY' && renderDayView()}
        </>
      )}

      {/* Quick Appointment Detail Popin/Modal */}
      {selectedAppointment && !isEditingAppointment && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl border border-outline-variant overflow-hidden animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant/60 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-secondary text-xl">event</span>
                <h3 className="font-bold text-sm text-on-surface">Détails du Rendez-vous</h3>
              </div>
              <button
                onClick={() => setSelectedAppointment(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-base font-bold text-on-surface">{selectedAppointment.patientName}</h4>
                  {selectedAppointment.patientPhone && (
                    <p className="text-xs font-mono text-on-surface-variant mt-0.5">
                      📞 {selectedAppointment.patientPhone}
                    </p>
                  )}
                </div>
                {getStatusBadge(selectedAppointment.status)}
              </div>

              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-surface border border-outline-variant/40 text-xs">
                <div>
                  <span className="text-outline block text-[11px]">Date & Heure :</span>
                  <span className="font-bold text-on-surface mt-0.5 block">
                    {new Date(selectedAppointment.dateTime).toLocaleDateString('fr-FR', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}{' '}
                    à {selectedAppointment.dateTime.split('T')[1]?.slice(0, 5)}
                  </span>
                </div>
                <div>
                  <span className="text-outline block text-[11px]">Durée :</span>
                  <span className="font-bold text-on-surface mt-0.5 block">
                    {selectedAppointment.durationMinutes || 30} minutes
                  </span>
                </div>
                <div>
                  <span className="text-outline block text-[11px]">Acte prévu :</span>
                  <span className="font-bold text-secondary mt-0.5 block">
                    {selectedAppointment.treatmentType}
                  </span>
                </div>
                <div>
                  <span className="text-outline block text-[11px]">Praticien :</span>
                  <span className="font-bold text-on-surface mt-0.5 block">
                    {selectedAppointment.dentistName || 'Dr. Amrani'}
                  </span>
                </div>
              </div>

              {selectedAppointment.notes && (
                <div className="text-xs bg-surface-container/40 p-3 rounded-xl border border-outline-variant/30 text-on-surface-variant">
                  <strong className="text-on-surface">Notes :</strong> {selectedAppointment.notes}
                </div>
              )}

              {/* Status Switcher Quick Buttons */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                    Modifier le statut rapide :
                  </span>
                  {isTerminalStatus(selectedAppointment.status) && (
                    <span className="text-[11px] font-semibold text-outline italic">
                      État finalisé
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {getAllowedTransitions(selectedAppointment.status).map((targetStatus) => {
                    const cfg = STATUS_CONFIG[targetStatus]
                    return (
                      <button
                        key={targetStatus}
                        onClick={() => handleStatusUpdate(selectedAppointment.id, targetStatus)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${cfg.colorClass}`}
                      >
                        <span className="material-symbols-outlined text-sm">{cfg.icon}</span>
                        <span>{cfg.label}</span>
                      </button>
                    )
                  })}
                  {isTerminalStatus(selectedAppointment.status) && (
                    <div className="w-full px-3 py-2 rounded-xl bg-surface border border-outline-variant/40 text-xs text-on-surface-variant flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-outline">lock</span>
                      <span>Ce rendez-vous est dans un état final ({STATUS_CONFIG[selectedAppointment.status]?.label}). Aucune transition possible.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant/60 flex justify-between items-center">
              <button
                onClick={() => handleOpenEdit(selectedAppointment)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-outline-variant hover:bg-surface-container text-xs font-semibold text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">edit_calendar</span>
                <span>Modifier / Déplacer</span>
              </button>

              <button
                onClick={() => handleOpenPatientFile(selectedAppointment)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">folder_open</span>
                <span>Ouvrir Fiche Patient</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Reschedule Modal */}
      {isEditingAppointment && selectedAppointment && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-2xl border border-outline-variant overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant/60 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-xl">edit_calendar</span>
                <h4 className="font-bold text-sm text-on-surface">Modifier / Déplacer le Rendez-vous</h4>
              </div>
              <button
                onClick={() => setIsEditingAppointment(false)}
                className="text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Nouvelle Date & Heure *
                </label>
                <input
                  type="datetime-local"
                  value={editDateTime}
                  onChange={(e) => {
                    setEditDateTime(e.target.value)
                    const res = validateFutureDateTime(e.target.value)
                    setEditDateTimeError(res.isValid ? '' : res.error || '')
                  }}
                  className={`w-full h-10 px-3 rounded-xl bg-surface border text-xs text-on-surface focus:outline-none ${
                    editDateTimeError ? 'border-error focus:border-error ring-1 ring-error/50' : 'border-outline-variant focus:border-secondary'
                  }`}
                />
                {editDateTimeError && (
                  <p className="text-[11px] text-error font-medium mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">error</span>
                    <span>{editDateTimeError}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Chirurgien-Dentiste
                </label>
                <select
                  value={editDentist}
                  onChange={(e) => setEditDentist(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface font-semibold focus:outline-none focus:border-secondary cursor-pointer"
                >
                  {CLINIC_DENTISTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">
                    Durée (minutes)
                  </label>
                  <select
                    value={editDuration}
                    onChange={(e) => setEditDuration(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface focus:outline-none focus:border-secondary"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>1 heure</option>
                    <option value={90}>1 heure 30</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">
                    Statut {selectedAppointment && isTerminalStatus(selectedAppointment.status) ? '(État clôturé)' : ''}
                  </label>
                  <select
                    value={editStatus}
                    disabled={Boolean(selectedAppointment && isTerminalStatus(selectedAppointment.status))}
                    onChange={(e) => setEditStatus(e.target.value as Appointment['status'])}
                    className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface focus:outline-none focus:border-secondary disabled:opacity-60 disabled:bg-surface-container"
                  >
                    {selectedAppointment ? (
                      <>
                        <option value={selectedAppointment.status}>
                          {STATUS_CONFIG[selectedAppointment.status]?.label || selectedAppointment.status} (Actuel)
                        </option>
                        {getAllowedTransitions(selectedAppointment.status).map((targetStatus) => (
                          <option key={targetStatus} value={targetStatus}>
                            {STATUS_CONFIG[targetStatus]?.label || targetStatus}
                          </option>
                        ))}
                      </>
                    ) : (
                      <>
                        <option value="SCHEDULED">Planifié</option>
                        <option value="CONFIRMED">Confirmé</option>
                        <option value="IN_CHAIR">Au fauteuil</option>
                        <option value="COMPLETED">Terminé</option>
                        <option value="CANCELLED">Annulé</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Acte / Soin
                </label>
                <input
                  type="text"
                  value={editTreatment}
                  onChange={(e) => setEditTreatment(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface focus:outline-none focus:border-secondary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Notes de séance..."
                  className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface focus:outline-none focus:border-secondary"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant/60 flex justify-end gap-2">
              <button
                onClick={() => setIsEditingAppointment(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
              >
                Annuler
              </button>
              <button
                disabled={isSavingEdit}
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSavingEdit ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Appointment Drawer */}
      {showNewDrawer && (
        <NewAppointmentDrawer
          initialDate={newDrawerInitialDate}
          onClose={() => setShowNewDrawer(false)}
          onSuccess={() => {
            loadAppointments()
            showToast('Nouveau rendez-vous enregistré !', 'success')
          }}
        />
      )}
    </div>
  )
}
