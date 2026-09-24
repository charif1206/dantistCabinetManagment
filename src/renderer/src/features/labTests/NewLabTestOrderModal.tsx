import React, { useState, useEffect } from 'react'
import { LabTestOrder, Patient } from '@shared/types'
import { labTestService } from '../../services/labTestService'
import { patientService } from '../../services/patientService'
import { useToast } from '../../context/ToastContext'

interface NewLabTestOrderModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newOrder: LabTestOrder, shouldPrint?: boolean) => void
  initialPatient?: Patient | null
  existingOrder?: LabTestOrder | null
}

const COMMON_TESTS: { category: string; tests: { name: string; desc: string; criticalHint?: string }[] }[] = [
  {
    category: '1. Glycémie & Métabolisme',
    tests: [
      { name: 'Glycémie à jeun', desc: 'Dépistage diabète (Seuil critique > 1.80 g/L)', criticalHint: '> 1.80 g/L' },
      { name: 'Hémoglobine glyquée (HbA1c)', desc: 'Équilibre glycémique des 3 derniers mois', criticalHint: '> 8.0%' }
    ]
  },
  {
    category: '2. Hémostase & Coagulation',
    tests: [
      { name: 'TP / INR', desc: 'Taux de prothrombine & INR (Seuil critique chirurgie > 3.0)', criticalHint: 'INR > 3.0' },
      { name: 'TCA (Temps de Céphaline Activée)', desc: 'Surveillance voie intrinsèque de la coagulation' },
      { name: 'Temps de Saignement (TS)', desc: 'Étude de l’hémostase primaire' }
    ]
  },
  {
    category: '3. Hématologie (NFS)',
    tests: [
      { name: 'FNS (NFS complète)', desc: 'Numération Formule Sanguine (Plaquettes, Hémoglobine)', criticalHint: 'Plt < 100.000' },
      { name: 'Plaquettes sanguines', desc: 'Recherche de thrombopénie pré-opératoire', criticalHint: '< 100.000 /mm³' }
    ]
  },
  {
    category: '4. Sérologies Infectieuses Pré-op',
    tests: [
      { name: 'Ag HBs (Hépatite B)', desc: 'Dépistage antigène de surface Hépatite B' },
      { name: 'Sérologie Anti-HCV (Hépatite C)', desc: 'Dépistage anticorps Hépatite C' },
      { name: 'Sérologie VIH 1 & 2', desc: 'Dépistage virus de l’immunodéficience humaine' }
    ]
  },
  {
    category: '5. Bilan Rénal & Minéral',
    tests: [
      { name: 'Créatininémie & Clairance', desc: 'Évaluation de la fonction rénale pré-médicamenteuse' },
      { name: 'Urée sanguine', desc: 'Fonction rénale & hydratation' },
      { name: 'Calcémie', desc: 'Bilan phosphocalcique & métabolisme osseux' }
    ]
  },
  {
    category: '6. Imagerie & Radiologie 2D/3D',
    tests: [
      { name: 'Orthopantomogramme (Radio Panoramique)', desc: 'Bilan osseux et dentaire global des 2 arcades' },
      { name: 'Cône Beam CBCT 3D (Secteur Ciblé)', desc: 'Rapports canal mandibulaire, nerf alvéolaire, sinus' }
    ]
  }
]

const QUICK_REASONS = [
  'Bilan pré-chirurgical avant avulsion de dent de sagesse incluse',
  'Bilan pré-implantaire & analyse de la densité osseuse',
  'Bilan d’hémostase pré-opératoire (Patient sous anticoagulant)',
  'Suspicion de diabète décompensé / Parodontite sévère agressive',
  'Bilan radiologique 3D Cône Beam pour pose d’implants'
]

