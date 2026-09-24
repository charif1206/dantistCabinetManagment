import React, { useState, useEffect } from 'react'
import { Appointment } from '@shared/types'
import { appointmentService } from '../../services/appointmentService'
import { patientService } from '../../services/patientService'
import { useNavigation } from '../../context/NavigationContext'
import {
  canTransitionTo,
  getAllowedTransitions,
  STATUS_CONFIG
} from '../../utils/appointmentTransitions'
import NewAppointmentDrawer from './NewAppointmentDrawer'

const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00'
]

export default function CalendarSchedule(): JSX.Element {
  const { openPatient } = useNavigation()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [showDrawer, setShowDrawer] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  const handleOpenPatient = async (apt: Appointment): Promise<void> => {
    try {
      if (apt.patientId) {
        const found = await patientService.getPatientById(apt.patientId)
        if (found) {
          openPatient(found, 'overview')
          return
        }
      }
    } catch {
      // ignore
    }
    // Fallback patient
    const names = apt.patientName.split(' ')
    openPatient(
      {
        id: apt.patientId || `p-${Date.now()}`,
        patientNumber: 'P-DZ',
        firstName: names[0] || apt.patientName,
        lastName: names.slice(1).join(' ') || '',
        phone: apt.patientPhone || '',
        gender: 'M',
        wilaya: 'Alger',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      'overview'
    )
  }

  const loadAppointments = async (): Promise<void> => {
    try {
      const data = await appointmentService.getAppointments()
      setAppointments(data)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAppointments()
  }, [])

  // Filter appointments for selected day
  const dayAppointments = appointments.filter((a) => {
    const isSameDay = a.dateTime.startsWith(selectedDate)
    const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter
    return isSameDay && matchesStatus
  })

  // Date Navigation
  const changeDateBy = (days: number): void => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const handleUpdateStatus = async (
    id: string,
    newStatus: Appointment['status']
  ): Promise<void> => {
    const apt = appointments.find((a) => a.id === id)
    if (apt && !canTransitionTo(apt.status, newStatus)) {
      return
    }
    await appointmentService.updateStatus(id, newStatus)
    await loadAppointments()
  }

  const getStatusBadge = (status: Appointment['status']): JSX.Element => {
    switch (status) {
      case 'IN_CHAIR':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300 animate-pulse flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">airline_seat_recline_extra</span>
            Au fauteuil
          </span>
        )
      case 'COMPLETED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-tertiary-fixed text-on-tertiary-container flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">check_circle</span>
            Terminé
          </span>
        )
      case 'CONFIRMED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary-fixed text-on-secondary-fixed flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">thumb_up</span>
            Confirmé
          </span>
        )
      case 'CANCELLED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-error-container text-error flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">cancel</span>
            Annulé
          </span>
        )
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">schedule</span>
            Planifié
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Calendar Control Bar */}
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Date Selector Navigation */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => changeDateBy(-1)}
            className="w-9 h-9 rounded-xl border border-outline-variant/60 hover:bg-surface-container flex items-center justify-center text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">chevron_left</span>
          </button>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-xs font-bold text-on-surface cursor-pointer"
          />

          <button
            onClick={() => changeDateBy(1)}
            className="w-9 h-9 rounded-xl border border-outline-variant/60 hover:bg-surface-container flex items-center justify-center text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">chevron_right</span>
          </button>

          <button
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="px-3 py-2 rounded-xl text-xs font-bold border border-outline-variant/60 hover:bg-surface-container text-secondary transition-colors cursor-pointer"
          >
            Aujourd'hui
          </button>
        </div>

        {/* Filters & CTA */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-xs font-medium text-on-surface cursor-pointer"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="IN_CHAIR">Au fauteuil</option>
            <option value="SCHEDULED">Planifiés</option>
            <option value="COMPLETED">Terminés</option>
            <option value="CANCELLED">Annulés</option>
          </select>

          <button
            onClick={() => setShowDrawer(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-container hover:bg-on-secondary-fixed-variant text-on-primary text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>+ Nouveau Rendez-vous</span>
          </button>
        </div>
      </div>

      {/* Daily Schedule Slots */}
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 shadow-xs">
        <div className="flex justify-between items-center mb-6 pb-3 border-b border-outline-variant/30">
          <h3 className="font-bold text-base text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">calendar_month</span>
            <span>
              Agenda du{' '}
              {new Date(selectedDate).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </span>
          </h3>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-container-highest text-on-surface">
            {dayAppointments.length} rendez-vous
          </span>
        </div>

        {isLoading ? (
          <div className="py-16 flex justify-center items-center gap-2 text-secondary">
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
            <span className="text-xs font-medium">Chargement du planning...</span>
          </div>
        ) : dayAppointments.length === 0 ? (
          <div className="py-16 text-center text-on-surface-variant text-xs space-y-2">
            <span className="material-symbols-outlined text-4xl text-outline">event_available</span>
            <p className="font-medium">Aucun rendez-vous sur cette journée.</p>
            <button
              onClick={() => setShowDrawer(true)}
              className="text-secondary font-bold hover:underline"
            >
              Ajouter un rendez-vous pour ce jour
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {dayAppointments.map((apt) => {
              const timeStr = apt.dateTime.split('T')[1]?.slice(0, 5) || '00:00'
              return (
                <div
                  key={apt.id}
                  className="p-4 rounded-2xl border border-outline-variant/50 hover:border-secondary/50 bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all shadow-xs"
                >
                  <div className="flex items-start sm:items-center gap-4">
                    {/* Time block */}
                    <div className="w-16 h-12 rounded-xl bg-surface-container-high border border-outline-variant/40 flex flex-col items-center justify-center font-mono font-bold text-xs text-on-surface shrink-0">
                      <span>{timeStr}</span>
                      <span className="text-[10px] text-outline font-normal">
                        {apt.durationMinutes || 30} min
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenPatient(apt)}
                          className="font-bold text-sm text-on-surface hover:text-secondary hover:underline cursor-pointer text-left"
                          title="Ouvrir le dossier patient"
                        >
                          {apt.patientName}
                        </button>
                        {getStatusBadge(apt.status)}
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {apt.treatmentType} · Dr. {apt.dentistName || 'Amrani'}{' '}
                        {apt.patientPhone && `· Tél: ${apt.patientPhone}`}
                      </p>
                      {apt.notes && (
                        <p className="text-[11px] text-outline italic mt-1">{apt.notes}</p>
                      )}
                    </div>
                  </div>

                  {/* Quick Action Controls */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    {getAllowedTransitions(apt.status).map((targetStatus) => {
                      const cfg = STATUS_CONFIG[targetStatus]
                      return (
                        <button
                          key={targetStatus}
                          onClick={() => handleUpdateStatus(apt.id, targetStatus)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${cfg.colorClass}`}
                          title={`Passer à: ${cfg.label}`}
                        >
                          <span className="material-symbols-outlined text-sm">{cfg.icon}</span>
                          <span>{cfg.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* New Appointment Drawer */}
      {showDrawer && (
        <NewAppointmentDrawer
          initialDate={selectedDate}
          onClose={() => setShowDrawer(false)}
          onSuccess={loadAppointments}
        />
      )}
    </div>
  )
}
