import React, { useState, useEffect, useMemo } from 'react'
import { DentalSpecialty, MedicalAct, Treatment } from '@shared/types'
import { clinicalService } from '../../services/clinicalService'
import { patientService } from '../../services/patientService'
import { evaluateClinicalAlerts, ClinicalAlert } from '../patients/medicalAlertUtils'

interface AddTreatmentModalProps {
  patientId: string
  preselectedTooth?: number | null
  onClose: () => void
  onSuccess: (treatment: Treatment) => void
}

interface SpecialtyMeta {
  key: DentalSpecialty | 'ALL'
  label: string
  shortLabel: string
  icon: string
  badgeClass: string
  dotClass: string
  borderClass: string
}

export const DENTAL_SPECIALTIES: SpecialtyMeta[] = [
  {
    key: 'ALL',
    label: 'Tous les actes',
    shortLabel: 'Tous',
    icon: 'apps',
    badgeClass: 'bg-surface-container-high text-on-surface border-outline-variant/60',
    dotClass: 'bg-secondary',
    borderClass: 'border-secondary'
  },
  {
    key: 'ODF',
    label: 'ODF / Orthodontie',
    shortLabel: 'ODF',
    icon: 'straighten',
    badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
    dotClass: 'bg-purple-500',
    borderClass: 'border-purple-500'
  },
  {
    key: 'PROTHESE_FIXE',
    label: 'Prothèse Fixe',
    shortLabel: 'Fixe',
    icon: 'shield',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
    dotClass: 'bg-amber-500',
    borderClass: 'border-amber-500'
  },
  {
    key: 'PROTHESE_AMOVIBLE',
    label: 'Prothèse Amovible',
    shortLabel: 'Amovible',
    icon: 'layers',
    badgeClass: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30',
    dotClass: 'bg-orange-500',
    borderClass: 'border-orange-500'
  },
  {
    key: 'CHIRURGIE',
    label: 'Chirurgie Orale',
    shortLabel: 'Chirurgie',
    icon: 'medical_services',
    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
    dotClass: 'bg-rose-500',
    borderClass: 'border-rose-500'
  },
  {
    key: 'IMPLANT',
    label: 'Implantologie',
    shortLabel: 'Implant',
    icon: 'hardware',
    badgeClass: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
    dotClass: 'bg-cyan-500',
    borderClass: 'border-cyan-500'
  },
  {
    key: 'SOINS',
    label: 'Soins & Endodontie',
    shortLabel: 'Soins/Endo',
    icon: 'dentistry',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    dotClass: 'bg-emerald-500',
    borderClass: 'border-emerald-500'
  },
  {
    key: 'CONSULTATION_IMAGERIE',
    label: 'Consultation & Radio',
    shortLabel: 'Radio/Bilan',
    icon: 'radiology',
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
    dotClass: 'bg-blue-500',
    borderClass: 'border-blue-500'
  },
  {
    key: 'PARODONTIE',
    label: 'Parodontie',
    shortLabel: 'Paro',
    icon: 'cleaning_services',
    badgeClass: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30',
    dotClass: 'bg-teal-500',
    borderClass: 'border-teal-500'
  }
]

