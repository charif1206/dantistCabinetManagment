import React, { useState, useEffect } from 'react'
import { ToothRecord, Treatment } from '@shared/types'
import { clinicalService } from '../../services/clinicalService'
import ToothDetailModal from './ToothDetailModal'
import AddTreatmentModal from './AddTreatmentModal'

interface DentalChartProps {
  patientId: string
  onTreatmentAdded?: () => void
}

const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11]
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28]
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41]
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38]

export default function DentalChart({ patientId, onTreatmentAdded }: DentalChartProps): JSX.Element {
  const [toothRecords, setToothRecords] = useState<Record<number, ToothRecord>>({})
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isAddTreatmentModalOpen, setIsAddTreatmentModalOpen] = useState(false)
  const [treatmentTooth, setTreatmentTooth] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadChartData = async (): Promise<void> => {
    try {
      const [records, trts] = await Promise.all([
        clinicalService.getToothRecords(patientId),
        clinicalService.getTreatments(patientId)
      ])
      const map: Record<number, ToothRecord> = {}
      records.forEach((r) => {
        map[r.toothNumber] = r
      })
      setToothRecords(map)
      setTreatments(trts)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadChartData()
  }, [patientId])

  const handleToothClick = (num: number): void => {
    setSelectedTooth(num)
    setIsDetailModalOpen(true)
  }

  const handleSaveToothRecord = async (
    record: Omit<ToothRecord, 'id' | 'updatedAt'>
  ): Promise<void> => {
    const saved = await clinicalService.saveToothRecord(record)
    setToothRecords((prev) => ({ ...prev, [saved.toothNumber]: saved }))
  }

  const handleOpenAddTreatment = (toothNum?: number): void => {
    setTreatmentTooth(toothNum || null)
    setIsAddTreatmentModalOpen(true)
  }

  const handleTreatmentSuccess = (): void => {
    loadChartData()
    if (onTreatmentAdded) onTreatmentAdded()
  }

  // Visual appearance helper based on FDI condition
  const getToothStyles = (num: number): {
    containerClass: string
    badgeText?: string
    badgeColor?: string
    icon?: string
  } => {
    const rec = toothRecords[num]
    if (!rec || rec.condition === 'HEALTHY') {
      return {
        containerClass: 'bg-surface border-outline-variant/60 hover:border-secondary hover:shadow-md'
      }
    }

    switch (rec.condition) {
      case 'CARIES':
        return {
          containerClass: 'bg-error-container/40 border-error hover:border-error shadow-xs',
          badgeText: 'Carie',
          badgeColor: 'bg-error text-on-error',
          icon: 'report'
        }
      case 'FILLED_COMPOSITE':
        return {
          containerClass: 'bg-secondary-fixed/50 border-secondary hover:border-secondary shadow-xs',
          badgeText: rec.surfaces || 'Comp.',
          badgeColor: 'bg-secondary text-on-secondary',
          icon: 'dentistry'
        }
      case 'FILLED_AMALGAM':
        return {
          containerClass: 'bg-slate-200 border-slate-500 hover:border-slate-600 shadow-xs',
          badgeText: rec.surfaces || 'Amalg.',
          badgeColor: 'bg-slate-600 text-white',
          icon: 'lens'
        }
      case 'CROWN':
        return {
          containerClass: 'bg-amber-100 border-amber-500 hover:border-amber-600 shadow-xs',
          badgeText: 'Couronne',
          badgeColor: 'bg-amber-500 text-white',
          icon: 'workspace_premium'
        }
      case 'ROOT_CANAL':
        return {
          containerClass: 'bg-emerald-50 border-emerald-500 hover:border-emerald-600 shadow-xs',
          badgeText: 'Endo',
          badgeColor: 'bg-emerald-600 text-white',
          icon: 'healing'
        }
      case 'MISSING':
        return {
          containerClass: 'bg-surface-container-high border-dashed border-outline-variant opacity-40',
          badgeText: 'Absente',
          badgeColor: 'bg-outline text-surface',
          icon: 'close'
        }
      case 'IMPLANT':
        return {
          containerClass: 'bg-purple-100 border-purple-500 hover:border-purple-600 shadow-xs',
          badgeText: 'Implant',
          badgeColor: 'bg-purple-600 text-white',
          icon: 'hardware'
        }
      case 'EXTRACTION_PLANNED':
        return {
          containerClass: 'bg-orange-100 border-orange-500 hover:border-orange-600 shadow-xs',
          badgeText: 'Extr. Prév.',
          badgeColor: 'bg-orange-500 text-white',
          icon: 'delete_forever'
        }
      default:
        return { containerClass: 'bg-surface border-outline-variant/60 hover:border-secondary' }
    }
  }

  const renderTooth = (num: number, isUpper: boolean): JSX.Element => {
    const { containerClass, badgeText, badgeColor, icon } = getToothStyles(num)
    const rec = toothRecords[num]

    return (
      <button
        key={num}
        type="button"
        onClick={() => handleToothClick(num)}
        title={`Dent ${num}${rec?.notes ? ` - ${rec.notes}` : ''}`}
        className="flex flex-col items-center gap-1 group relative transition-transform active:scale-95 cursor-pointer"
      >
        {isUpper && (
          <span className="font-mono text-[11px] font-bold text-on-surface-variant group-hover:text-secondary transition-colors">
            {num}
          </span>
        )}

        <div
          className={`w-9 sm:w-10 h-14 rounded-xl border flex flex-col items-center justify-between p-1 transition-all ${containerClass}`}
        >
          {icon ? (
            <span className="material-symbols-outlined text-sm">{icon}</span>
          ) : (
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isUpper ? 'bg-secondary/20' : 'bg-outline-variant/40'
              }`}
            />
          )}

          {badgeText && (
            <span
              className={`text-[8px] font-bold px-1 py-0.2 rounded-full uppercase truncate max-w-[34px] ${
                badgeColor || 'bg-outline'
              }`}
            >
              {badgeText}
            </span>
          )}
        </div>

        {!isUpper && (
          <span className="font-mono text-[11px] font-bold text-on-surface-variant group-hover:text-secondary transition-colors">
            {num}
          </span>
        )}
      </button>
    )
  }

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center gap-3 text-secondary">
        <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
        <span className="text-sm font-medium">Chargement du schéma dentaire...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Chart Canvas Card */}
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 shadow-xs">
        {/* Controls Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-5 border-b border-outline-variant/40">
          <div>
            <h3 className="font-bold text-base text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">dentistry</span>
              <span>Odontogramme FDI (32 Dents)</span>
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Cliquez sur une dent pour modifier son statut ou lui associer un soin clinique.
            </p>
          </div>

          <button
            onClick={() => handleOpenAddTreatment()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary-container hover:bg-on-secondary-fixed-variant text-on-primary text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>+ Ajouter un Acte / Soin (DA)</span>
          </button>
        </div>

        {/* Teeth Arches Diagram */}
        <div className="py-6 flex flex-col items-center gap-8 overflow-x-auto">
          {/* Maxillary (Upper Arch) */}
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-bold text-outline uppercase tracking-wider mb-2">
              Arcade Maxillaire (Haut)
            </span>
            <div className="flex items-center gap-4 sm:gap-8 pb-4 border-b border-dashed border-outline-variant">
              {/* Quadrant 1 (Right) */}
              <div className="flex items-center gap-1.5 sm:gap-2 pr-3 sm:pr-4 border-r border-outline-variant">
                {UPPER_RIGHT.map((n) => renderTooth(n, true))}
              </div>
              {/* Quadrant 2 (Left) */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {UPPER_LEFT.map((n) => renderTooth(n, true))}
              </div>
            </div>
          </div>

          {/* Mandibular (Lower Arch) */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-4 sm:gap-8 pt-2">
              {/* Quadrant 4 (Right) */}
              <div className="flex items-center gap-1.5 sm:gap-2 pr-3 sm:pr-4 border-r border-outline-variant">
                {LOWER_RIGHT.map((n) => renderTooth(n, false))}
              </div>
              {/* Quadrant 3 (Left) */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {LOWER_LEFT.map((n) => renderTooth(n, false))}
              </div>
            </div>
            <span className="text-[11px] font-bold text-outline uppercase tracking-wider mt-3">
              Arcade Mandibulaire (Bas)
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="pt-4 border-t border-outline-variant/40 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-on-surface-variant">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded border border-outline-variant bg-surface" />
            <span>Saine</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded border border-error bg-error-container" />
            <span>Carie</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded border border-secondary bg-secondary-fixed" />
            <span>Obturation</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded border border-amber-500 bg-amber-100" />
            <span>Couronne</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded border border-emerald-500 bg-emerald-50" />
            <span>Endo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded border border-purple-500 bg-purple-100" />
            <span>Implant</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded border border-dashed border-outline-variant bg-surface-container-high opacity-50" />
            <span>Absente</span>
          </div>
        </div>
      </div>

      {/* Treatments List (Actes Réalisés pour ce patient) */}
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 shadow-xs">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-base text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">receipt_long</span>
            <span>Historique des Actes & Soins</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface font-semibold">
              {treatments.length}
            </span>
          </h3>
          <span className="text-xs font-bold text-secondary">
            Total Actes : {treatments.reduce((sum, t) => sum + (t.price || 0), 0).toLocaleString()} DA
          </span>
        </div>

        {treatments.length === 0 ? (
          <div className="py-8 text-center text-on-surface-variant text-xs">
            Aucun traitement enregistré pour ce patient. Cliquez sur une dent ou sur « + Ajouter un Acte » pour commencer.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-outline-variant/40 text-on-surface-variant font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Dent</th>
                  <th className="py-2.5 px-3">Acte Médical</th>
                  <th className="py-2.5 px-3">Praticien</th>
                  <th className="py-2.5 px-3">Statut</th>
                  <th className="py-2.5 px-3 text-right">Montant (DA)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {treatments.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-container/50 transition-colors">
                    <td className="py-2.5 px-3 text-on-surface-variant">{t.date}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-secondary">
                      {t.toothNumber ? `#${t.toothNumber}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-on-surface">{t.actName}</td>
                    <td className="py-2.5 px-3 text-on-surface-variant">{t.dentistName || 'Dr. Amrani'}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                          t.status === 'COMPLETED'
                            ? 'bg-tertiary-fixed text-on-tertiary-container'
                            : t.status === 'IN_PROGRESS'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-secondary-fixed text-on-secondary-fixed'
                        }`}
                      >
                        {t.status === 'COMPLETED' ? 'Terminé' : t.status === 'IN_PROGRESS' ? 'En cours' : 'Planifié'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-on-surface font-mono">
                      {t.price.toLocaleString()} DA
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {isDetailModalOpen && selectedTooth && (
        <ToothDetailModal
          toothNumber={selectedTooth}
          patientId={patientId}
          initialRecord={toothRecords[selectedTooth]}
          onClose={() => setIsDetailModalOpen(false)}
          onSave={handleSaveToothRecord}
          onAddTreatment={handleOpenAddTreatment}
        />
      )}

      {isAddTreatmentModalOpen && (
        <AddTreatmentModal
          patientId={patientId}
          preselectedTooth={treatmentTooth}
          onClose={() => setIsAddTreatmentModalOpen(false)}
          onSuccess={handleTreatmentSuccess}
        />
      )}
    </div>
  )
}
