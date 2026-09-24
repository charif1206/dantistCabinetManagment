import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  hasTimeOverlap,
  findConflictingAppointment,
  calculateSuggestedAlternativeSlot,
  validateAppointmentBooking
} from '@renderer/utils/appointmentConflicts'
import { validateFutureDateTime } from '@renderer/utils/validators'
import { Appointment } from '@shared/types'

describe('Appointment Conflict Detection Engine & Interval Overlap Logic', () => {
  // =========================================================================
  // 1. إثبات دقة خوارزمية تقاطع الفترات الزمنية [Start1, End1] ∩ [Start2, End2]
  // =========================================================================
  describe('Mathematical Interval Overlap [Start1, End1] ∩ [Start2, End2]', () => {
    const baseDate = '2026-10-15'

    it('returns true when intervals partially overlap (New starts before Existing ends)', () => {
      // Existing: 10:00 - 10:30
      // New:      10:15 - 10:45
      const overlap = hasTimeOverlap(
        `${baseDate}T10:15:00`,
        `${baseDate}T10:45:00`,
        `${baseDate}T10:00:00`,
        `${baseDate}T10:30:00`
      )
      expect(overlap).toBe(true)
    })

    it('returns true when intervals partially overlap (New starts before and ends during Existing)', () => {
      // Existing: 10:00 - 10:30
      // New:      09:45 - 10:15
      const overlap = hasTimeOverlap(
        `${baseDate}T09:45:00`,
        `${baseDate}T10:15:00`,
        `${baseDate}T10:00:00`,
        `${baseDate}T10:30:00`
      )
      expect(overlap).toBe(true)
    })

    it('returns true when one interval is completely contained within another', () => {
      // Existing: 10:00 - 11:00
      // New:      10:15 - 10:45
      const overlap = hasTimeOverlap(
        `${baseDate}T10:15:00`,
        `${baseDate}T10:45:00`,
        `${baseDate}T10:00:00`,
        `${baseDate}T11:00:00`
      )
      expect(overlap).toBe(true)
    })

    it('returns true when one interval completely encompasses another', () => {
      // Existing: 10:15 - 10:30
      // New:      10:00 - 11:00
      const overlap = hasTimeOverlap(
        `${baseDate}T10:00:00`,
        `${baseDate}T11:00:00`,
        `${baseDate}T10:15:00`,
        `${baseDate}T10:30:00`
      )
      expect(overlap).toBe(true)
    })

    it('returns true when intervals have identical start and end times', () => {
      // Existing: 10:00 - 10:30
      // New:      10:00 - 10:30
      const overlap = hasTimeOverlap(
        `${baseDate}T10:00:00`,
        `${baseDate}T10:30:00`,
        `${baseDate}T10:00:00`,
        `${baseDate}T10:30:00`
      )
      expect(overlap).toBe(true)
    })

    it('returns false for strictly consecutive / adjacent slots (touching boundaries without overlap)', () => {
      // Existing: 10:00 - 10:30
      // Slot right after: 10:30 - 11:00 (End1 == Start2)
      const afterOverlap = hasTimeOverlap(
        `${baseDate}T10:30:00`,
        `${baseDate}T11:00:00`,
        `${baseDate}T10:00:00`,
        `${baseDate}T10:30:00`
      )
      expect(afterOverlap).toBe(false)

      // Slot right before: 09:30 - 10:00 (Start1 == End2)
      const beforeOverlap = hasTimeOverlap(
        `${baseDate}T09:30:00`,
        `${baseDate}T10:00:00`,
        `${baseDate}T10:00:00`,
        `${baseDate}T10:30:00`
      )
      expect(beforeOverlap).toBe(false)
    })

    it('returns false for completely disjoint time slots', () => {
      // Existing: 10:00 - 10:30
      // New:      14:00 - 14:30
      const overlap = hasTimeOverlap(
        `${baseDate}T14:00:00`,
        `${baseDate}T14:30:00`,
        `${baseDate}T10:00:00`,
        `${baseDate}T10:30:00`
      )
      expect(overlap).toBe(false)
    })

    it('handles timestamps and Date objects correctly', () => {
      const d1 = new Date('2026-10-15T10:00:00Z').getTime()
      const d2 = new Date('2026-10-15T10:30:00Z').getTime()
      const d3 = new Date('2026-10-15T10:15:00Z').getTime()
      const d4 = new Date('2026-10-15T10:45:00Z').getTime()

      expect(hasTimeOverlap(d1, d2, d3, d4)).toBe(true)
      expect(hasTimeOverlap('invalid', d2, d3, d4)).toBe(false)
    })
  })

  // =========================================================================
  // 2. اختبار كشف التداخل لنفس الطبيب مقابل طبيب آخر
  // =========================================================================
  describe('Doctor Specific Conflict Detection Engine', () => {
    const existingAppointment: Appointment = {
      id: 'apt-amrani-01',
      patientId: 'pat-100',
      patientName: 'Kamel Madani',
      patientPhone: '0550112233',
      dateTime: '2026-10-20T10:00:00',
      durationMinutes: 30, // 10:00 to 10:30
      treatmentType: 'Consultation & Soins',
      status: 'CONFIRMED',
      dentistName: 'Dr. Mohamed Amrani'
    }

    const existingAppointments: Appointment[] = [existingAppointment]

    it('detects conflict and rejects booking at 10:15 for the SAME doctor (Dr. Mohamed Amrani)', () => {
      const newBooking = {
        dateTime: '2026-10-20T10:15:00',
        durationMinutes: 30, // 10:15 to 10:45
        dentistName: 'Dr. Mohamed Amrani'
      }

      const conflict = findConflictingAppointment(newBooking, existingAppointments)

      expect(conflict).not.toBeNull()
      expect(conflict?.id).toBe('apt-amrani-01')
      expect(conflict?.dentistName).toBe('Dr. Mohamed Amrani')
      expect(conflict?.patientName).toBe('Kamel Madani')

      const validation = validateAppointmentBooking(newBooking, existingAppointments, {
        allowPastDate: true
      })
      expect(validation.hasConflict).toBe(true)
      expect(validation.reason).toBe('CONFLICT')
      expect(validation.error).toContain('Conflit d\'horaire pour Dr. Mohamed Amrani')
    })

    it('accepts booking at 10:15 for a DIFFERENT doctor (Dr. Sarah Benali)', () => {
      const newBookingForOtherDoctor = {
        dateTime: '2026-10-20T10:15:00',
        durationMinutes: 30,
        dentistName: 'Dr. Sarah Benali'
      }

      const conflict = findConflictingAppointment(newBookingForOtherDoctor, existingAppointments)
      expect(conflict).toBeNull()

      const validation = validateAppointmentBooking(
        newBookingForOtherDoctor,
        existingAppointments,
        { allowPastDate: true }
      )
      expect(validation.hasConflict).toBe(false)
      expect(validation.conflictingAppointment).toBeNull()
    })

    it('ignores CANCELLED appointments (a cancelled slot does not cause a conflict)', () => {
      const cancelledAppointment: Appointment = {
        id: 'apt-amrani-cancelled',
        patientId: 'pat-102',
        patientName: 'Mourad Ziani',
        dateTime: '2026-10-20T11:00:00',
        durationMinutes: 30,
        treatmentType: 'Detartrage',
        status: 'CANCELLED',
        dentistName: 'Dr. Mohamed Amrani'
      }

      const apptsWithCancelled = [...existingAppointments, cancelledAppointment]

      // Booking directly over the cancelled slot 11:00 - 11:30
      const bookingOverCancelled = {
        dateTime: '2026-10-20T11:00:00',
        durationMinutes: 30,
        dentistName: 'Dr. Mohamed Amrani'
      }

      const conflict = findConflictingAppointment(bookingOverCancelled, apptsWithCancelled)
      expect(conflict).toBeNull()
    })

    it('ignores the appointment itself when editing/rescheduling (excludeId)', () => {
      // Modifying apt-amrani-01 duration from 30 to 45 mins at same time
      const modification = {
        id: 'apt-amrani-01',
        dateTime: '2026-10-20T10:00:00',
        durationMinutes: 45,
        dentistName: 'Dr. Mohamed Amrani'
      }

      const conflict = findConflictingAppointment(
        modification,
        existingAppointments,
        'apt-amrani-01'
      )
      expect(conflict).toBeNull()
    })
  })

  // =========================================================================
  // 3. اختبار حظر التواريخ والأوقات الماضية (Past Date Blocking)
  // =========================================================================
  describe('Past Date & Time Blocking', () => {
    beforeEach(() => {
      // Mock system time to 2026-09-24T12:00:00Z
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-09-24T12:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('rejects appointments in the past (yesterday)', () => {
      const pastResult = validateFutureDateTime('2026-09-23T10:00:00')
      expect(pastResult.isValid).toBe(false)
      expect(pastResult.error).toContain(
        "La date et l'heure du rendez-vous doivent être strictement ultérieures au moment actuel"
      )
    })

    it('rejects appointments earlier today (e.g. 09:00 AM when current time is 12:00 PM)', () => {
      const earlierToday = validateFutureDateTime('2026-09-24T09:00:00Z')
      expect(earlierToday.isValid).toBe(false)
    })

    it('rejects appointments at the exact current minute', () => {
      const exactNow = validateFutureDateTime('2026-09-24T12:00:00Z')
      expect(exactNow.isValid).toBe(false)
    })

    it('accepts strictly future appointments (later today or tomorrow)', () => {
      const laterToday = validateFutureDateTime('2026-09-24T15:00:00Z')
      expect(laterToday.isValid).toBe(true)

      const tomorrow = validateFutureDateTime('2026-09-25T10:00:00Z')
      expect(tomorrow.isValid).toBe(true)
    })

    it('validateAppointmentBooking rejects past dates with PAST_DATE reason', () => {
      const booking = {
        dateTime: '2026-09-23T10:00:00',
        durationMinutes: 30,
        dentistName: 'Dr. Mohamed Amrani'
      }

      const result = validateAppointmentBooking(booking, [])
      expect(result.hasConflict).toBe(true)
      expect(result.reason).toBe('PAST_DATE')
      expect(result.error).toContain('strictement ultérieures au moment actuel')
    })
  })

  // =========================================================================
  // 4. حساب واقتراح الوقت البديل (Alternative Slot Calculation)
  // =========================================================================
  describe('Suggested Alternative Slot Calculation', () => {
    it('calculates the alternative slot immediately after the conflicting appointment ends', () => {
      const conflictApt = {
        dateTime: '2026-10-20T10:00:00',
        durationMinutes: 30
      }

      const alt = calculateSuggestedAlternativeSlot(conflictApt)
      // 10:00 + 30 min = 10:30
      expect(alt.suggestedIso).toBe('2026-10-20T10:30')
      expect(alt.isNextDay).toBe(false)
      expect(alt.suggestedTimeDisplay).toContain('10:30')
    })

    it('calculates 45-minute appointment ending at 11:45 accurately', () => {
      const conflictApt = {
        dateTime: '2026-10-20T11:00:00',
        durationMinutes: 45
      }

      const alt = calculateSuggestedAlternativeSlot(conflictApt)
      // 11:00 + 45 min = 11:45
      expect(alt.suggestedIso).toBe('2026-10-20T11:45')
      expect(alt.suggestedTimeDisplay).toContain('11:45')
    })

    it('rolls over to next morning at 08:00 if the alternative slot exceeds 22:00', () => {
      const lateAppointment = {
        dateTime: '2026-10-20T21:45:00',
        durationMinutes: 30 // ends at 22:15, after evening shift
      }

      const alt = calculateSuggestedAlternativeSlot(lateAppointment)
      expect(alt.isNextDay).toBe(true)
      expect(alt.suggestedIso).toBe('2026-10-21T08:00')
      expect(alt.suggestedTimeDisplay).toContain('Demain')
      expect(alt.suggestedTimeDisplay).toContain('08:00')
    })
  })
})
