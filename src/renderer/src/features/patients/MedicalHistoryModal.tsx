import React, { useState, useEffect, useMemo } from 'react'
import { Patient, MedicalAntecedentsRecord, GeneralRiskLevel } from '@shared/types'
import { patientService } from '../../services/patientService'
import { evaluateClinicalAlerts } from './medicalAlertUtils'

interface MedicalHistoryModalProps {
  patient: Patient
  onClose: () => void
  onSuccess: () => void
}

const CARDIO_OPTIONS = [
  'HTA (Hypertension artérielle)',
  'Maladie coronarienne / Angor',
  'Souffle au cœur',
  'Valves cardiaques artificielles (Prothèse valvulaire)',
  'Pacemaker / Défibrillateur implantable',
  'Antécédent d’Infarctus du myocarde (IDM)',
  'Antécédent d’Endocardite infectieuse'
]

const HEMATOLOGY_OPTIONS = [
  'Traitement Anticoagulant (AVK: Sintrom, AOD: Eliquis, Xarelto, Pradaxa)',
  'Antiagrégant plaquettaire (Aspirine, Plavix, Clopidogrel)',
  'Hémophilie / Maladie de Willebrand',
  'Tendance aux saignements prolongés / Thrombopénie',
  'Anémie sévère'
]

const GASTRO_OPTIONS = [
  'Hépatite virale B (VHB)',
  'Hépatite virale C (VHC)',
  'Cirrhose hépatique / Insuffisance hépatique',
  'Ulcère gastroduodénal / Reflux gastro-œsophagien (RGO)'
]

const RESPIRATORY_OPTIONS = [
  'Asthme bronchique',
  'BPCO (Bronchopneumopathie chronique obstructive)',
  'Insuffisance respiratoire / Apnée du sommeil'
]

const ENDOCRINE_OPTIONS = [
  'Diabète Type 1 (Insulino-dépendant)',
  'Diabète Type 2 (Non insulino-dépendant)',
  'Diabète Équilibré',
  'Diabète Non Équilibré',
  'Pathologie thyroïdienne (Hypo / Hyperthyroïdie)',
  'Insuffisance rénale chronique'
]

const ALLERGY_OPTIONS = [
  'Allergie à la Pénicilline & Bêta-lactamines',
  'Allergie au Latex',
  'Allergie aux Anesthésiques locaux avec Adrénaline',
  'Allergie aux Anti-inflammatoires (AINS / Aspirine)',
  'Allergie aux Sulfamides',
  'Allergie à l’Iode'
]