export default function AddTreatmentModal({
  patientId,
  preselectedTooth,
  onClose,
  onSuccess
}: AddTreatmentModalProps): JSX.Element {
  const [acts, setActs] = useState<MedicalAct[]>([])
  const [selectedSpecialty, setSelectedSpecialty] = useState<DentalSpecialty | 'ALL'>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedActId, setSelectedActId] = useState<string>('')
  const [actName, setActName] = useState<string>('')
  const [toothNumber, setToothNumber] = useState<number | string>(preselectedTooth || '')
  const [price, setPrice] = useState<number>(0)
  const [status, setStatus] = useState<Treatment['status']>('COMPLETED')
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [dentistName, setDentistName] = useState<string>('Dr. Mohamed Amrani')
  const [notes, setNotes] = useState<string>('Traitement réalisé avec succès sous anesthésie locale sans complication')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCustomAct, setIsCustomAct] = useState(false)
  const [clinicalAlerts, setClinicalAlerts] = useState<ClinicalAlert[]>([])

  // Load catalog of medical acts and patient clinical alerts
  useEffect(() => {
    clinicalService.getMedicalActs().then((list) => {
      setActs(list)
      if (list.length > 0) {
        setSelectedActId(list[0].id)
        setActName(list[0].name)
        setPrice(list[0].defaultPrice)
      }
    })

    const fetchAlerts = async (): Promise<void> => {
      try {
        const [pat, hist] = await Promise.all([
          patientService.getPatientById(patientId),
          patientService.getMedicalHistory(patientId)
        ])
        setClinicalAlerts(evaluateClinicalAlerts(hist, pat?.medicalAlerts))
      } catch (err) {
        console.warn('Could not load alerts for AddTreatmentModal', err)
      }
    }
    fetchAlerts()
  }, [patientId])

  // Filtered acts based on specialty and instant search
  const filteredActs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return acts.filter((act) => {
      const matchSpecialty = selectedSpecialty === 'ALL' || act.category === selectedSpecialty
      const matchSearch =
        !q ||
        act.name.toLowerCase().includes(q) ||
        (act.code && act.code.toLowerCase().includes(q))
      return matchSpecialty && matchSearch
    })
  }, [acts, selectedSpecialty, searchQuery])

  // Count acts per specialty for tab badges
  const specialtyCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: acts.length }
    for (const act of acts) {
      counts[act.category] = (counts[act.category] || 0) + 1
    }
    return counts
  }, [acts])

  // Currently selected act details
  const selectedAct = useMemo(() => {
    return acts.find((a) => a.id === selectedActId)
  }, [acts, selectedActId])

  // Handle act selection from cards
  const handleSelectAct = (act: MedicalAct): void => {
    setIsCustomAct(false)
    setSelectedActId(act.id)
    setActName(act.name)
    setPrice(act.defaultPrice)
  }

  const handleResetToCatalogPrice = (): void => {
    if (selectedAct) {
      setPrice(selectedAct.defaultPrice)
    }
  }

  const getSpecialtyMeta = (categoryKey: string): SpecialtyMeta => {
    return (
      DENTAL_SPECIALTIES.find((s) => s.key === categoryKey) || {
        key: 'ALL',
        label: categoryKey,
        shortLabel: categoryKey,
        icon: 'medical_services',
        badgeClass: 'bg-surface-container-high text-on-surface border-outline-variant/60',
        dotClass: 'bg-secondary',
        borderClass: 'border-secondary'
      }
    )
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!actName || price < 0) return

    setIsSubmitting(true)
    try {
      const saved = await clinicalService.saveTreatment({
        patientId,
        actId: !isCustomAct && selectedActId ? selectedActId : undefined,
        actName,
        toothNumber: toothNumber ? Number(toothNumber) : undefined,
        price: Number(price),
        status,
        date,
        dentistName,
        notes
      })
      onSuccess(saved)
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-surface-container-lowest w-full max-w-3xl rounded-2xl shadow-2xl border border-outline-variant/70 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-outline-variant/50 bg-surface-container-low flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary-fixed text-secondary flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-2xl">medical_services</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-on-surface">
                  Ajouter un acte clinique / traitement
                </h2>
                {toothNumber ? (
                  <span className="px-2 py-0.5 rounded-lg bg-secondary/10 text-secondary text-xs font-bold border border-secondary/20 font-mono">
                    Dent FDI {toothNumber}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-lg bg-surface-container-high text-on-surface-variant text-[11px] font-medium">
                    Acte global / arcade
                  </span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                Catalogue algérien en Dinars (DA) · 8 Spécialités Dentaires
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
            title="Fermer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Clinical Alerts Warning Bar */}
        {clinicalAlerts.length > 0 && (
          <div className="px-6 py-2 bg-rose-500/10 border-b border-rose-500/30 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">warning</span>
              <span>Alerte Sécurité Clinique :</span>
            </span>
            {clinicalAlerts.map((a) => (
              <span
                key={a.id}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${a.badgeBg} ${a.isPulsing ? 'animate-pulse' : ''}`}
                title={a.recommendation}
              >
                {a.title}
              </span>
            ))}
          </div>
        )}

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* 1. Instant Search & Mode Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-secondary">manage_search</span>
                <span>Recherche d'actes & Filtrage par Spécialité</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsCustomAct(!isCustomAct)
                  if (!isCustomAct) {
                    setSelectedActId('')
                    setActName('')
                    setPrice(0)
                  }
                }}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                  isCustomAct
                    ? 'bg-secondary text-on-secondary border-secondary'
                    : 'bg-surface border-outline-variant/60 text-secondary hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-sm">
                  {isCustomAct ? 'check_circle' : 'edit_note'}
                </span>
                <span>{isCustomAct ? 'Acte libre activé' : 'Saisir un acte hors-catalogue'}</span>
              </button>
            </div>

            {!isCustomAct && (
              <>
                {/* Instant Search Input */}
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrer instantanément par nom ou code (ex: Zircone, ODF-BRACK, Composite, Detartrage...)"
                    className="w-full h-10 pl-9 pr-24 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-xs text-on-surface placeholder:text-outline transition-colors font-medium"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center text-outline hover:text-on-surface text-xs"
                        title="Effacer la recherche"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    )}
                    <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                      {filteredActs.length} {filteredActs.length === 1 ? 'acte' : 'actes'}
                    </span>
                  </div>
                </div>

                {/* Specialty Filter Tabs (8 Spécialités + Tous) */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin pt-1">
                  {DENTAL_SPECIALTIES.map((spec) => {
                    const isSelected = selectedSpecialty === spec.key
                    const count = specialtyCounts[spec.key] || 0
                    return (
                      <button
                        key={spec.key}
                        type="button"
                        onClick={() => setSelectedSpecialty(spec.key)}
                        className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-secondary text-on-secondary border-secondary shadow-xs scale-[1.02]'
                            : 'bg-surface border-outline-variant/60 text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">{spec.icon}</span>
                        <span>{spec.shortLabel}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            isSelected
                              ? 'bg-on-secondary/20 text-on-secondary'
                              : 'bg-surface-container-high text-on-surface-variant'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Acts Catalog List / Grid */}
                <div className="border border-outline-variant/50 rounded-xl bg-surface-container-low/40 p-2 max-h-48 overflow-y-auto space-y-1.5 scrollbar-thin">
                  {filteredActs.length > 0 ? (
                    filteredActs.map((act) => {
                      const isSelected = selectedActId === act.id
                      const meta = getSpecialtyMeta(act.category)
                      return (
                        <div
                          key={act.id}
                          onClick={() => handleSelectAct(act)}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-surface-container-lowest border-secondary shadow-xs ring-1 ring-secondary'
                              : 'bg-surface border-outline-variant/40 hover:border-outline hover:bg-surface-container-low'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-outline'
                              }`}
                            >
                              <span className="material-symbols-outlined text-base">{meta.icon}</span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-xs text-on-surface truncate">
                                  {act.name}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md border ${meta.badgeClass}`}
                                >
                                  {meta.shortLabel}
                                </span>
                                {act.code && (
                                  <span className="text-[10px] font-mono text-outline font-medium">
                                    [{act.code}]
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-on-surface-variant mt-0.5">
                                <span className="flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[13px] text-outline">
                                    schedule
                                  </span>
                                  <span>{act.durationMinutes || 30} min</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex items-center gap-2">
                            <span className="font-bold text-xs text-secondary font-mono bg-secondary-fixed/50 px-2 py-1 rounded-lg border border-secondary/20">
                              {act.defaultPrice.toLocaleString()} DA
                            </span>
                            <span
                              className={`material-symbols-outlined text-lg ${
                                isSelected ? 'text-secondary font-bold' : 'text-outline/40'
                              }`}
                            >
                              {isSelected ? 'check_circle' : 'radio_button_unchecked'}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="py-8 text-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-3xl text-outline mb-1 block">
                        search_off
                      </span>
                      <p className="text-xs font-semibold">Aucun acte ne correspond à votre recherche</p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('')
                          setSelectedSpecialty('ALL')
                        }}
                        className="mt-2 text-xs text-secondary font-bold hover:underline inline-flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">restart_alt</span>
                        <span>Réinitialiser les filtres</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Custom Act Manual Input */}
            {isCustomAct && (
              <div className="p-3 bg-surface rounded-xl border border-secondary/40 space-y-2 animate-in fade-in">
                <label className="block text-xs font-bold text-on-surface uppercase tracking-wider">
                  Désignation de l'acte personnalisé <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Pose d'un mainteneur d'espace, Blanchiment ambulatoire..."
                  value={actName}
                  onChange={(e) => setActName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-xs font-medium text-on-surface"
                />
              </div>
            )}
          </div>

          {/* 2. Highlight Badge for Selected Act with Suggested Price in DA */}
          {!isCustomAct && selectedAct && (
            <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/60 flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`text-xs font-bold px-2 py-1 rounded-lg border flex items-center gap-1 shrink-0 ${
                    getSpecialtyMeta(selectedAct.category).badgeClass
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {getSpecialtyMeta(selectedAct.category).icon}
                  </span>
                  <span>{getSpecialtyMeta(selectedAct.category).label}</span>
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-on-surface truncate">
                    {selectedAct.name}
                  </div>
                  <div className="text-[11px] text-on-surface-variant flex items-center gap-2">
                    <span>
                      Tarif suggéré :{' '}
                      <strong className="text-on-surface">
                        {selectedAct.defaultPrice.toLocaleString()} DA
                      </strong>
                    </span>
                    <span>·</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                      Modifiable librement ci-dessous
                    </span>
                  </div>
                </div>
              </div>

              {price !== selectedAct.defaultPrice && (
                <button
                  type="button"
                  onClick={handleResetToCatalogPrice}
                  className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-surface border border-outline-variant text-secondary hover:bg-surface-container transition-colors shrink-0 flex items-center gap-1"
                  title="Rétablir le tarif catalogue suggéré"
                >
                  <span className="material-symbols-outlined text-sm">restart_alt</span>
                  <span>Rétablir ({selectedAct.defaultPrice.toLocaleString()} DA)</span>
                </button>
              )}
            </div>
          )}

          {/* 3. Form Details: Tooth, Price, Practitioner, Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Tooth Number (FDI) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-on-surface uppercase tracking-wider">
                  Numéro de dent (FDI)
                </label>
                {toothNumber ? (
                  <button
                    type="button"
                    onClick={() => setToothNumber('')}
                    className="text-[11px] text-outline hover:text-error transition-colors"
                  >
                    Effacer (acte global)
                  </button>
                ) : null}
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="11"
                  max="85"
                  placeholder="Ex: 16, 21, 46 (Optionnel si global)"
                  value={toothNumber}
                  onChange={(e) => setToothNumber(e.target.value)}
                  className="w-full h-10 px-3 pr-8 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-xs text-on-surface font-mono transition-colors"
                />
                <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-lg">
                  dentistry
                </span>
              </div>
            </div>

            {/* Price in DA (Tarif modifiable) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-on-surface uppercase tracking-wider">
                  Montant en Dinars (DA) <span className="text-error">*</span>
                </label>
                {selectedAct && price !== selectedAct.defaultPrice ? (
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                    Tarif personnalisé
                  </span>
                ) : null}
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="100"
                  required
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full h-10 pl-3 pr-12 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-sm font-bold text-on-surface font-mono transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-secondary">
                  DA
                </span>
              </div>
            </div>

            {/* Practitioner */}
            <div>
              <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
                Praticien traitant
              </label>
              <input
                type="text"
                value={dentistName}
                onChange={(e) => setDentistName(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-xs text-on-surface transition-colors"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
                Date de réalisation
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-xs text-on-surface transition-colors"
              />
            </div>
          </div>

          {/* 4. Realization Status */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1.5">
              Statut de réalisation
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  val: 'COMPLETED',
                  label: 'Terminé',
                  icon: 'check_circle',
                  color: 'text-emerald-700 dark:text-emerald-400',
                  bgActive: 'border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500'
                },
                {
                  val: 'IN_PROGRESS',
                  label: 'En cours',
                  icon: 'pending',
                  color: 'text-amber-700 dark:text-amber-400',
                  bgActive: 'border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-300 ring-1 ring-amber-500'
                },
                {
                  val: 'PLANNED',
                  label: 'Planifié',
                  icon: 'schedule',
                  color: 'text-secondary',
                  bgActive: 'border-secondary bg-secondary-fixed/40 text-on-surface ring-1 ring-secondary'
                }
              ].map((s) => (
                <button
                  key={s.val}
                  type="button"
                  onClick={() => setStatus(s.val as Treatment['status'])}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border text-xs font-semibold transition-all ${
                    status === s.val
                      ? s.bgActive
                      : 'border-outline-variant/60 text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <span className={`material-symbols-outlined text-base ${s.color}`}>{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 5. Clinical Observations */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
              Observations cliniques & Protocoles
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Anesthésie locale articaïne 1:100 000, digue posée, préparation, polymérisation..."
              className="w-full px-3 py-2 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-xs text-on-surface resize-none transition-colors"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-outline-variant/40 flex items-center justify-between gap-3">
            <div className="text-xs text-on-surface-variant font-medium">
              Total de l'acte :{' '}
              <span className="font-bold text-sm text-secondary font-mono">
                {Number(price).toLocaleString()} DA
              </span>
            </div>

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
                disabled={isSubmitting || !actName || price < 0}
                className="px-5 py-2 rounded-xl bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
              >
                <span className="material-symbols-outlined text-base">save</span>
                <span>{isSubmitting ? 'Enregistrement...' : 'Enregistrer le traitement'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
