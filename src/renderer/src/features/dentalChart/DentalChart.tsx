import React, { useState, useEffect, useMemo } from 'react'
import { ToothRecord, Treatment } from '@shared/types'
import { clinicalService } from '../../services/clinicalService'
import { patientService } from '../../services/patientService'
import ToothDetailModal from './ToothDetailModal'
import AddTreatmentModal from './AddTreatmentModal'
import BulkTreatmentModal from './BulkTreatmentModal'
import {
  DentitionMode,
  UPPER_RIGHT_ADULT,
  UPPER_LEFT_ADULT,
  LOWER_RIGHT_ADULT,
  LOWER_LEFT_ADULT,
  UPPER_RIGHT_PEDIATRIC,
  UPPER_LEFT_PEDIATRIC,
  LOWER_RIGHT_PEDIATRIC,
  LOWER_LEFT_PEDIATRIC,
  MAXILLARY_ADULT,
  MANDIBULAR_ADULT,
  MAXILLARY_PEDIATRIC,
  MANDIBULAR_PEDIATRIC,
  ALL_ADULT_TEETH,
  ALL_PEDIATRIC_TEETH,
  isPediatricTooth,
  calculateDentitionMode
} from './dentalConstants'

interface DentalChartProps {
  patientId: string
  patientBirthDate?: string | null
  onTreatmentAdded?: () => void
}