export default function MedicalHistoryModal({
  patient,
  onClose,
  onSuccess
}: MedicalHistoryModalProps): JSX.Element {
  const [historyRecord, setHistoryRecord] = useState<MedicalAntecedentsRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Checklist states
  const [cardio, setCardio] = useState<string[]>([])
  const [hematology, setHematology] = useState<string[]>([])
  const [gastro, setGastro] = useState<string[]>([])
  const [respiratory, setRespiratory] = useState<string[]>([])
  const [endocrine, setEndocrine] = useState<string[]>([])
  const [allergies, setAllergies] = useState<string[]>([])
  const [customAllergy, setCustomAllergy] = useState<string>('')

  // Physiological status
  const [isPregnantOrNursing, setIsPregnantOrNursing] = useState(false)
  const [pregnancyMonth, setPregnancyMonth] = useState<number | null>(null)

  // Risk and Notes
  const [generalRiskLevel, setGeneralRiskLevel] = useState<GeneralRiskLevel>('LOW')
  const [doctorNotes, setDoctorNotes] = useState<string>('')

  // Load existing data
  useEffect(() => {
    const loadData = async (): Promise<void> => {
      try {
        const record = await patientService.getMedicalHistory(patient.id)
        if (record) {
          setHistoryRecord(record)
          setCardio(record.cardioChecklist || [])
          setHematology(record.hematologyChecklist || [])
          setGastro(record.gastroChecklist || [])
          setRespiratory(record.respiratoryChecklist || [])
          setEndocrine(record.endocrineChecklist || [])
          setAllergies(record.allergiesChecklist || [])
          setIsPregnantOrNursing(Boolean(record.isPregnantOrNursing))
          setPregnancyMonth(record.pregnancyMonth ?? null)
          setGeneralRiskLevel(record.generalRiskLevel || 'LOW')
          setDoctorNotes(record.doctorNotes || '')
        } else if (patient.medicalAlerts) {
          // Parse legacy string alerts
          const leg = patient.medicalAlerts.toLowerCase()
          if (leg.includes('pénicilline') || leg.includes('penicilline')) {
            setAllergies(['Allergie à la Pénicilline & Bêta-lactamines'])
          } else if (leg.length > 0 && !leg.includes('aucune')) {
            setCustomAllergy(patient.medicalAlerts)
          }
        }
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [patient.id])

  // Toggle item in array
  const toggleItem = (list: string[], setList: (l: string[]) => void, item: string): void => {
    if (list.includes(item)) {
      setList(list.filter((x) => x !== item))
    } else {
      setList([...list, item])
    }
  }

  // Add custom allergy
  const handleAddCustomAllergy = (): void => {
    if (customAllergy.trim() && !allergies.includes(customAllergy.trim())) {
      setAllergies([...allergies, customAllergy.trim()])
      setCustomAllergy('')
    }
  }

  // Temporary record for live alerts preview
  const previewRecord = useMemo<MedicalAntecedentsRecord>(() => {
    return {
      id: historyRecord?.id || 'temp',
      patientId: patient.id,
      cardioChecklist: cardio,
      hematologyChecklist: hematology,
      gastroChecklist: gastro,
      respiratoryChecklist: respiratory,
      endocrineChecklist: endocrine,
      allergiesChecklist: allergies,
      isPregnantOrNursing,
      pregnancyMonth,
      generalRiskLevel,
      doctorNotes,
      updatedAt: new Date().toISOString()
    }
  }, [
    historyRecord,
    patient.id,
    cardio,
    hematology,
    gastro,
    respiratory,
    endocrine,
    allergies,
    isPregnantOrNursing,
    pregnancyMonth,
    generalRiskLevel,
    doctorNotes
  ])

  const liveAlerts = useMemo(() => {
    return evaluateClinicalAlerts(previewRecord, patient.medicalAlerts)
  }, [previewRecord, patient.medicalAlerts])

  // Suggested risk level auto-calculation
  useEffect(() => {
    const hasCritical =
      hematology.some((h) => /anticoagulant|hémophilie/i.test(h)) ||
      cardio.some((c) => /valves|endocardite/i.test(c)) ||
      allergies.length > 0

    const hasHigh =
      cardio.length > 0 ||
      endocrine.some((e) => /non équilibré|type 1/i.test(e)) ||
      isPregnantOrNursing

    if (hasCritical && generalRiskLevel === 'LOW') {
      setGeneralRiskLevel('CRITICAL')
    } else if (hasHigh && generalRiskLevel === 'LOW') {
      setGeneralRiskLevel('HIGH')
    }
  }, [cardio, hematology, endocrine, allergies, isPregnantOrNursing])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setIsSaving(true)
    try {
      // 1. Save medical history record
      await patientService.saveMedicalHistory({
        id: historyRecord?.id,
        patientId: patient.id,
        cardioChecklist: cardio,
        hematologyChecklist: hematology,
        gastroChecklist: gastro,
        respiratoryChecklist: respiratory,
        endocrineChecklist: endocrine,
        allergiesChecklist: allergies,
        isPregnantOrNursing,
        pregnancyMonth: isPregnantOrNursing ? pregnancyMonth : null,
        generalRiskLevel,
        doctorNotes
      })

      // 2. Also keep patient.medicalAlerts synchronized for high-level legacy views
      const summaryAlerts: string[] = []
      if (allergies.length > 0) summaryAlerts.push(allergies.join(', '))
      if (hematology.some((h) => /anticoagulant|hémophilie/i.test(h))) summaryAlerts.push('Risque Hémorragique')
      if (cardio.some((c) => /valve|pacemaker/i.test(c))) summaryAlerts.push('Risque Cardiaque / Valve')
      if (isPregnantOrNursing) summaryAlerts.push('Grossesse en cours')

      await patientService.savePatient({
        ...patient,
        medicalAlerts: summaryAlerts.length > 0 ? summaryAlerts.join(' · ') : null
      })

      onSuccess()
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <div className="bg-surface-container-lowest p-8 rounded-2xl flex items-center gap-3 text-secondary">
          <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
          <span className="text-sm font-semibold">Chargement du questionnaire médical...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-surface-container-lowest w-full max-w-4xl rounded-2xl shadow-2xl border border-outline-variant/70 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant/50 bg-surface-container-low flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-2xl">health_and_safety</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-on-surface">
                  Questionnaire Médical Systémique & Antécédents
                </h2>
                <span className="px-2 py-0.5 rounded-lg bg-surface-container-high text-secondary text-xs font-mono font-bold">
                  {patient.firstName} {patient.lastName} ({patient.patientNumber})
                </span>
              </div>
              <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                Évaluation clinique structurée par appareils pour la sécurité des soins bucco-dentaires
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Live Clinical Alerts Banner if any triggers active */}
        {liveAlerts.length > 0 && (
          <div className="px-6 py-2.5 bg-surface-container border-b border-outline-variant/40 flex items-center gap-2 flex-wrap shrink-0">
            <span className="text-[11px] font-bold text-outline uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-rose-500">warning</span>
              <span>Alertes Actives Détectées :</span>
            </span>
            {liveAlerts.map((alert) => (
              <span
                key={alert.id}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-xs ${
                  alert.badgeBg
                } ${alert.borderClass} ${alert.isPulsing ? 'animate-pulse' : ''}`}
                title={alert.recommendation}
              >
                <span className="material-symbols-outlined text-sm">{alert.icon}</span>
                <span>{alert.title}</span>
              </span>
            ))}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* 1. Appareil Cardiovasculaire (Cardio) */}
          <div className="p-4 rounded-xl bg-surface border border-outline-variant/60 space-y-3">
            <div className="flex items-center gap-2 border-b border-outline-variant/40 pb-2">
              <span className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-base">ecg_heart</span>
              </span>
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                1. Appareil Cardiovasculaire (Cardio)
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {CARDIO_OPTIONS.map((opt) => {
                const checked = cardio.includes(opt)
                return (
                  <label
                    key={opt}
                    className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all ${
                      checked
                        ? 'bg-rose-500/10 border-rose-500/40 text-on-surface'
                        : 'border-outline-variant/40 hover:bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItem(cardio, setCardio, opt)}
                      className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                    <span className="text-xs font-medium">{opt}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* 2. Hématologie & Hémostase (Risque Hémorragique) */}
          <div className="p-4 rounded-xl bg-surface border border-outline-variant/60 space-y-3">
            <div className="flex items-center gap-2 border-b border-outline-variant/40 pb-2">
              <span className="w-7 h-7 rounded-lg bg-red-500/10 text-red-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-base">bloodtype</span>
              </span>
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                <span>2. Hématologie & Troubles de l’Hémostase (Risque Hémorragique)</span>
                {hematology.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-red-600 text-white font-bold animate-pulse">
                    Pulsing Alert
                  </span>
                )}
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {HEMATOLOGY_OPTIONS.map((opt) => {
                const checked = hematology.includes(opt)
                return (
                  <label
                    key={opt}
                    className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all ${
                      checked
                        ? 'bg-red-500/10 border-red-500/50 text-on-surface font-semibold'
                        : 'border-outline-variant/40 hover:bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItem(hematology, setHematology, opt)}
                      className="mt-0.5 rounded text-red-600 focus:ring-red-500 cursor-pointer"
                    />
                    <span className="text-xs">{opt}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* 3. Système Digestif & Hépatique */}
          <div className="p-4 rounded-xl bg-surface border border-outline-variant/60 space-y-3">
            <div className="flex items-center gap-2 border-b border-outline-variant/40 pb-2">
              <span className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-base">local_hospital</span>
              </span>
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                3. Système Digestif & Pathologies Hépatiques
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {GASTRO_OPTIONS.map((opt) => {
                const checked = gastro.includes(opt)
                return (
                  <label
                    key={opt}
                    className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all ${
                      checked
                        ? 'bg-amber-500/10 border-amber-500/40 text-on-surface'
                        : 'border-outline-variant/40 hover:bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItem(gastro, setGastro, opt)}
                      className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className="text-xs font-medium">{opt}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* 4. Système Respiratoire */}
          <div className="p-4 rounded-xl bg-surface border border-outline-variant/60 space-y-3">
            <div className="flex items-center gap-2 border-b border-outline-variant/40 pb-2">
              <span className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-base">air</span>
              </span>
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                4. Système Respiratoire
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {RESPIRATORY_OPTIONS.map((opt) => {
                const checked = respiratory.includes(opt)
                return (
                  <label
                    key={opt}
                    className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all ${
                      checked
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-on-surface'
                        : 'border-outline-variant/40 hover:bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItem(respiratory, setRespiratory, opt)}
                      className="mt-0.5 rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                    />
                    <span className="text-xs font-medium">{opt}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* 5. Endocrinologie & Diabète */}
          <div className="p-4 rounded-xl bg-surface border border-outline-variant/60 space-y-3">
            <div className="flex items-center gap-2 border-b border-outline-variant/40 pb-2">
              <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-base">water_drop</span>
              </span>
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                5. Endocrinologie, Diabète & Métabolisme
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ENDOCRINE_OPTIONS.map((opt) => {
                const checked = endocrine.includes(opt)
                return (
                  <label
                    key={opt}
                    className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all ${
                      checked
                        ? 'bg-blue-500/10 border-blue-500/40 text-on-surface font-semibold'
                        : 'border-outline-variant/40 hover:bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItem(endocrine, setEndocrine, opt)}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs">{opt}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* 6. Allergies & Intolérances Médicamenteuses */}
          <div className="p-4 rounded-xl bg-surface border border-outline-variant/60 space-y-3">
            <div className="flex items-center gap-2 border-b border-outline-variant/40 pb-2">
              <span className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-base">emergency</span>
              </span>
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                <span>6. Allergies Médicamenteuses Majeures</span>
                {allergies.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-purple-600 text-white font-bold">
                    Contre-indication
                  </span>
                )}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ALLERGY_OPTIONS.map((opt) => {
                const checked = allergies.includes(opt)
                return (
                  <label
                    key={opt}
                    className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all ${
                      checked
                        ? 'bg-purple-500/15 border-purple-500 text-purple-900 dark:text-purple-200 font-bold'
                        : 'border-outline-variant/40 hover:bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItem(allergies, setAllergies, opt)}
                      className="mt-0.5 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <span className="text-xs">{opt}</span>
                  </label>
                )
              })}
            </div>

            {/* Custom Allergy Adder */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={customAllergy}
                onChange={(e) => setCustomAllergy(e.target.value)}
                placeholder="Autre allergie spécifique (ex: Codéine, Sulfites, etc.)..."
                className="flex-1 h-9 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant focus:border-secondary text-xs text-on-surface"
              />
              <button
                type="button"
                onClick={handleAddCustomAllergy}
                className="px-3 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-xs font-semibold border border-outline-variant/60 text-secondary"
              >
                + Ajouter l’allergie
              </button>
            </div>
          </div>

          {/* 7. Statut Physiologique (Femmes) */}
          <div className="p-4 rounded-xl bg-surface border border-outline-variant/60 space-y-3">
            <div className="flex items-center gap-2 border-b border-outline-variant/40 pb-2">
              <span className="w-7 h-7 rounded-lg bg-pink-500/10 text-pink-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-base">pregnant_woman</span>
              </span>
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                7. Statut Physiologique (Femmes)
              </h3>
            </div>

            <div className="flex items-center gap-6 flex-wrap">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPregnantOrNursing}
                  onChange={(e) => setIsPregnantOrNursing(e.target.checked)}
                  className="rounded text-pink-600 focus:ring-pink-500"
                />
                <span>Grossesse en cours / Allaitement maternel</span>
              </label>

              {isPregnantOrNursing && (
                <div className="flex items-center gap-2 animate-in fade-in">
                  <span className="text-xs text-on-surface-variant font-medium">Mois de grossesse :</span>
                  <select
                    value={pregnancyMonth || 1}
                    onChange={(e) => setPregnancyMonth(Number(e.target.value))}
                    className="h-8 px-2 rounded-lg bg-surface-container-lowest border border-outline-variant text-xs font-bold"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((m) => (
                      <option key={m} value={m}>
                        {m}ème mois {m <= 3 ? '(1er trimestre)' : m <= 6 ? '(2ème trimestre)' : '(3ème trimestre)'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* 8. Stratification du Risque Général & Notes Cliniques */}
          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/60 space-y-4">
            <div>
              <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-2">
                8. Stratification Globale du Risque Médical
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  {
                    level: 'LOW',
                    label: 'Risque Faible (LOW)',
                    color: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                  },
                  {
                    level: 'MODERATE',
                    label: 'Risque Modéré (MODERATE)',
                    color: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30'
                  },
                  {
                    level: 'HIGH',
                    label: 'Risque Élevé (HIGH)',
                    color: 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/30'
                  },
                  {
                    level: 'CRITICAL',
                    label: 'Risque Critique (CRITICAL)',
                    color: 'bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-500/40 font-bold'
                  }
                ].map((r) => (
                  <button
                    key={r.level}
                    type="button"
                    onClick={() => setGeneralRiskLevel(r.level as GeneralRiskLevel)}
                    className={`p-2.5 rounded-xl border text-xs font-semibold transition-all ${r.color} ${
                      generalRiskLevel === r.level ? 'ring-2 ring-secondary scale-[1.02]' : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Doctor Notes */}
            <div>
              <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
                Consignes, Recommandations & Antibioprophylaxie du Praticien
              </label>
              <textarea
                rows={3}
                value={doctorNotes}
                onChange={(e) => setDoctorNotes(e.target.value)}
                placeholder="Ex: Antibioprophylaxie recommandée (Amoxicilline 2g 1h avant geste invasif). Proscrire vasoconstricteur adrénaliné..."
                className="w-full px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant focus:border-secondary text-xs text-on-surface resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-outline-variant/40 flex items-center justify-between">
            <span className="text-xs text-on-surface-variant font-medium">
              Dernière mise à jour :{' '}
              <strong className="font-mono">{historyRecord?.updatedAt ? new Date(historyRecord.updatedAt).toLocaleDateString('fr-FR') : 'Non renseigné'}</strong>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">save</span>
                <span>{isSaving ? 'Enregistrement...' : 'Enregistrer le bilan médical'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
