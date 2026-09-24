import React, { useState, useEffect } from 'react'
import { MedicalAct, Treatment } from '@shared/types'
import { billingService } from '../../services/billingService'

interface AddTreatmentModalProps {
  patientId: string
  preselectedTooth?: number | null
  onClose: () => void
  onSuccess: (treatment: Treatment) => void
}

export default function AddTreatmentModal({
  patientId,
  preselectedTooth,
  onClose,
  onSuccess
}: AddTreatmentModalProps): JSX.Element {
  const [acts, setActs] = useState<MedicalAct[]>([])
  const [selectedActId, setSelectedActId] = useState<string>('')
  const [actName, setActName] = useState<string>('')
  const [toothNumber, setToothNumber] = useState<number | string>(preselectedTooth || 16)
  const [price, setPrice] = useState<number>(0)
  const [status, setStatus] = useState<Treatment['status']>('COMPLETED')
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [dentistName, setDentistName] = useState<string>('Dr. Mohamed Amrani')
  const [notes, setNotes] = useState<string>('Traitement réalisé avec succès sous anesthésie locale sans complication')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load catalog of medical acts
  useEffect(() => {
    billingService.getMedicalActs().then((list) => {
      setActs(list)
      if (list.length > 0) {
        setSelectedActId(list[0].id)
        setActName(list[0].name)
        setPrice(list[0].defaultPrice)
      }
    })
  }, [])

  const handleActChange = (actId: string): void => {
    setSelectedActId(actId)
    const found = acts.find((a) => a.id === actId)
    if (found) {
      setActName(found.name)
      setPrice(found.defaultPrice)
    }
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!actName || price < 0) return

    setIsSubmitting(true)
    try {
      const saved = await billingService.saveTreatment({
        patientId,
        actId: selectedActId || undefined,
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
    <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-xl border border-outline-variant overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-outline-variant/60 bg-surface-container-low flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-secondary-fixed text-secondary flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-xl">medical_services</span>
            </div>
            <div>
              <h2 className="font-bold text-base text-on-surface">
                Ajouter un traitement {toothNumber ? `· Dent ${toothNumber}` : ''}
              </h2>
              <span className="text-xs text-on-surface-variant font-medium">
                Tarification en Dinars Algériens (DA)
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* Act selection */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
              Acte médical / Soin <span className="text-error">*</span>
            </label>
            <div className="relative">
              <select
                value={selectedActId}
                onChange={(e) => handleActChange(e.target.value)}
                className="w-full h-10 px-3 pr-8 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-xs font-medium text-on-surface transition-colors appearance-none cursor-pointer"
              >
                {acts.length > 0 ? (
                  acts.map((act) => (
                    <option key={act.id} value={act.id}>
                      {act.name} — {act.defaultPrice.toLocaleString()} DA ({act.category})
                    </option>
                  ))
                ) : (
                  <>
                    <option value="composite">Restauration Composite — 4 500 DA</option>
                    <option value="endo">Traitement Endodontique — 12 000 DA</option>
                    <option value="extraction">Extraction Simple — 3 000 DA</option>
                    <option value="couronne">Couronne Zircone — 28 000 DA</option>
                    <option value="detartrage">Détartrage & Polissage — 4 000 DA</option>
                  </>
                )}
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-lg">
                arrow_drop_down
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Tooth Number */}
            <div>
              <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
                Numéro de dent (FDI)
              </label>
              <input
                type="number"
                min="11"
                max="48"
                placeholder="Ex: 16 (Optionnel)"
                value={toothNumber}
                onChange={(e) => setToothNumber(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-xs text-on-surface transition-colors font-mono"
              />
            </div>

            {/* Price in DA */}
            <div>
              <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
                Montant en DA <span className="text-error">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="100"
                  required
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full h-10 pl-3 pr-10 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-xs font-bold text-on-surface transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-secondary">
                  DA
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Practitioner */}
            <div>
              <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
                Praticien
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
                Date de l'acte
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-xs text-on-surface transition-colors"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
              Statut de réalisation
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 'COMPLETED', label: 'Terminé', icon: 'check_circle', color: 'text-on-tertiary-container' },
                { val: 'IN_PROGRESS', label: 'En cours', icon: 'pending', color: 'text-pending-orange' },
                { val: 'PLANNED', label: 'Planifié', icon: 'schedule', color: 'text-secondary' }
              ].map((s) => (
                <button
                  key={s.val}
                  type="button"
                  onClick={() => setStatus(s.val as Treatment['status'])}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border text-xs font-semibold transition-all ${
                    status === s.val
                      ? 'border-secondary bg-secondary-fixed/40 text-on-surface ring-1 ring-secondary'
                      : 'border-outline-variant/60 text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <span className={`material-symbols-outlined text-base ${s.color}`}>{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
              Observations cliniques & Détails
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Anesthésie locale, digue posée, polymérisation 40s..."
              className="w-full px-3 py-2 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-xs text-on-surface resize-none transition-colors"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-outline-variant/40 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">save</span>
              <span>{isSubmitting ? 'Enregistrement...' : 'Enregistrer le traitement'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