export default function DentalChart({
  patientId,
  patientBirthDate,
  onTreatmentAdded
}: DentalChartProps): JSX.Element {
  const [toothRecords, setToothRecords] = useState<Record<number, ToothRecord>>({})
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isAddTreatmentModalOpen, setIsAddTreatmentModalOpen] = useState(false)
  const [isBulkTreatmentModalOpen, setIsBulkTreatmentModalOpen] = useState(false)
  const [treatmentTooth, setTreatmentTooth] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Dentition mode & auto-detection
  const [dentitionMode, setDentitionMode] = useState<DentitionMode>('ADULT')
  const [patientAge, setPatientAge] = useState<number | null>(null)
  const [isManualOverride, setIsManualOverride] = useState(false)

  // Bulk Selection state
  const [selectedTeeth, setSelectedTeeth] = useState<Set<number>>(new Set())

  // Load chart data
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

  // Detect age and initialize mode
  useEffect(() => {
    loadChartData()

    const detectAgeAndMode = async (): Promise<void> => {
      let bDate = patientBirthDate
      if (!bDate) {
        try {
          const pat = await patientService.getPatientById(patientId)
          bDate = pat?.dateOfBirth || null
        } catch (e) {
          console.warn('Could not fetch patient birth date for dental chart', e)
        }
      }

      if (bDate) {
        const { mode, age } = calculateDentitionMode(bDate)
        setPatientAge(age)
        if (!isManualOverride) {
          setDentitionMode(mode)
        }
      }
    }

    detectAgeAndMode()
  }, [patientId, patientBirthDate])

  const handleModeChange = (newMode: DentitionMode): void => {
    setDentitionMode(newMode)
    setIsManualOverride(true)
    setSelectedTeeth(new Set())
  }

  // Tooth selection logic
  const toggleToothSelection = (num: number): void => {
    setSelectedTeeth((prev) => {
      const next = new Set(prev)
      if (next.has(num)) {
        next.delete(num)
      } else {
        next.add(num)
      }
      return next
    })
  }

  const handleToothClick = (num: number, e: React.MouseEvent): void => {
    // If user clicked or multi-select is active or Shift was pressed: toggle selection
    if (selectedTeeth.size > 0 || e.shiftKey || e.ctrlKey || e.metaKey) {
      toggleToothSelection(num)
    } else {
      setSelectedTooth(num)
      setIsDetailModalOpen(true)
    }
  }

  const handleToothContextMenu = (num: number, e: React.MouseEvent): void => {
    e.preventDefault()
    setSelectedTooth(num)
    setIsDetailModalOpen(true)
  }

  // Bulk Selection Helpers
  const selectAllTeeth = (): void => {
    if (dentitionMode === 'ADULT') {
      setSelectedTeeth(new Set(ALL_ADULT_TEETH))
    } else if (dentitionMode === 'PEDIATRIC') {
      setSelectedTeeth(new Set(ALL_PEDIATRIC_TEETH))
    } else {
      setSelectedTeeth(new Set([...ALL_ADULT_TEETH, ...ALL_PEDIATRIC_TEETH]))
    }
  }

  const selectMaxillary = (): void => {
    if (dentitionMode === 'ADULT') {
      setSelectedTeeth(new Set(MAXILLARY_ADULT))
    } else if (dentitionMode === 'PEDIATRIC') {
      setSelectedTeeth(new Set(MAXILLARY_PEDIATRIC))
    } else {
      setSelectedTeeth(new Set([...MAXILLARY_ADULT, ...MAXILLARY_PEDIATRIC]))
    }
  }

  const selectMandibular = (): void => {
    if (dentitionMode === 'ADULT') {
      setSelectedTeeth(new Set(MANDIBULAR_ADULT))
    } else if (dentitionMode === 'PEDIATRIC') {
      setSelectedTeeth(new Set(MANDIBULAR_PEDIATRIC))
    } else {
      setSelectedTeeth(new Set([...MANDIBULAR_ADULT, ...MANDIBULAR_PEDIATRIC]))
    }
  }

  const selectQuadrant = (quadrantNumber: number): void => {
    let list: number[] = []
    switch (quadrantNumber) {
      case 1:
        list = dentitionMode === 'MIXED' ? [...UPPER_RIGHT_ADULT, ...UPPER_RIGHT_PEDIATRIC] : UPPER_RIGHT_ADULT
        break
      case 2:
        list = dentitionMode === 'MIXED' ? [...UPPER_LEFT_ADULT, ...UPPER_LEFT_PEDIATRIC] : UPPER_LEFT_ADULT
        break
      case 3:
        list = dentitionMode === 'MIXED' ? [...LOWER_LEFT_ADULT, ...LOWER_LEFT_PEDIATRIC] : LOWER_LEFT_ADULT
        break
      case 4:
        list = dentitionMode === 'MIXED' ? [...LOWER_RIGHT_ADULT, ...LOWER_RIGHT_PEDIATRIC] : LOWER_RIGHT_ADULT
        break
      case 5:
        list = UPPER_RIGHT_PEDIATRIC
        break
      case 6:
        list = UPPER_LEFT_PEDIATRIC
        break
      case 7:
        list = LOWER_LEFT_PEDIATRIC
        break
      case 8:
        list = LOWER_RIGHT_PEDIATRIC
        break
    }
    setSelectedTeeth(new Set(list))
  }

  const clearSelection = (): void => {
    setSelectedTeeth(new Set())
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
    setSelectedTeeth(new Set())
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
    const isPedia = isPediatricTooth(num)

    if (!rec || rec.condition === 'HEALTHY') {
      return {
        containerClass: isPedia
          ? 'bg-amber-500/5 border-amber-500/40 hover:border-amber-500 hover:shadow-xs'
          : 'bg-surface border-outline-variant/60 hover:border-secondary hover:shadow-xs'
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

  // Render an individual tooth button
  const renderTooth = (num: number, isUpper: boolean, isDeciduous: boolean = false): JSX.Element => {
    const { containerClass, badgeText, badgeColor, icon } = getToothStyles(num)
    const rec = toothRecords[num]
    const isSelected = selectedTeeth.has(num)

    // Deciduous teeth are rendered slightly smaller and with subtle distinction
    const dimensions = isDeciduous
      ? 'w-7 sm:w-8 h-12 rounded-lg'
      : 'w-9 sm:w-10 h-14 rounded-xl'

    return (
      <div key={num} className="relative group">
        <button
          type="button"
          onClick={(e) => handleToothClick(num, e)}
          onContextMenu={(e) => handleToothContextMenu(num, e)}
          title={`Dent FDI ${num} ${isDeciduous ? '(Lait)' : ''}${rec?.notes ? ` - ${rec.notes}` : ''}`}
          className={`flex flex-col items-center gap-0.5 relative transition-all active:scale-95 cursor-pointer ${
            isSelected ? 'scale-[1.06] z-10' : ''
          }`}
        >
          {/* Top Label */}
          {isUpper && (
            <span
              className={`font-mono text-[11px] font-bold transition-colors ${
                isSelected
                  ? 'text-secondary font-black'
                  : isDeciduous
                  ? 'text-amber-700 dark:text-amber-400 group-hover:text-amber-600'
                  : 'text-on-surface-variant group-hover:text-secondary'
              }`}
            >
              {num}
            </span>
          )}

          {/* Tooth Container */}
          <div
            className={`${dimensions} border flex flex-col items-center justify-between p-1 transition-all ${containerClass} ${
              isSelected
                ? 'ring-2 ring-secondary ring-offset-1 bg-secondary-fixed/40 border-secondary shadow-md'
                : ''
            }`}
          >
            {/* Upper Indicator or Selection Checkmark */}
            <div className="w-full flex items-center justify-between px-0.5">
              {isSelected ? (
                <span className="material-symbols-outlined text-xs text-secondary font-bold">
                  check_circle
                </span>
              ) : (
                <div
                  className={`w-2 h-2 rounded-full ${
                    isDeciduous
                      ? 'bg-amber-500/30'
                      : isUpper
                      ? 'bg-secondary/20'
                      : 'bg-outline-variant/40'
                  }`}
                />
              )}

              {isDeciduous && (
                <span className="text-[7px] font-black uppercase text-amber-600 dark:text-amber-400 leading-none">
                  Lait
                </span>
              )}
            </div>

            {/* Tooth Center Icon */}
            {icon ? (
              <span className="material-symbols-outlined text-xs sm:text-sm">{icon}</span>
            ) : null}

            {/* Condition Badge */}
            {badgeText && (
              <span
                className={`text-[7px] sm:text-[8px] font-bold px-1 py-0.2 rounded-full uppercase truncate max-w-[32px] ${
                  badgeColor || 'bg-outline'
                }`}
              >
                {badgeText}
              </span>
            )}
          </div>

          {/* Bottom Label */}
          {!isUpper && (
            <span
              className={`font-mono text-[11px] font-bold transition-colors ${
                isSelected
                  ? 'text-secondary font-black'
                  : isDeciduous
                  ? 'text-amber-700 dark:text-amber-400 group-hover:text-amber-600'
                  : 'text-on-surface-variant group-hover:text-secondary'
              }`}
            >
              {num}
            </span>
          )}
        </button>

        {/* Hover Quick Action to Open Single Detail */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setSelectedTooth(num)
            setIsDetailModalOpen(true)
          }}
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-surface-container-highest border border-outline-variant text-outline hover:text-secondary hover:border-secondary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xs text-[10px]"
          title="Modifier l'état de cette dent"
        >
          <span className="material-symbols-outlined text-[11px]">edit</span>
        </button>
      </div>
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
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 sm:p-6 shadow-xs">
        {/* 1. Header with Mode Switcher & Stats */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-5 border-b border-outline-variant/40">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="font-bold text-base text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">dentistry</span>
                <span>Odontogramme FDI Interactif</span>
              </h3>

              {/* Patient Age badge if available */}
              {patientAge !== null && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary-fixed/50 text-secondary font-bold border border-secondary/20 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">cake</span>
                  <span>{patientAge} ans</span>
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant mt-1">
              Schéma interactif avec support adulte, pédiatrique et mixte. Cliquez sur une dent ou utilisez le sélecteur groupé.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto justify-between lg:justify-end">
            {/* Dentition Mode Switcher */}
            <div className="flex items-center p-1 rounded-xl bg-surface-container border border-outline-variant/60">
              <button
                type="button"
                onClick={() => handleModeChange('ADULT')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  dentitionMode === 'ADULT'
                    ? 'bg-surface-container-lowest text-secondary shadow-xs scale-[1.02]'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-sm">person</span>
                <span>Adulte (11-48)</span>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange('MIXED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  dentitionMode === 'MIXED'
                    ? 'bg-surface-container-lowest text-secondary shadow-xs scale-[1.02]'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-sm">layers</span>
                <span>Mixte (6-12 ans)</span>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange('PEDIATRIC')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  dentitionMode === 'PEDIATRIC'
                    ? 'bg-surface-container-lowest text-secondary shadow-xs scale-[1.02]'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-sm">child_care</span>
                <span>Pédiatrique (51-85)</span>
              </button>
            </div>

            {/* Individual Add Act button */}
            <button
              onClick={() => handleOpenAddTreatment()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-container hover:bg-on-secondary-fixed-variant text-on-primary text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span>+ Acte Clinique</span>
            </button>
          </div>
        </div>

        {/* 2. Bulk Selection Toolbar (شريط التحديد الجماعي السريع) */}
        <div className="py-3 px-3.5 mt-3 mb-4 rounded-xl bg-surface-container-low/60 border border-outline-variant/40 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-outline uppercase tracking-wider flex items-center gap-1 mr-1">
              <span className="material-symbols-outlined text-sm">select_all</span>
              <span>Sélection Rapide :</span>
            </span>

            {/* Toute la bouche */}
            <button
              type="button"
              onClick={selectAllTeeth}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-surface border border-outline-variant/60 hover:border-secondary hover:bg-secondary-fixed/20 text-on-surface transition-all cursor-pointer"
            >
              Toute la Bouche
            </button>

            {/* Maxillaire Supérieur */}
            <button
              type="button"
              onClick={selectMaxillary}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-surface border border-outline-variant/60 hover:border-secondary hover:bg-secondary-fixed/20 text-on-surface transition-all cursor-pointer"
            >
              Maxillaire Supérieur
            </button>

            {/* Mandibule Inférieure */}
            <button
              type="button"
              onClick={selectMandibular}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-surface border border-outline-variant/60 hover:border-secondary hover:bg-secondary-fixed/20 text-on-surface transition-all cursor-pointer"
            >
              Mandibule Inférieure
            </button>

            {/* Quadrants */}
            <div className="inline-flex items-center gap-1 pl-2 border-l border-outline-variant/40">
              <span className="text-[10px] font-bold text-outline uppercase">Quadrants:</span>
              {[
                { id: 1, label: 'Q1' },
                { id: 2, label: 'Q2' },
                { id: 3, label: 'Q3' },
                { id: 4, label: 'Q4' }
              ].map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => selectQuadrant(q.id)}
                  className="px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-surface border border-outline-variant/60 hover:border-secondary hover:bg-secondary-fixed/30 text-on-surface transition-all"
                  title={`Quadrant ${q.id}`}
                >
                  {q.label}
                </button>
              ))}

              {dentitionMode === 'PEDIATRIC' &&
                [
                  { id: 5, label: 'Q5' },
                  { id: 6, label: 'Q6' },
                  { id: 7, label: 'Q7' },
                  { id: 8, label: 'Q8' }
                ].map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => selectQuadrant(q.id)}
                    className="px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-all"
                    title={`Quadrant Pédiatrique ${q.id}`}
                  >
                    {q.label}
                  </button>
                ))}
            </div>
          </div>

          {/* Selection counter & Clear button */}
          {selectedTeeth.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-secondary bg-secondary-fixed/60 px-2 py-0.5 rounded-md border border-secondary/30">
                {selectedTeeth.size} dent(s) sélectionnée(s)
              </span>
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs font-semibold text-outline hover:text-error transition-colors flex items-center gap-0.5"
              >
                <span className="material-symbols-outlined text-sm">close</span>
                <span>Effacer</span>
              </button>
            </div>
          )}
        </div>

        {/* 3. Floating/Sticky Bulk Actions Banner if teeth are selected */}
        {selectedTeeth.size > 0 && (
          <div className="p-3 mb-4 rounded-xl bg-secondary-fixed/40 border-2 border-secondary/40 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-8 h-8 rounded-lg bg-secondary text-on-secondary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-lg">bolt</span>
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-on-surface">
                  Action groupée prête sur {selectedTeeth.size} dents
                </p>
                <p className="text-[11px] text-on-surface-variant truncate font-mono">
                  Dents : {[...selectedTeeth].sort((a, b) => a - b).join(', ')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsBulkTreatmentModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">medical_services</span>
                <span>Appliquer un Traitement Groupé (DA)</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. Teeth Arches Diagram */}
        <div className="py-4 flex flex-col items-center gap-6 overflow-x-auto">
          {/* ===================== MAXILLAIRE (UPPER ARCH) ===================== */}
          <div className="flex flex-col items-center w-full">
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="text-[11px] font-bold text-outline uppercase tracking-wider">
                Arcade Maxillaire (Supérieure)
              </span>
              <span className="text-[10px] text-outline-variant font-mono">
                {dentitionMode === 'PEDIATRIC'
                  ? 'Q5 · Q6'
                  : dentitionMode === 'MIXED'
                  ? 'Q1/Q5 · Q2/Q6'
                  : 'Q1 · Q2'}
              </span>
            </div>

            {/* Permanent Adult Upper Arch (shown in ADULT and MIXED) */}
            {dentitionMode !== 'PEDIATRIC' && (
              <div className="flex items-center gap-4 sm:gap-8 pb-3 border-b border-dashed border-outline-variant/60">
                {/* Quadrant 1 (Right) */}
                <div className="flex items-center gap-1 sm:gap-1.5 pr-2 sm:pr-4 border-r border-outline-variant/80">
                  {UPPER_RIGHT_ADULT.map((n) => renderTooth(n, true, false))}
                </div>
                {/* Quadrant 2 (Left) */}
                <div className="flex items-center gap-1 sm:gap-1.5">
                  {UPPER_LEFT_ADULT.map((n) => renderTooth(n, true, false))}
                </div>
              </div>
            )}

            {/* Deciduous Pediatric Upper Arch (shown in PEDIATRIC and stacked in MIXED) */}
            {(dentitionMode === 'PEDIATRIC' || dentitionMode === 'MIXED') && (
              <div
                className={`flex flex-col items-center ${
                  dentitionMode === 'MIXED' ? 'pt-2' : 'pb-2 border-b border-dashed border-outline-variant/60'
                }`}
              >
                {dentitionMode === 'MIXED' && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
                    Dents de Lait Temporaires (Q5 · Q6)
                  </span>
                )}
                <div className="flex items-center gap-4 sm:gap-8">
                  {/* Quadrant 5 (Right Deciduous) */}
                  <div className="flex items-center gap-1 sm:gap-1.5 pr-2 sm:pr-4 border-r border-amber-500/40">
                    {UPPER_RIGHT_PEDIATRIC.map((n) => renderTooth(n, true, true))}
                  </div>
                  {/* Quadrant 6 (Left Deciduous) */}
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    {UPPER_LEFT_PEDIATRIC.map((n) => renderTooth(n, true, true))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ===================== MANDIBULAIRE (LOWER ARCH) ===================== */}
          <div className="flex flex-col items-center w-full">
            {/* Deciduous Pediatric Lower Arch (shown in PEDIATRIC and stacked in MIXED) */}
            {(dentitionMode === 'PEDIATRIC' || dentitionMode === 'MIXED') && (
              <div
                className={`flex flex-col items-center ${
                  dentitionMode === 'MIXED' ? 'pb-2' : 'pt-2'
                }`}
              >
                {dentitionMode === 'MIXED' && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
                    Dents de Lait Temporaires (Q8 · Q7)
                  </span>
                )}
                <div className="flex items-center gap-4 sm:gap-8">
                  {/* Quadrant 8 (Right Deciduous) */}
                  <div className="flex items-center gap-1 sm:gap-1.5 pr-2 sm:pr-4 border-r border-amber-500/40">
                    {LOWER_RIGHT_PEDIATRIC.map((n) => renderTooth(n, false, true))}
                  </div>
                  {/* Quadrant 7 (Left Deciduous) */}
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    {LOWER_LEFT_PEDIATRIC.map((n) => renderTooth(n, false, true))}
                  </div>
                </div>
              </div>
            )}

            {/* Permanent Adult Lower Arch (shown in ADULT and MIXED) */}
            {dentitionMode !== 'PEDIATRIC' && (
              <div
                className={`flex items-center gap-4 sm:gap-8 ${
                  dentitionMode === 'MIXED' ? 'pt-2 border-t border-dashed border-outline-variant/60' : 'pt-2'
                }`}
              >
                {/* Quadrant 4 (Right) */}
                <div className="flex items-center gap-1 sm:gap-1.5 pr-2 sm:pr-4 border-r border-outline-variant/80">
                  {LOWER_RIGHT_ADULT.map((n) => renderTooth(n, false, false))}
                </div>
                {/* Quadrant 3 (Left) */}
                <div className="flex items-center gap-1 sm:gap-1.5">
                  {LOWER_LEFT_ADULT.map((n) => renderTooth(n, false, false))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 mt-3">
              <span className="text-[11px] font-bold text-outline uppercase tracking-wider">
                Arcade Mandibulaire (Inférieure)
              </span>
              <span className="text-[10px] text-outline-variant font-mono">
                {dentitionMode === 'PEDIATRIC'
                  ? 'Q8 · Q7'
                  : dentitionMode === 'MIXED'
                  ? 'Q4/Q8 · Q3/Q7'
                  : 'Q4 · Q3'}
              </span>
            </div>
          </div>
        </div>

        {/* 5. Legend */}
        <div className="pt-4 border-t border-outline-variant/40 flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs font-medium text-on-surface-variant">
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
          <div className="flex items-center gap-1.5 pl-2 border-l border-outline-variant/40">
            <div className="w-3.5 h-3.5 rounded border border-amber-500/60 bg-amber-500/10" />
            <span className="font-semibold text-amber-700 dark:text-amber-400">Dent de Lait (51-85)</span>
          </div>
        </div>
      </div>

      {/* 6. Treatments History Table */}
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 shadow-xs">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-base text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">receipt_long</span>
            <span>Historique des Actes & Soins</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface font-semibold">
              {treatments.length}
            </span>
          </h3>
          <span className="text-xs font-bold text-secondary font-mono">
            Total Actes : {treatments.reduce((sum, t) => sum + (t.price || 0), 0).toLocaleString()} DA
          </span>
        </div>

        {treatments.length === 0 ? (
          <div className="py-8 text-center text-on-surface-variant text-xs">
            Aucun traitement enregistré pour ce patient. Cliquez sur une dent ou sur « + Acte Clinique » pour commencer.
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
                {treatments.map((t) => {
                  const isPedia = t.toothNumber ? isPediatricTooth(t.toothNumber) : false
                  return (
                    <tr key={t.id} className="hover:bg-surface-container/50 transition-colors">
                      <td className="py-2.5 px-3 text-on-surface-variant">{t.date}</td>
                      <td className="py-2.5 px-3 font-mono font-bold">
                        {t.toothNumber ? (
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${
                              isPedia
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                : 'text-secondary'
                            }`}
                          >
                            #{t.toothNumber}
                            {isPedia && <span className="text-[9px] font-sans font-normal">lait</span>}
                          </span>
                        ) : (
                          <span className="text-outline">Global</span>
                        )}
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
                  )
                })}
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

      {isBulkTreatmentModalOpen && selectedTeeth.size > 0 && (
        <BulkTreatmentModal
          patientId={patientId}
          selectedTeeth={[...selectedTeeth]}
          onClose={() => setIsBulkTreatmentModalOpen(false)}
          onSuccess={handleTreatmentSuccess}
        />
      )}
    </div>
  )
}
