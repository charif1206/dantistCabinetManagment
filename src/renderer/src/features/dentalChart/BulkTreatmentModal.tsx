import React, { useState, useEffect, useMemo } from 'react'
import { MedicalAct, Treatment, ToothCondition } from '@shared/types'
import { clinicalService } from '../../services/clinicalService'
import { DENTAL_SPECIALTIES } from './AddTreatmentModal'
import { isPediatricTooth } from './dentalConstants'

interface BulkTreatmentModalProps {
  patientId: string
  selectedTeeth: number[]
  onClose: () => void
  onSuccess: () => void
}

const COMMON_BATCH_PRESETS = [
  { name: 'Détartrage & Polissage complet', price: 4000, category: 'PARODONTIE', isGlobal: true },
  { name: 'Application topique de Fluor (Vernis)', price: 3000, category: 'SOINS', isGlobal: true },
  { name: 'Scellement de sillons prophylactique (Sealant)', price: 2500, category: 'SOINS', isGlobal: false },
  { name: 'Blanchiment dentaire au fauteuil', price: 35000, category: 'SOINS', isGlobal: true },
  { name: 'Surfaçage radiculaire', price: 8000, category: 'PARODONTIE', isGlobal: true }
]

export default function BulkTreatmentModal({
  patientId,
  selectedTeeth,
  onClose,
  onSuccess
}: BulkTreatmentModalProps): JSX.Element {
  const [acts, setActs] = useState<MedicalAct[]>([])
  const [selectedActId, setSelectedActId] = useState<string>('')
  const [actName, setActName] = useState<string>('Détartrage & Polissage complet')
  const [pricingMode, setPricingMode] = useState<'GLOBAL' | 'PER_TOOTH'>('GLOBAL')
  const [amount, setAmount] = useState<number>(4000)
  const [status, setStatus] = useState<Treatment['status']>('COMPLETED')
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [dentistName, setDentistName] = useState<string>('Dr. Mohamed Amrani')
  const [notes, setNotes] = useState<string>(
    `Traitement groupé appliqué sur ${selectedTeeth.length} dents (${selectedTeeth.sort((a, b) => a - b).join(', ')})`
  )
  const [updateCondition, setUpdateCondition] = useState<ToothCondition | 'NONE'>('NONE')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load acts catalog
  useEffect(() => {
    clinicalService.getMedicalActs().then((list) => {
      setActs(list)
    })
  }, [])

  const sortedTeeth = useMemo(() => {
    return [...selectedTeeth].sort((a, b) => a - b)
  }, [selectedTeeth])

  // Calculate total price
  const totalPrice = useMemo(() => {
    if (pricingMode === 'GLOBAL') {
      return Number(amount) || 0
    } else {
      return (Number(amount) || 0) * selectedTeeth.length
    }
  }, [pricingMode, amount, selectedTeeth.length])

  const unitPricePerTooth = useMemo(() => {
    if (selectedTeeth.length === 0) return 0
    if (pricingMode === 'GLOBAL') {
      return Math.round((Number(amount) || 0) / selectedTeeth.length)
    } else {
      return Number(amount) || 0
    }
  }, [pricingMode, amount, selectedTeeth.length])

  const handleSelectAct = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const actId = e.target.value
    setSelectedActId(actId)
    const act = acts.find((a) => a.id === actId)
    if (act) {
      setActName(act.name)
      setAmount(act.defaultPrice)
    }
  }

  const handleApplyPreset = (preset: typeof COMMON_BATCH_PRESETS[0]): void => {
    setActName(preset.name)
    setAmount(preset.price)
    setPricingMode(preset.isGlobal ? 'GLOBAL' : 'PER_TOOTH')
    const match = acts.find((a) => a.name.toLowerCase().includes(preset.name.toLowerCase()))
    if (match) {
      setSelectedActId(match.id)
    }
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!actName || selectedTeeth.length === 0 || amount < 0) return

    setIsSubmitting(true)
    try {
      // 1. Record treatments for each tooth
      const promises = selectedTeeth.map((tooth) =>
        clinicalService.saveTreatment({
          patientId,
          actId: selectedActId || undefined,
          actName,
          toothNumber: tooth,
          price: unitPricePerTooth,
          status,
          date,
          dentistName,
          notes: `${notes} · Dent FDI ${tooth}`
        })
      )

      // 2. Optionally update tooth conditions
      if (updateCondition !== 'NONE') {
        selectedTeeth.forEach((tooth) => {
          promises.push(
            clinicalService.saveToothRecord({
              patientId,
              toothNumber: tooth,
              condition: updateCondition,
              notes: `Mise à jour groupée: ${actName}`
            }) as any
          )
        })
      }

      await Promise.all(promises)
      onSuccess()
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-surface-container-lowest w-full max-w-xl rounded-2xl shadow-2xl border border-outline-variant/70 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant/50 bg-surface-container-low flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary text-on-secondary flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-2xl">select_all</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-on-surface">
                  Action Groupée sur {selectedTeeth.length} Dents
                </h2>
                <span className="px-2 py-0.5 rounded-lg bg-secondary/10 text-secondary text-xs font-bold border border-secondary/20">
                  {selectedTeeth.length} sélectionnée(s)
                </span>
              </div>
              <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                Appliquer un traitement ou un diagnostic en masse en un seul clic
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Selected Teeth Chips Display */}
          <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/50 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-on-surface">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-secondary">dentistry</span>
                <span>Dents sélectionnées ({selectedTeeth.length})</span>
              </span>
              <span className="text-[11px] text-outline font-normal">
                {selectedTeeth.some(isPediatricTooth) ? 'Comprend des dents temporaires (51-85)' : 'Dents permanentes (11-48)'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1 scrollbar-thin">
              {sortedTeeth.map((tooth) => {
                const isPedia = isPediatricTooth(tooth)
                return (
                  <span
                    key={tooth}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono font-bold border ${
                      isPedia
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                        : 'bg-surface-container-high text-on-surface border-outline-variant/60'
                    }`}
                  >
                    #{tooth}
                    {isPedia && <span className="text-[9px] font-sans font-normal text-amber-600">lait</span>}
                  </span>
                )
              })}
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1.5">
              Protocoles Fréquents en Groupe
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_BATCH_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-surface border border-outline-variant/60 hover:border-secondary hover:bg-secondary-fixed/30 text-on-surface transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm text-secondary">bolt</span>
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Medical Act Selection from Catalog */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
              Acte médical / Soin <span className="text-error">*</span>
            </label>
            <div className="relative">
              <select
                value={selectedActId}
                onChange={handleSelectAct}
                className="w-full h-10 px-3 pr-8 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-xs font-medium text-on-surface transition-colors appearance-none cursor-pointer"
              >
                <option value="">-- Sélectionner depuis le catalogue ou saisir manuellement --</option>
                {acts.map((act) => (
                  <option key={act.id} value={act.id}>
                    [{act.code}] {act.name} — {act.defaultPrice.toLocaleString()} DA ({act.category})
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-lg">
                arrow_drop_down
              </span>
            </div>

            {/* Custom Act Name if needed */}
            <input
              type="text"
              required
              value={actName}
              onChange={(e) => setActName(e.target.value)}
              placeholder="Désignation de l'acte appliqué"
              className="w-full h-9 px-3 mt-1.5 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-xs text-on-surface"
            />
          </div>

          {/* Pricing Options */}
          <div className="p-3 bg-surface rounded-xl border border-outline-variant/60 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-on-surface uppercase tracking-wider">
                Mode de Tarification (Dinars Algériens)
              </label>
              <div className="flex items-center gap-1 bg-surface-container-high p-0.5 rounded-lg border border-outline-variant/40">
                <button
                  type="button"
                  onClick={() => setPricingMode('GLOBAL')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                    pricingMode === 'GLOBAL'
                      ? 'bg-secondary text-on-secondary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Forfait Global
                </button>
                <button
                  type="button"
                  onClick={() => setPricingMode('PER_TOOTH')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                    pricingMode === 'PER_TOOTH'
                      ? 'bg-secondary text-on-secondary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Par Dent (×{selectedTeeth.length})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                  {pricingMode === 'GLOBAL' ? 'Montant Forfaitaire Total' : 'Tarif Unitaire / Dent'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="100"
                    required
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full h-10 pl-3 pr-10 rounded-xl bg-surface-container-lowest border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-sm font-bold font-mono text-on-surface"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-secondary">
                    DA
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-surface-container-high border border-outline-variant/40 text-right">
                <span className="text-[11px] text-on-surface-variant block font-medium">
                  {pricingMode === 'GLOBAL'
                    ? `Soit ~${unitPricePerTooth.toLocaleString()} DA / dent`
                    : `${amount.toLocaleString()} DA × ${selectedTeeth.length} dents`}
                </span>
                <span className="text-sm font-bold text-secondary font-mono">
                  Total : {totalPrice.toLocaleString()} DA
                </span>
              </div>
            </div>
          </div>

          {/* Optional Tooth Condition Update */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
              Mettre à jour l'état visuel du schéma dentaire (Optionnel)
            </label>
            <select
              value={updateCondition}
              onChange={(e) => setUpdateCondition(e.target.value as any)}
              className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-xs font-medium text-on-surface"
            >
              <option value="NONE">Ne pas changer l'état graphique des dents</option>
              <option value="HEALTHY">Marquer comme Saines (HEALTHY)</option>
              <option value="FILLED_COMPOSITE">Marquer avec Composite / Obturation</option>
              <option value="CROWN">Marquer comme Couronnes</option>
              <option value="MISSING">Marquer comme Absentes</option>
              <option value="EXTRACTION_PLANNED">Marquer pour Extraction Prévue</option>
            </select>
          </div>

          {/* Status & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
                Statut
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Treatment['status'])}
                className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant text-xs font-medium text-on-surface"
              >
                <option value="COMPLETED">Terminé (COMPLETED)</option>
                <option value="IN_PROGRESS">En cours (IN_PROGRESS)</option>
                <option value="PLANNED">Planifié (PLANNED)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
                Date de réalisation
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface"
              />
            </div>
          </div>

          {/* Observations */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
              Observations cliniques
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-xs text-on-surface resize-none"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-outline-variant/40 flex items-center justify-between gap-3">
            <div className="text-xs text-on-surface-variant font-medium">
              Facturation globale :{' '}
              <strong className="text-secondary font-mono font-bold text-sm">
                {totalPrice.toLocaleString()} DA
              </strong>
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
                disabled={isSubmitting || selectedTeeth.length === 0}
                className="px-5 py-2 rounded-xl bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">done_all</span>
                <span>
                  {isSubmitting
                    ? 'Application...'
                    : `Appliquer aux ${selectedTeeth.length} dents`}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
