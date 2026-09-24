import { MedicalAntecedentsRecord } from '@shared/types'

export interface ClinicalAlert {
  id: string
  type: 'HEMORRHAGIC' | 'CARDIAC' | 'DIABETES' | 'ALLERGY' | 'PREGNANCY'
  title: string
  subtitle?: string
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'INFO'
  badgeBg: string
  badgeText: string
  borderClass: string
  icon: string
  isPulsing?: boolean
  recommendation?: string
}

/**
 * Evaluates a patient's medical history record (and optional legacy text alerts)
 * and returns structured clinical risk alerts.
 */
export function evaluateClinicalAlerts(
  history: MedicalAntecedentsRecord | null,
  legacyMedicalAlerts?: string | null
): ClinicalAlert[] {
  const alerts: ClinicalAlert[] = []

  const cardio = history?.cardioChecklist || []
  const hematology = history?.hematologyChecklist || []
  const endocrine = history?.endocrineChecklist || []
  const allergies = history?.allergiesChecklist || []
  const isPregnantOrNursing = Boolean(history?.isPregnantOrNursing)
  const pregnancyMonth = history?.pregnancyMonth
  const legacy = (legacyMedicalAlerts || '').toLowerCase()

  // 1. Risque Hémorragique (Critical Red Pulsing)
  const isAnticoag =
    hematology.some((h) => /anticoagulant|sintrom|eliquis|xarelto|pradaxa/i.test(h)) ||
    /anticoagulant|sintrom|eliquis|xarelto/i.test(legacy)
  const isAntiplatelet =
    hematology.some((h) => /antiagrégant|aspirine|plavix|clopidogrel/i.test(h)) ||
    /aspirine|plavix/i.test(legacy)
  const isHemophilia =
    hematology.some((h) => /hémophilie|willebrand|saignement|thrombopénie/i.test(h)) ||
    /hémophilie|saignement/i.test(legacy)

  if (isAnticoag || isAntiplatelet || isHemophilia) {
    const details: string[] = []
    if (isAnticoag) details.push('Anticoagulant (AVK / AOD)')
    if (isAntiplatelet) details.push('Antiagrégant plaquettaire')
    if (isHemophilia) details.push('Trouble hémostase / Hémophilie')

    alerts.push({
      id: 'alert_hemorrhagic',
      type: 'HEMORRHAGIC',
      title: 'Risque Hémorragique',
      subtitle: details.join(' · '),
      severity: 'CRITICAL',
      badgeBg: 'bg-rose-600 dark:bg-rose-700 text-white',
      badgeText: 'text-white',
      borderClass: 'border-rose-500 shadow-rose-500/20',
      icon: 'bloodtype',
      isPulsing: true,
      recommendation: 'Contrôler INR/TP avant tout acte invasif. Hémostase locale renforcée et surveillance post-opératoire.'
    })
  }

  // 2. Risque Infectieux / Cardiaque (Orange)
  const hasValve = cardio.some((c) => /valve|prothèse valvulaire/i.test(c)) || /valve/i.test(legacy)
  const hasPacemaker = cardio.some((c) => /pacemaker|défibrillateur|pile/i.test(c)) || /pacemaker/i.test(legacy)
  const hasEndocardite = cardio.some((c) => /endocardite/i.test(c)) || /endocardite/i.test(legacy)
  const hasSouffle = cardio.some((c) => /souffle/i.test(c)) || /souffle/i.test(legacy)
  const hasInfarctus = cardio.some((c) => /infarctus|coronarien|angor/i.test(c)) || /infarctus/i.test(legacy)

  if (hasValve || hasPacemaker || hasEndocardite || hasSouffle || hasInfarctus) {
    const details: string[] = []
    if (hasValve) details.push('Prothèse Valvulaire')
    if (hasPacemaker) details.push('Pacemaker')
    if (hasEndocardite) details.push('Antécédent Endocardite')
    if (hasSouffle) details.push('Souffle au cœur')
    if (hasInfarctus) details.push('Cardiopathie / Infarctus')

    alerts.push({
      id: 'alert_cardiac',
      type: 'CARDIAC',
      title: 'Risque Infectieux / Cardiaque',
      subtitle: details.join(' · '),
      severity: hasValve || hasEndocardite ? 'CRITICAL' : 'HIGH',
      badgeBg: 'bg-amber-600 dark:bg-amber-700 text-white',
      badgeText: 'text-white',
      borderClass: 'border-amber-500 shadow-amber-500/20',
      icon: 'ecg_heart',
      isPulsing: false,
      recommendation: hasValve || hasEndocardite
        ? 'Antibioprophylaxie obligatoire (ex: Amoxicilline 2g 1h avant geste invasif) selon recommandations HAS/AHA.'
        : 'Prudence avec les anesthésiques avec vasoconstricteur et détartrage ultrasonique.'
    })
  }

  // 3. Diabète (Bleu)
  const isUncontrolledDiabetes =
    endocrine.some((e) => /non équilibré|déséquilibré/i.test(e)) || /diabète.*non équilibré/i.test(legacy)
  const isDiabetes =
    isUncontrolledDiabetes ||
    endocrine.some((e) => /diabète/i.test(e)) ||
    /diabète|glycémie/i.test(legacy)

  if (isDiabetes) {
    alerts.push({
      id: 'alert_diabetes',
      type: 'DIABETES',
      title: isUncontrolledDiabetes ? 'Diabète Non Équilibré' : 'Patient Diabétique',
      subtitle: isUncontrolledDiabetes
        ? 'Retard de cicatrisation & Risque infectieux élevé'
        : 'Cicatrisation surveillée',
      severity: isUncontrolledDiabetes ? 'HIGH' : 'MODERATE',
      badgeBg: isUncontrolledDiabetes
        ? 'bg-blue-600 dark:bg-blue-700 text-white'
        : 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
      badgeText: isUncontrolledDiabetes ? 'text-white' : 'text-blue-700 dark:text-blue-300',
      borderClass: 'border-blue-500/30',
      icon: 'water_drop',
      recommendation: 'Privilégier les séances matinales, vérifier la prise du traitement antidiabétique et le petit-déjeuner.'
    })
  }

  // 4. Allergies Majeures (Violet)
  const allergyList = [...allergies]
  if (legacy && (legacy.includes('allergie') || legacy.includes('penicilline') || legacy.includes('latex'))) {
    if (!allergyList.some((a) => a.toLowerCase().includes(legacy))) {
      allergyList.push(legacyMedicalAlerts!)
    }
  }

  if (allergyList.length > 0) {
    allergyList.forEach((allg, idx) => {
      alerts.push({
        id: `alert_allergy_${idx}`,
        type: 'ALLERGY',
        title: `Allergie Majeure : ${allg.replace(/^Allergie\s*(à\s*la\s*|aux\s*|au\s*)?/i, '')}`,
        subtitle: 'Contre-indication stricte',
        severity: 'CRITICAL',
        badgeBg: 'bg-purple-600 dark:bg-purple-700 text-white',
        badgeText: 'text-white',
        borderClass: 'border-purple-500 shadow-purple-500/20',
        icon: 'warning',
        recommendation: `Ne prescrire aucun produit contenant ou dérivé de : ${allg}`
      })
    })
  }

  // 5. Grossesse & Allaitement (Rose)
  if (isPregnantOrNursing) {
    const subtitle = pregnancyMonth ? `${pregnancyMonth}ème mois de grossesse` : 'Grossesse / Allaitement'
    alerts.push({
      id: 'alert_pregnancy',
      type: 'PREGNANCY',
      title: 'Femme Enceinte / Allaitement',
      subtitle,
      severity: 'HIGH',
      badgeBg: 'bg-pink-600 dark:bg-pink-700 text-white',
      badgeText: 'text-white',
      borderClass: 'border-pink-500 shadow-pink-500/20',
      icon: 'pregnant_woman',
      recommendation: 'Éviter les radiographies non indispensables, tablier de plomb obligatoire. Contre-indication aux AINS et tétracyclines.'
    })
  }

  return alerts
}
