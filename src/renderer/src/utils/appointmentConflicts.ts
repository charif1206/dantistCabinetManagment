/**
 * Moteur de détection de conflits et chevauchements de rendez-vous - DentaFlow Algeria
 * Implémente la vérification rigoureuse des plages horaires [Start1, End1] ∩ [Start2, End2]
 * et le calcul de créneaux alternatifs immédiats.
 */

import { Appointment } from '@shared/types'
import { validateFutureDateTime, ValidationResult } from './validators'

export interface AppointmentSlotInput {
  id?: string
  dateTime: string | Date
  durationMinutes: number
  dentistName?: string
  status?: Appointment['status']
}

export interface ConflictCheckResult {
  hasConflict: boolean
  conflictingAppointment: Appointment | null
  suggestedAlternativeIso?: string
  suggestedAlternativeDisplay?: string
  reason?: 'CONFLICT' | 'PAST_DATE'
  error?: string
}

/**
 * Algorithme de vérification mathématique d'intersection de deux intervalles :
 * [Start1, End1] ∩ [Start2, End2] ≠ ∅  <=>  Start1 < End2 ET End1 > Start2
 * Deux créneaux strictement adjacents (ex: 10:00-10:30 et 10:30-11:00) ne se chevauchent PAS.
 *
 * @param start1 Début intervalle 1
 * @param end1 Fin intervalle 1
 * @param start2 Début intervalle 2
 * @param end2 Fin intervalle 2
 * @returns boolean true si les intervalles se chevauchent
 */
export function hasTimeOverlap(
  start1: Date | number | string,
  end1: Date | number | string,
  start2: Date | number | string,
  end2: Date | number | string
): boolean {
  const s1 = new Date(start1).getTime()
  const e1 = new Date(end1).getTime()
  const s2 = new Date(start2).getTime()
  const e2 = new Date(end2).getTime()

  if (isNaN(s1) || isNaN(e1) || isNaN(s2) || isNaN(e2)) {
    return false
  }

  return s1 < e2 && e1 > s2
}

/**
 * Recherche un conflit d'agenda pour un praticien donné parmi les rendez-vous existants.
 * Ignore les rendez-vous annulés ('CANCELLED') ainsi que le rendez-vous en cours d'édition (si excludeId est fourni).
 *
 * @param newApt Détails du rendez-vous souhaité
 * @param existingAppointments Liste des rendez-vous existants
 * @param excludeId ID facultatif à ignorer (ex: lors du déplacement d'un RDV)
 * @returns Appointment | null Le rendez-vous en conflit ou null
 */
export function findConflictingAppointment(
  newApt: AppointmentSlotInput,
  existingAppointments: Appointment[],
  excludeId?: string
): Appointment | null {
  const newStart = new Date(newApt.dateTime).getTime()
  const newEnd = newStart + (newApt.durationMinutes || 30) * 60 * 1000
  const dentist = (newApt.dentistName || 'Dr. Mohamed Amrani').trim()

  const conflict = existingAppointments.find((a) => {
    // Ne pas entrer en conflit avec soi-même lors d'une modification
    if (excludeId && a.id === excludeId) return false
    if (newApt.id && a.id === newApt.id) return false

    // Les rendez-vous annulés libèrent le fauteuil et l'agenda
    if (a.status === 'CANCELLED') return false

    // Les conflits ne concernent que le même praticien
    const existingDentist = (a.dentistName || 'Dr. Mohamed Amrani').trim()
    if (existingDentist !== dentist) return false

    const aStart = new Date(a.dateTime).getTime()
    const aEnd = aStart + (a.durationMinutes || 30) * 60 * 1000

    return hasTimeOverlap(newStart, newEnd, aStart, aEnd)
  })

  return conflict || null
}

