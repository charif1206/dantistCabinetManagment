import { Appointment } from '@shared/types'

export type AppointmentStatus = Appointment['status']

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Planifié',
  CONFIRMED: 'Confirmé',
  IN_CHAIR: 'Au fauteuil',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé'
}

export const STATUS_CONFIG: Record<
  AppointmentStatus,
  {
    label: string
    colorClass: string
    badgeClass: string
    icon: string
  }
> = {
  SCHEDULED: {
    label: 'Planifié',
    colorClass: 'bg-amber-600 hover:bg-amber-700 text-white',
    badgeClass: 'bg-amber-100 text-amber-800 border border-amber-300',
    icon: 'schedule'
  },
  CONFIRMED: {
    label: 'Confirmé',
    colorClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
    icon: 'check_circle'
  },
  IN_CHAIR: {
    label: 'Au fauteuil',
    colorClass: 'bg-purple-600 hover:bg-purple-700 text-white',
    badgeClass: 'bg-purple-100 text-purple-900 border border-purple-300 animate-pulse',
    icon: 'airline_seat_recline_extra'
  },
  COMPLETED: {
    label: 'Terminé',
    colorClass: 'bg-cyan-600 hover:bg-cyan-700 text-white',
    badgeClass: 'bg-cyan-100 text-cyan-800 border border-cyan-300',
    icon: 'task_alt'
  },
  CANCELLED: {
    label: 'Annulé',
    colorClass: 'bg-rose-600 hover:bg-rose-700 text-white',
    badgeClass: 'bg-rose-100 text-rose-800 border border-rose-300',
    icon: 'cancel'
  }
}

/**
 * Transitions rules requested:
 * PENDING (SCHEDULED) -> ['Confirmé', 'Annulé']
 * Confirmé (CONFIRMED) -> ['Au fauteuil', 'Annulé']
 * Au_fauteuil (IN_CHAIR) -> ['Terminé']
 * Terminé (COMPLETED) -> [] (Terminal State)
 * Annulé (CANCELLED) -> [] (Terminal State)
 */
export const APPOINTMENT_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_CHAIR', 'CANCELLED'],
  IN_CHAIR: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: []
}

export function getAllowedTransitions(currentStatus: AppointmentStatus): AppointmentStatus[] {
  return APPOINTMENT_TRANSITIONS[currentStatus] || []
}

export function isTerminalStatus(status: AppointmentStatus): boolean {
  return (APPOINTMENT_TRANSITIONS[status] || []).length === 0
}

export function canTransitionTo(currentStatus: AppointmentStatus, nextStatus: AppointmentStatus): boolean {
  if (currentStatus === nextStatus) return true
  const allowed = getAllowedTransitions(currentStatus)
  return allowed.includes(nextStatus)
}
