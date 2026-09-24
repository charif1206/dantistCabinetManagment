import React, { useState, useEffect } from 'react'
import { ToothRecord } from '@shared/types'
import { isPediatricTooth, getToothFdiName } from './dentalConstants'
import { patientService } from '../../services/patientService'
import { evaluateClinicalAlerts, ClinicalAlert } from '../patients/medicalAlertUtils'

interface ToothDetailModalProps {
  toothNumber: number
  patientId: string
  initialRecord?: ToothRecord
  onClose: () => void
  onSave: (record: Omit<ToothRecord, 'id' | 'updatedAt'>) => Promise<void>
  onAddTreatment: (toothNumber: number) => void
}

const CONDITIONS: { value: ToothRecord['condition']; label: string; color: string; icon: string }[] = [
  { value: 'HEALTHY', label: 'Dent Saine', color: 'border-slate-300 bg-white text-slate-700', icon: 'check_circle' },
  { value: 'CARIES', label: 'Carie / Lésion', color: 'border-error bg-error-container text-error', icon: 'report' },
  { value: 'FILLED_COMPOSITE', label: 'Composite / Résine', color: 'border-secondary bg-secondary-fixed text-on-secondary-fixed', icon: 'dentistry' },
  { value: 'FILLED_AMALGAM', label: 'Amalgame Gris', color: 'border-slate-500 bg-slate-200 text-slate-900', icon: 'lens' },
  { value: 'CROWN', label: 'Couronne / Prothèse', color: 'border-amber-400 bg-amber-100 text-amber-900', icon: 'workspace_premium' },
  { value: 'ROOT_CANAL', label: 'Traitement Endo', color: 'border-emerald-500 bg-emerald-50 text-emerald-800', icon: 'healing' },
  { value: 'MISSING', label: 'Dent Absente', color: 'border-slate-400 bg-slate-100 text-slate-500', icon: 'close' },
  { value: 'IMPLANT', label: 'Implant Dentaire', color: 'border-purple-500 bg-purple-50 text-purple-900', icon: 'hardware' },
  { value: 'EXTRACTION_PLANNED', label: 'Extraction Prévue', color: 'border-orange-500 bg-orange-100 text-orange-900', icon: 'delete_forever' }
]

const SURFACES = [
  { key: 'M', label: 'Mésiale (M)' },
  { key: 'O', label: 'Occlusale / Incisive (O)' },
  { key: 'D', label: 'Distale (D)' },
  { key: 'V', label: 'Vestibulaire (V)' },
  { key: 'L', label: 'Linguale / Palatine (L)' }
]

export default function ToothDetailModal({
  toothNumber,
  patientId,
  initialRecord,
  onClose,
  onSave,
  onAddTreatment
}: ToothDetailModalProps): JSX.Element {
  const isPedia = isPediatricTooth(toothNumber)
  const [condition, setCondition] = useState<ToothRecord['condition']>(initialRecord?.condition || 'CARIES')
  const [selectedSurfaces, setSelectedSurfaces] = useState<string[]>(
    initialRecord?.surfaces ? initialRecord.surfaces.split('').filter(Boolean) : ['O', 'M']
  )
  const [notes, setNotes] = useState(
    initialRecord?.notes || 'Carie dentinaire occluso-mésiale à traiter en composite'
  )
  const [isSaving, setIsSaving] = useState(false)
  const [clinicalAlerts, setClinicalAlerts] = useState<ClinicalAlert[]>([])

  useEffect(() => {
    const fetchAlerts = async (): Promise<void> => {
      try {
        const [pat, hist] = await Promise.all([
          patientService.getPatientById(patientId),
          patientService.getMedicalHistory(patientId)
        ])
        const evaluated = evaluateClinicalAlerts(hist, pat?.medicalAlerts)
        setClinicalAlerts(evaluated)
      } catch (err) {
        console.warn('Could not load alerts for ToothDetailModal', err)
      }
    }
    fetchAlerts()
  }, [patientId])

  const toggleSurface = (key: string): void => {
    if (selectedSurfaces.includes(key)) {
      setSelectedSurfaces(selectedSurfaces.filter((s) => s !== key))
    } else {
      setSelectedSurfaces([...selectedSurfaces, key])
    }
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await onSave({
        patientId,
        toothNumber,
        condition,
        surfaces: selectedSurfaces.join(''),
        notes
      })
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-xl border border-outline-variant overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant/60 bg-surface-container-low flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl font-mono flex items-center justify-center font-bold text-base shadow-xs ${
                isPedia
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                  : 'bg-secondary-fixed text-on-secondary-fixed'
              }`}
            >
              {toothNumber}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-on-surface">
                  Détails Cliniques — Dent {toothNumber}
                </h2>
                {isPedia ? (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-500/30">
                    Dent de Lait / Temporaire
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-secondary/10 text-secondary text-[10px] font-bold border border-secondary/20">
                    Dent Permanente
                  </span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                {getToothFdiName(toothNumber)}
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

        {/* Clinical Alerts Warning Bar (Prevention of medical errors) */}
        {clinicalAlerts.length > 0 && (
          <div className="px-6 py-2 bg-rose-500/10 border-b border-rose-500/30 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">warning</span>
              <span>Alerte Médicale Patient :</span>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Condition Selector */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-2">
              État & Diagnostic de la dent
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CONDITIONS.map((c) => {
                const isSelected = condition === c.value
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCondition(c.value)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                      isSelected
                        ? 'border-secondary ring-2 ring-secondary/30 bg-secondary-fixed/30 text-on-surface'
                        : 'border-outline-variant/50 hover:bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg shrink-0">{c.icon}</span>
                    <span className="truncate">{c.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Surfaces (only if not missing) */}
          {condition !== 'MISSING' && (
            <div>
              <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-2">
                Surfaces concernées
              </label>
              <div className="flex flex-wrap gap-2">
                {SURFACES.map((s) => {
                  const active = selectedSurfaces.includes(s.key)
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => toggleSurface(s.key)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        active
                          ? 'bg-secondary text-on-secondary border-secondary shadow-xs font-semibold'
                          : 'bg-surface border-outline-variant/60 text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Clinical observations */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1.5">
              Observations cliniques
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Douleur au test thermique, sonde accroche en distal, perte de substance..."
              className="w-full px-3 py-2 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-xs text-on-surface resize-none transition-colors"
            />
          </div>

          {/* Action to create a billable Treatment */}
          <div className="pt-2 border-t border-outline-variant/40 flex items-center justify-between">
            <span className="text-xs text-on-surface-variant font-medium">
              Besoin de facturer un acte ?
            </span>
            <button
              type="button"
              onClick={() => {
                onClose()
                onAddTreatment(toothNumber)
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-secondary-fixed text-secondary font-semibold text-xs transition-colors"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              <span>Ajouter un acte (DA)</span>
            </button>
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
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">save</span>
              <span>{isSaving ? 'Enregistrement...' : 'Enregistrer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