/**
 * Calcule automatiquement un créneau alternatif disponible immédiatement après la fin du rendez-vous en conflit.
 * Si le créneau dépasse l'heure de fermeture (22:00), il est reporté au lendemain matin à 08:00.
 *
 * @param conflictingAppointment Le rendez-vous en conflit
 * @returns Informations sur le créneau alternatif
 */
export function calculateSuggestedAlternativeSlot(
  conflictingAppointment: { dateTime: string | Date; durationMinutes?: number }
): {
  suggestedSlot: Date
  suggestedIso: string
  isNextDay: boolean
  suggestedTimeDisplay: string
} {
  const conflictingStart = new Date(conflictingAppointment.dateTime).getTime()
  const conflictingDuration = conflictingAppointment.durationMinutes || 30
  const suggestedSlot = new Date(conflictingStart + conflictingDuration * 60 * 1000)

  // Report au lendemain à 08:00 si fin au-delà de 22:00
  const isPastEveningShift =
    suggestedSlot.getHours() > 22 ||
    (suggestedSlot.getHours() === 22 && suggestedSlot.getMinutes() > 0)

  if (isPastEveningShift) {
    suggestedSlot.setDate(suggestedSlot.getDate() + 1)
    suggestedSlot.setHours(8, 0, 0, 0)
  }

  const pad = (n: number): string => String(n).padStart(2, '0')
  const suggestedIso = `${suggestedSlot.getFullYear()}-${pad(suggestedSlot.getMonth() + 1)}-${pad(
    suggestedSlot.getDate()
  )}T${pad(suggestedSlot.getHours())}:${pad(suggestedSlot.getMinutes())}`

  const isNextDay =
    suggestedSlot.getDate() !== new Date(conflictingAppointment.dateTime).getDate()

  const suggestedTimeDisplay = isNextDay
    ? `Demain à ${suggestedSlot.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : suggestedSlot.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return {
    suggestedSlot,
    suggestedIso,
    isNextDay,
    suggestedTimeDisplay
  }
}

/**
 * Valide l'ensemble des règles de réservation :
 * 1. Blocage strict des dates/heures passées (Past Date Blocking).
 * 2. Détection de chevauchement d'agenda pour le même médecin.
 *
 * @param newApt Le créneau souhaité
 * @param existingAppointments Rendez-vous enregistrés
 * @param options Options supplémentaires (ex: ignorer vérification date passée pour admission immédiate)
 * @returns ConflictCheckResult
 */
export function validateAppointmentBooking(
  newApt: AppointmentSlotInput,
  existingAppointments: Appointment[],
  options?: { allowPastDate?: boolean; excludeId?: string }
): ConflictCheckResult {
  // 1. Past Date Blocking
  if (!options?.allowPastDate) {
    const futureRes: ValidationResult = validateFutureDateTime(newApt.dateTime)
    if (!futureRes.isValid) {
      return {
        hasConflict: true,
        conflictingAppointment: null,
        reason: 'PAST_DATE',
        error: futureRes.error || "La date et l'heure du rendez-vous doivent être strictement ultérieures au moment actuel."
      }
    }
  }

  // 2. Doctor Schedule Overlap Check
  const conflict = findConflictingAppointment(newApt, existingAppointments, options?.excludeId)
  if (conflict) {
    const alt = calculateSuggestedAlternativeSlot(conflict)
    return {
      hasConflict: true,
      conflictingAppointment: conflict,
      suggestedAlternativeIso: alt.suggestedIso,
      suggestedAlternativeDisplay: alt.suggestedTimeDisplay,
      reason: 'CONFLICT',
      error: `Conflit d'horaire pour ${newApt.dentistName || 'le praticien'} : هذا الوقت محجوز مسبقاً للمريض [${conflict.patientName}]، ولكن يمكن إضافة المريض في نفس الوقت إذا كان هناك كرسي عمل شاغر (Fauteuil disponible).`
    }
  }

  return {
    hasConflict: false,
    conflictingAppointment: null
  }
}
