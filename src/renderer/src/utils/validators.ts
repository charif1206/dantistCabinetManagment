/**
 * Moteur de validation centralisé - DentaFlow Algeria
 * Règles de validation métier avec messages d'erreurs en français adaptés au contexte algérien.
 */

export interface ValidationResult {
  isValid: boolean
  error?: string
}

/**
 * Valide un numéro de téléphone mobile algérien.
 * Doit commencer par 05, 06 ou 07 et comporter exactement 10 chiffres.
 * Accepte les espaces ou tirets de séparation qui sont nettoyés avant validation.
 *
 * @param phone Le numéro saisi (ex: "0550123456", "06 61 23 45 67")
 * @returns ValidationResult
 */
export function validateAlgerianPhone(phone: string): ValidationResult {
  if (!phone || typeof phone !== 'string') {
    return {
      isValid: false,
      error: 'Le numéro de téléphone est requis.'
    }
  }

  // Nettoyage des espaces, tirets et points
  const cleaned = phone.trim().replace(/[\s\-_.]/g, '')

  // Format algérien : 05XXXXXXXX, 06XXXXXXXX ou 07XXXXXXXX (10 chiffres au total)
  const algerianPhoneRegex = /^0[567][0-9]{8}$/

  if (!algerianPhoneRegex.test(cleaned)) {
    return {
      isValid: false,
      error:
        'Numéro de téléphone algérien invalide. Il doit commencer par 05, 06 ou 07 et comporter 10 chiffres (ex: 0550123456).'
    }
  }

  return { isValid: true }
}

/**
 * Valide que la date et l'heure fournies sont strictement supérieures à l'instant présent.
 *
 * @param dateStr Date au format YYYY-MM-DD ou objet Date
 * @param timeStr Heure facultative au format HH:mm
 * @returns ValidationResult
 */
export function validateFutureDateTime(dateStr: string | Date, timeStr?: string): ValidationResult {
  if (!dateStr) {
    return {
      isValid: false,
      error: 'La date du rendez-vous est requise.'
    }
  }

  let targetDate: Date

  if (dateStr instanceof Date) {
    targetDate = new Date(dateStr.getTime())
  } else {
    const trimmed = dateStr.trim()
    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    const isIsoDate = datePattern.test(trimmed)

    if (isIsoDate && timeStr) {
      const [hours, minutes] = timeStr.split(':').map(Number)
      targetDate = new Date(trimmed)
      targetDate.setHours(isNaN(hours) ? 0 : hours, isNaN(minutes) ? 0 : minutes, 0, 0)
    } else if (isIsoDate) {
      targetDate = new Date(`${trimmed}T23:59:59`)
    } else {
      targetDate = new Date(trimmed)
    }
  }

  if (isNaN(targetDate.getTime())) {
    return {
      isValid: false,
      error: 'Format de date ou d’heure invalide.'
    }
  }

  const now = new Date()
  if (targetDate.getTime() <= now.getTime()) {
    return {
      isValid: false,
      error: "La date et l'heure du rendez-vous doivent être strictement ultérieures au moment actuel."
    }
  }

  return { isValid: true }
}

/**
 * Valide qu'un champ obligatoire est renseigné et non vide.
 *
 * @param value La valeur à tester
 * @param fieldName Nom du champ affiché dans le message d'erreur
 * @returns ValidationResult
 */
export function validateRequiredField(
  value: string | number | null | undefined,
  fieldName = 'Ce champ'
): ValidationResult {
  if (value === null || value === undefined) {
    return {
      isValid: false,
      error: `Le champ "${fieldName}" est obligatoire.`
    }
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    return {
      isValid: false,
      error: `Le champ "${fieldName}" est obligatoire.`
    }
  }

  return { isValid: true }
}

/**
 * Valide qu'une valeur est un nombre positif valide (utile pour factures, paiements, honoraires en DA).
 *
 * @param value Nombre ou chaîne convertible en nombre
 * @param fieldName Nom du champ pour le message d'erreur
 * @param allowZero Si vrai, 0 est considéré comme valide (défaut: false)
 * @returns ValidationResult
 */
export function validatePositiveNumber(
  value: number | string | null | undefined,
  fieldName = 'Le montant',
  allowZero = false
): ValidationResult {
  if (value === null || value === undefined || value === '') {
    return {
      isValid: false,
      error: `${fieldName} est requis et doit être un nombre valide.`
    }
  }

  const num = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))

  if (isNaN(num)) {
    return {
      isValid: false,
      error: `${fieldName} doit être un nombre valide.`
    }
  }

  if (allowZero ? num < 0 : num <= 0) {
    return {
      isValid: false,
      error: allowZero
        ? `${fieldName} doit être un nombre positif ou nul.`
        : `${fieldName} doit être un montant positif supérieur à zéro.`
    }
  }

  return { isValid: true }
}
