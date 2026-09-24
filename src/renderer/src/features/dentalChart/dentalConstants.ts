/**
 * Dental Chart FDI Constants & Helpers
 * Supports:
 * - Adult permanent dentition (11-48) - 32 teeth
 * - Pediatric deciduous / temporary dentition (51-85) - 20 teeth
 * - Mixed dentition (6-12 years)
 */

export type DentitionMode = 'ADULT' | 'MIXED' | 'PEDIATRIC'

// 1. Adult Permanent Dentition (FDI 11-48)
export const UPPER_RIGHT_ADULT = [18, 17, 16, 15, 14, 13, 12, 11]
export const UPPER_LEFT_ADULT = [21, 22, 23, 24, 25, 26, 27, 28]
export const LOWER_RIGHT_ADULT = [48, 47, 46, 45, 44, 43, 42, 41]
export const LOWER_LEFT_ADULT = [31, 32, 33, 34, 35, 36, 37, 38]

export const MAXILLARY_ADULT = [...UPPER_RIGHT_ADULT, ...UPPER_LEFT_ADULT]
export const MANDIBULAR_ADULT = [...LOWER_RIGHT_ADULT, ...LOWER_LEFT_ADULT]
export const ALL_ADULT_TEETH = [...MAXILLARY_ADULT, ...MANDIBULAR_ADULT]

// 2. Pediatric Deciduous Dentition (FDI Déciduales 51-85)
export const UPPER_RIGHT_PEDIATRIC = [55, 54, 53, 52, 51]
export const UPPER_LEFT_PEDIATRIC = [61, 62, 63, 64, 65]
export const LOWER_RIGHT_PEDIATRIC = [85, 84, 83, 82, 81]
export const LOWER_LEFT_PEDIATRIC = [71, 72, 73, 74, 75]

export const MAXILLARY_PEDIATRIC = [...UPPER_RIGHT_PEDIATRIC, ...UPPER_LEFT_PEDIATRIC]
export const MANDIBULAR_PEDIATRIC = [...LOWER_RIGHT_PEDIATRIC, ...LOWER_LEFT_PEDIATRIC]
export const ALL_PEDIATRIC_TEETH = [...MAXILLARY_PEDIATRIC, ...MANDIBULAR_PEDIATRIC]

// Helper mappings for mixed dentition corresponding deciduous to adult teeth
export const DECIDUOUS_TO_PERMANENT_SUCCESSOR: Record<number, number> = {
  51: 11, 52: 12, 53: 13, 54: 14, 55: 15,
  61: 21, 62: 22, 63: 23, 64: 24, 65: 25,
  71: 31, 72: 32, 73: 33, 74: 34, 75: 35,
  81: 41, 82: 42, 83: 43, 84: 44, 85: 45
}

/**
 * Checks whether a given tooth number belongs to pediatric deciduous dentition (51-85).
 */
export function isPediatricTooth(toothNumber: number): boolean {
  return (
    (toothNumber >= 51 && toothNumber <= 55) ||
    (toothNumber >= 61 && toothNumber <= 65) ||
    (toothNumber >= 71 && toothNumber <= 75) ||
    (toothNumber >= 81 && toothNumber <= 85)
  )
}

/**
 * Checks whether a given tooth number belongs to the maxillary (upper) arch.
 */
export function isUpperTooth(toothNumber: number): boolean {
  return (
    (toothNumber >= 11 && toothNumber <= 28) ||
    (toothNumber >= 51 && toothNumber <= 65)
  )
}

/**
 * Calculates patient age and recommended dentition mode:
 * - < 6 years: PEDIATRIC (51-85)
 * - 6 to 12 years: MIXED (Mixed overlay)
 * - > 12 years: ADULT (11-48)
 */
export function calculateDentitionMode(birthDateStr?: string | null): {
  mode: DentitionMode
  age: number | null
} {
  if (!birthDateStr) {
    return { mode: 'ADULT', age: null }
  }

  const birthDate = new Date(birthDateStr)
  if (isNaN(birthDate.getTime())) {
    return { mode: 'ADULT', age: null }
  }

  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }

  if (age < 6) {
    return { mode: 'PEDIATRIC', age }
  } else if (age <= 12) {
    return { mode: 'MIXED', age }
  } else {
    return { mode: 'ADULT', age }
  }
}

/**
 * Returns human-readable anatomy name for an FDI tooth.
 */
export function getToothFdiName(toothNumber: number): string {
  const isPedia = isPediatricTooth(toothNumber)
  const prefix = isPedia ? 'Dent temporaire / lactéale' : 'Dent permanente'

  const quadrantNames: Record<number, string> = {
    1: 'Maxillaire Droit (Q1)',
    2: 'Maxillaire Gauche (Q2)',
    3: 'Mandibulaire Gauche (Q3)',
    4: 'Mandibulaire Droit (Q4)',
    5: 'Maxillaire Droit décidual (Q5)',
    6: 'Maxillaire Gauche décidual (Q6)',
    7: 'Mandibulaire Gauche décidual (Q7)',
    8: 'Mandibulaire Droit décidual (Q8)'
  }

  const quadrant = Math.floor(toothNumber / 10)
  const position = toothNumber % 10

  const permanentTypes: Record<number, string> = {
    1: 'Incisive centrale',
    2: 'Incisive latérale',
    3: 'Canine',
    4: 'Première prémolaire',
    5: 'Deuxième prémolaire',
    6: 'Première molaire (Dent de 6 ans)',
    7: 'Deuxième molaire (Dent de 12 ans)',
    8: 'Troisième molaire (Dent de sagesse)'
  }

  const deciduousTypes: Record<number, string> = {
    1: 'Incisive centrale de lait',
    2: 'Incisive latérale de lait',
    3: 'Canine de lait',
    4: 'Première molaire de lait',
    5: 'Deuxième molaire de lait'
  }

  const toothType = isPedia ? deciduousTypes[position] : permanentTypes[position]
  const quadrantName = quadrantNames[quadrant] || ''

  return `${prefix} #${toothNumber} · ${toothType || 'Dent'} (${quadrantName})`
}