export default function NewLabTestOrderModal({
  isOpen,
  onClose,
  onSuccess,
  initialPatient,
  existingOrder
}: NewLabTestOrderModalProps): JSX.Element | null {
  const { showToast } = useToast()

  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatient?.id || '')
  const [patientSearch, setPatientSearch] = useState(
    initialPatient ? `${initialPatient.lastName} ${initialPatient.firstName}` : ''
  )
  const [dentistName, setDentistName] = useState('Dr. Mohamed Amrani')
  const [requestDate, setRequestDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState(QUICK_REASONS[0])
  const [selectedTests, setSelectedTests] = useState<string[]>([
    'Glycémie à jeun',
    'TP / INR',
    'FNS (NFS complète)'
  ])
  const [customTestName, setCustomTestName] = useState('')
  const [shouldPrintImmediately, setShouldPrintImmediately] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const fetchPatients = async (): Promise<void> => {
      try {
        const pats = await patientService.getPatients()
        setPatients(pats)
        if (existingOrder) {
          setSelectedPatientId(existingOrder.patientId)
          const p = pats.find((item) => item.id === existingOrder.patientId)
          if (p) setPatientSearch(`${p.lastName} ${p.firstName}`)
          setDentistName(existingOrder.dentistName || 'Dr. Mohamed Amrani')
          setRequestDate(existingOrder.requestDate ? existingOrder.requestDate.slice(0, 10) : new Date().toISOString().slice(0, 10))
          setReason(existingOrder.reason || '')
          try {
            setSelectedTests(JSON.parse(existingOrder.testsRequestedJson || '[]'))
          } catch {
            setSelectedTests([])
          }
        } else if (initialPatient) {
          setSelectedPatientId(initialPatient.id)
          setPatientSearch(`${initialPatient.lastName} ${initialPatient.firstName}`)
        }
      } catch (err) {
        console.error('Error fetching patients for lab test order:', err)
      }
    }
    fetchPatients()
  }, [isOpen, initialPatient, existingOrder])

  const toggleTest = (name: string): void => {
    setSelectedTests((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]
    )
  }

  const handleAddCustomTest = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!customTestName.trim()) return
    if (!selectedTests.includes(customTestName.trim())) {
      setSelectedTests((prev) => [...prev, customTestName.trim()])
    }
    setCustomTestName('')
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!selectedPatientId) {
      showToast('Veuillez sélectionner un patient', 'error')
      return
    }
    if (selectedTests.length === 0) {
      showToast('Veuillez sélectionner au moins un examen ou analyse', 'error')
      return
    }

    setIsSubmitting(true)
    try {
      const saved = await labTestService.saveLabOrder({
        ...(existingOrder?.id ? { id: existingOrder.id } : {}),
        ...(existingOrder?.orderNumber ? { orderNumber: existingOrder.orderNumber } : {}),
        patientId: selectedPatientId,
        dentistName: dentistName || 'Dr. Mohamed Amrani',
        requestDate,
        reason: reason.trim() || null,
        testsRequestedJson: JSON.stringify(selectedTests),
        resultsJson: existingOrder?.resultsJson || '{}',
        isCriticalAlert: existingOrder?.isCriticalAlert || false,
        criticalAlertMessage: existingOrder?.criticalAlertMessage || null,
        status: existingOrder?.status || 'PENDING'
      })

      showToast(
        existingOrder
          ? `Prescription d'analyses ${saved.orderNumber} mise à jour`
          : `Demande d'analyses ${saved.orderNumber} créée avec succès`,
        'success'
      )
      onSuccess(saved, shouldPrintImmediately)
      onClose()
    } catch (err: any) {
      showToast(`Erreur enregistrement demande : ${err?.message || 'Erreur'}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const filteredPatients = patients.filter((p) =>
    `${p.lastName} ${p.firstName} ${p.patientNumber}`
      .toLowerCase()
      .includes(patientSearch.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-surface-container-lowest text-on-surface w-full max-w-3xl rounded-2xl shadow-2xl border border-outline-variant/60 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-surface-container-high border-b border-outline-variant/60 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-secondary text-2xl">
              biotech
            </span>
            <div>
              <h2 className="text-base font-bold text-on-surface">
                {existingOrder ? `Modifier Bilan ${existingOrder.orderNumber}` : 'Nouvelle Prescription d’Analyses & Examens Pré-opératoires'}
              </h2>
              <p className="text-xs text-on-surface-variant">
                Ordonnance de biologie médicale et radiologie dentaire (Sécurité chirurgicale)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-sm max-h-[82vh] overflow-y-auto">
          {/* Row 1: Patient, Dentist, Date */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-surface-container-low rounded-2xl border border-outline-variant/60">
            {/* Patient Search */}
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-bold text-on-surface flex items-center gap-1">
                <span>Patient Concerné</span>
                <span className="text-error">*</span>
              </label>
              {initialPatient ? (
                <div className="p-2 rounded-xl bg-surface border border-outline-variant/60 font-semibold text-xs flex items-center justify-between">
                  <span>{initialPatient.lastName.toUpperCase()} {initialPatient.firstName}</span>
                  <span className="font-mono text-secondary text-[11px] px-2 py-0.5 rounded bg-surface-container">
                    {initialPatient.patientNumber}
                  </span>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Chercher patient par nom, prénom ou N° dossier..."
                    value={patientSearch}
                    onChange={(e) => {
                      setPatientSearch(e.target.value)
                      setSelectedPatientId('')
                    }}
                    className="w-full px-3 py-1.5 rounded-xl border border-outline-variant bg-surface text-xs focus:ring-2 focus:ring-secondary/40 focus:outline-hidden"
                  />
                  {patientSearch && !selectedPatientId && filteredPatients.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-surface-container-high border border-outline-variant rounded-xl shadow-lg divide-y divide-outline-variant/30">
                      {filteredPatients.slice(0, 6).map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedPatientId(p.id)
                            setPatientSearch(`${p.lastName} ${p.firstName}`)
                          }}
                          className="px-3 py-2 text-xs hover:bg-surface-container cursor-pointer flex justify-between items-center"
                        >
                          <span className="font-semibold">{p.lastName} {p.firstName}</span>
                          <span className="font-mono text-[11px] text-secondary">{p.patientNumber}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Request Date */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface">Date de Prescription</label>
              <input
                type="date"
                required
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-outline-variant bg-surface text-xs font-mono"
              />
            </div>
          </div>

          {/* Row 2: Clinical Reason / Indication */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-on-surface">
                Motif Clinique / Indication Chirurgicale
              </label>
              <span className="text-[10px] text-outline">Exemples prédéfinis :</span>
            </div>
            <input
              type="text"
              placeholder="Ex: Bilan pré-chirurgical avant avulsion dent de sagesse 38 incluse"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-xs"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {QUICK_REASONS.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setReason(r)}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-surface-container border border-outline-variant/40 hover:bg-surface-container-high transition-colors cursor-pointer text-left truncate max-w-[260px]"
                  title={r}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Row 3: Comprehensive Test Categories Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface flex items-center gap-1.5 uppercase tracking-wide">
                <span className="material-symbols-outlined text-secondary text-base">checklist</span>
                <span>Sélection des Examens Biologiques & Radiologiques</span>
              </span>
              <span className="text-xs font-bold text-secondary">
                {selectedTests.length} analyse(s) sélectionnée(s)
              </span>
            </div>

            <div className="space-y-3">
              {COMMON_TESTS.map((cat, cIdx) => (
                <div key={cIdx} className="p-3 bg-surface-container rounded-2xl border border-outline-variant/60 space-y-2">
                  <span className="text-[11px] font-bold text-secondary uppercase tracking-wider block">
                    {cat.category}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {cat.tests.map((t) => {
                      const isChecked = selectedTests.includes(t.name)
                      return (
                        <div
                          key={t.name}
                          onClick={() => toggleTest(t.name)}
                          className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-secondary-fixed/20 border-secondary ring-1 ring-secondary/50'
                              : 'bg-surface border-outline-variant/40 hover:bg-surface-container-high'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by parent div
                            className="mt-0.5 rounded text-secondary focus:ring-secondary/40 cursor-pointer"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-on-surface">{t.name}</span>
                              {t.criticalHint && (
                                <span className="text-[10px] font-mono font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                  {t.criticalHint}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-on-surface-variant truncate mt-0.5">
                              {t.desc}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Custom test input */}
            <div className="flex items-center gap-2 p-2 bg-surface rounded-xl border border-outline-variant">
              <input
                type="text"
                placeholder="Ajouter une analyse spécifique libre (ex: Vitesse de sédimentation VS, Fer sérique...)"
                value={customTestName}
                onChange={(e) => setCustomTestName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddCustomTest(e)
                  }
                }}
                className="flex-1 bg-transparent px-2 text-xs focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddCustomTest}
                className="px-3 py-1 bg-secondary text-white rounded-lg text-xs font-bold hover:bg-secondary/90 cursor-pointer"
              >
                + Ajouter
              </button>
            </div>
          </div>

          {/* Row 4: Selected summary chips & Immediate Print Checkbox */}
          <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-on-surface-variant">Examens prescrits :</span>
              {selectedTests.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary/10 text-secondary text-[11px] font-medium font-mono"
                >
                  <span>{t}</span>
                  <button
                    type="button"
                    onClick={() => toggleTest(t)}
                    className="hover:text-rose-600 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={shouldPrintImmediately}
                onChange={(e) => setShouldPrintImmediately(e.target.checked)}
                className="rounded text-secondary focus:ring-secondary/40"
              />
              <span>Imprimer l'ordonnance après validation</span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-outline-variant/60 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-primary-container text-on-primary hover:bg-on-secondary-fixed-variant rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">
                {existingOrder ? 'save' : 'print'}
              </span>
              <span>
                {isSubmitting
                  ? 'Enregistrement...'
                  : existingOrder
                  ? 'Mettre à jour'
                  : 'Valider & Générer l’Ordonnance'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
