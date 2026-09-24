import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  validateAlgerianPhone,
  validateFutureDateTime,
  validateRequiredField,
  validatePositiveNumber
} from '@renderer/utils/validators'

describe('Centralized Validators - DentaFlow Algeria', () => {
  describe('validateAlgerianPhone', () => {
    it('accepts valid 10-digit Algerian mobile phone numbers starting with 05, 06, and 07', () => {
      const validNumbers = [
        '0550123456',
        '0661987654',
        '0770112233',
        '0540998877',
        '0699112233',
        '0790445566'
      ]

      for (const phone of validNumbers) {
        const result = validateAlgerianPhone(phone)
        expect(result.isValid).toBe(true)
        expect(result.error).toBeUndefined()
      }
    })

    it('cleans and accepts valid phone numbers with spaces, dots, and hyphens', () => {
      const formattedNumbers = [
        '05 50 12 34 56',
        '06-61-98-76-54',
        '07.70.11.22.33',
        ' 0550123456 '
      ]

      for (const phone of formattedNumbers) {
        const result = validateAlgerianPhone(phone)
        expect(result.isValid).toBe(true)
      }
    })

    it('rejects numbers not starting with Algerian mobile prefixes (05, 06, 07)', () => {
      const invalidPrefixes = [
        '0123456789',
        '0212345678', // Fixed line / landline
        '0312345678',
        '0412345678',
        '0823456789',
        '0923456789'
      ]

      for (const phone of invalidPrefixes) {
        const result = validateAlgerianPhone(phone)
        expect(result.isValid).toBe(false)
        expect(result.error).toContain('Numéro de téléphone algérien invalide')
        expect(result.error).toContain('05, 06 ou 07')
      }
    })

    it('rejects incomplete, too short, or too long numbers', () => {
      const wrongLengths = [
        '055012',
        '0661',
        '077',
        '0550123456789', // 13 digits
        '06619876543' // 11 digits
      ]

      for (const phone of wrongLengths) {
        const result = validateAlgerianPhone(phone)
        expect(result.isValid).toBe(false)
        expect(result.error).toContain('10 chiffres')
      }
    })

    it('rejects empty inputs, non-strings, or strings containing letters', () => {
      expect(validateAlgerianPhone('').isValid).toBe(false)
      expect(validateAlgerianPhone('   ').isValid).toBe(false)
      expect((validateAlgerianPhone as any)(null).isValid).toBe(false)
      expect((validateAlgerianPhone as any)(undefined).isValid).toBe(false)
      expect(validateAlgerianPhone('0550abcd56').isValid).toBe(false)
    })
  })

  describe('validateFutureDateTime', () => {
    beforeEach(() => {
      // Mock fixed reference date: 2026-09-24 14:00:00
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 8, 24, 14, 0, 0))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('accepts appointments scheduled for tomorrow or future dates', () => {
      // Tomorrow
      const tomorrowResult = validateFutureDateTime('2026-09-25')
      expect(tomorrowResult.isValid).toBe(true)

      // Next month with explicit hour
      const nextMonthResult = validateFutureDateTime('2026-10-15', '10:30')
      expect(nextMonthResult.isValid).toBe(true)

      // Later today
      const laterTodayResult = validateFutureDateTime('2026-09-24', '16:00')
      expect(laterTodayResult.isValid).toBe(true)

      // Date instance in the future
      const futureDateObj = new Date(2026, 8, 25, 9, 0, 0)
      expect(validateFutureDateTime(futureDateObj).isValid).toBe(true)
    })

    it('rejects past dates with an explicit French error message', () => {
      // Yesterday
      const pastResult = validateFutureDateTime('2026-09-23')
      expect(pastResult.isValid).toBe(false)
      expect(pastResult.error).toBe(
        "La date et l'heure du rendez-vous doivent être strictement ultérieures au moment actuel."
      )

      // Past year
      const lastYearResult = validateFutureDateTime('2025-05-10', '09:00')
      expect(lastYearResult.isValid).toBe(false)
      expect(lastYearResult.error).toContain('strictement ultérieures au moment actuel')
    })

    it('rejects appointments earlier today before current time', () => {
      // Current mock time is 14:00, scheduling for 09:30 today
      const earlierTodayResult = validateFutureDateTime('2026-09-24', '09:30')
      expect(earlierTodayResult.isValid).toBe(false)
      expect(earlierTodayResult.error).toBe(
        "La date et l'heure du rendez-vous doivent être strictement ultérieures au moment actuel."
      )

      // Scheduling exactly for current time
      const exactTimeResult = validateFutureDateTime('2026-09-24', '14:00')
      expect(exactTimeResult.isValid).toBe(false)
    })

    it('handles missing or invalid date strings properly', () => {
      expect(validateFutureDateTime('').isValid).toBe(false)
      expect(validateFutureDateTime('').error).toBe('La date du rendez-vous est requise.')

      const invalidResult = validateFutureDateTime('not-a-date')
      expect(invalidResult.isValid).toBe(false)
      expect(invalidResult.error).toBe('Format de date ou d’heure invalide.')
    })
  })

  describe('validateRequiredField', () => {
    it('accepts filled text and numbers', () => {
      expect(validateRequiredField('Mansouri').isValid).toBe(true)
      expect(validateRequiredField('Amine', 'Prénom').isValid).toBe(true)
      expect(validateRequiredField(100, 'Code').isValid).toBe(true)
    })

    it('rejects null, undefined, empty or whitespace-only strings with localized message', () => {
      const emptyResult = validateRequiredField('', 'Nom du patient')
      expect(emptyResult.isValid).toBe(false)
      expect(emptyResult.error).toBe('Le champ "Nom du patient" est obligatoire.')

      const whitespaceResult = validateRequiredField('   ', 'Prénom')
      expect(whitespaceResult.isValid).toBe(false)
      expect(whitespaceResult.error).toBe('Le champ "Prénom" est obligatoire.')

      const nullResult = validateRequiredField(null)
      expect(nullResult.isValid).toBe(false)
      expect(nullResult.error).toBe('Le champ "Ce champ" est obligatoire.')

      const undefinedResult = validateRequiredField(undefined, 'Téléphone')
      expect(undefinedResult.isValid).toBe(false)
      expect(undefinedResult.error).toBe('Le champ "Téléphone" est obligatoire.')
    })
  })

  describe('validatePositiveNumber', () => {
    it('accepts positive numbers and decimal numbers with comma or dot (Algerian Dinars)', () => {
      expect(validatePositiveNumber(2500).isValid).toBe(true)
      expect(validatePositiveNumber('3500').isValid).toBe(true)
      expect(validatePositiveNumber('1500.50').isValid).toBe(true)
      expect(validatePositiveNumber('1500,50').isValid).toBe(true)
      expect(validatePositiveNumber(0.01).isValid).toBe(true)
    })

    it('rejects zero when allowZero is false (default)', () => {
      const zeroResult = validatePositiveNumber(0, 'Le montant de la facture')
      expect(zeroResult.isValid).toBe(false)
      expect(zeroResult.error).toBe(
        'Le montant de la facture doit être un montant positif supérieur à zéro.'
      )

      const zeroStrResult = validatePositiveNumber('0', 'Le prix')
      expect(zeroStrResult.isValid).toBe(false)
    })

    it('accepts zero when allowZero is true', () => {
      const zeroResult = validatePositiveNumber(0, 'La remise', true)
      expect(zeroResult.isValid).toBe(true)

      const zeroStrResult = validatePositiveNumber('0', 'La remise', true)
      expect(zeroStrResult.isValid).toBe(true)
    })

    it('rejects negative numbers regardless of allowZero flag', () => {
      const negativeResult = validatePositiveNumber(-500, 'Le tarif', false)
      expect(negativeResult.isValid).toBe(false)
      expect(negativeResult.error).toContain('doit être un montant positif supérieur à zéro')

      const negativeWithZeroAllowed = validatePositiveNumber('-150', 'Le tarif', true)
      expect(negativeWithZeroAllowed.isValid).toBe(false)
      expect(negativeWithZeroAllowed.error).toContain('doit être un nombre positif ou nul')
    })

    it('rejects non-numeric strings, empty values, null, or undefined', () => {
      expect(validatePositiveNumber('').isValid).toBe(false)
      expect(validatePositiveNumber(null).isValid).toBe(false)
      expect(validatePositiveNumber(undefined).isValid).toBe(false)
      expect(validatePositiveNumber('abc', 'Honoraires').isValid).toBe(false)
      expect(validatePositiveNumber('abc', 'Honoraires').error).toBe(
        'Honoraires doit être un nombre valide.'
      )
    })
  })
})
