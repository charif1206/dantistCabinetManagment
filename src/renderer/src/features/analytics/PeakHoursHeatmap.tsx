import React, { useState } from 'react'
import { PeakHourCell } from '@shared/types'
import { Clock, Info, Flame, AlertCircle } from 'lucide-react'

interface PeakHoursHeatmapProps {
  cells: PeakHourCell[]
  isLoading?: boolean
}

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
// Algerian week: Samedi to Jeudi
const DAYS = [
  { index: 6, label: 'Samedi' },
  { index: 0, label: 'Dimanche' },
  { index: 1, label: 'Lundi' },
  { index: 2, label: 'Mardi' },
  { index: 3, label: 'Mercredi' },
  { index: 4, label: 'Jeudi' }
]

export const PeakHoursHeatmap: React.FC<PeakHoursHeatmapProps> = ({ cells, isLoading }) => {
  const [hoveredCell, setHoveredCell] = useState<PeakHourCell | null>(null)

  // Map key: `${dayIndex}-${hour}`
  const cellMap = new Map<string, PeakHourCell>()
  cells.forEach((c) => cellMap.set(`${c.dayIndex}-${c.hour}`, c))

  // Find overall max count to determine relative load
  const maxCount = Math.max(...cells.map((c) => c.count), 1)

  const getCellColor = (count: number, intensity: number) => {
    if (count === 0) {
      return 'bg-slate-100/70 dark:bg-slate-800/40 text-slate-400 dark:text-slate-600 border-slate-200/50 dark:border-slate-800'
    }
    if (intensity < 0.25) {
      return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-medium'
    }
    if (intensity < 0.55) {
      return 'bg-teal-200 dark:bg-teal-900/70 text-teal-900 dark:text-teal-200 border-teal-400 dark:border-teal-700 font-semibold'
    }
    if (intensity < 0.8) {
      return 'bg-amber-300 dark:bg-amber-800/80 text-amber-950 dark:text-amber-100 border-amber-500 dark:border-amber-600 font-bold ring-1 ring-amber-400'
    }
    return 'bg-rose-500 text-white border-rose-600 font-extrabold shadow-sm ring-2 ring-rose-300 dark:ring-rose-800 animate-pulse'
  }

  const getStatusText = (count: number) => {
    if (count === 0) return 'Créneau libre / Fluide'
    if (count <= 2) return 'Charge modérée'
    if (count <= 4) return 'Charge soutenue'
    return 'Pic de pointe (Risque d’engorgement)'
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Flame className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Cartographie des Heures de Pointe (Heatmap)
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Analyse de la densité des rendez-vous par jour ouvrable et tranche horaire (Semaine algérienne du Samedi au Jeudi).
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"></span>
            <span>Libre (0)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-emerald-200 dark:bg-emerald-900 border border-emerald-400"></span>
            <span>Fluide</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-teal-300 dark:bg-teal-800 border border-teal-500"></span>
            <span>Modéré</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-amber-300 dark:bg-amber-700 border border-amber-500"></span>
            <span>Dense</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-rose-500 border border-rose-600 text-white font-bold"></span>
            <span>Pic maximal</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="ml-3 text-sm">Calcul de la matrice horaire...</span>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[720px]">
            {/* Heatmap Grid */}
            <div className="grid grid-cols-[100px_repeat(12,1fr)] gap-1.5">
              {/* Top Hours Header */}
              <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center justify-center">
                Jour / Heure
              </div>
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="text-center text-xs font-bold text-slate-600 dark:text-slate-400 py-1 rounded bg-slate-50 dark:bg-slate-800/40"
                >
                  {h}h
                </div>
              ))}

              {/* Rows per Day */}
              {DAYS.map((day) => (
                <React.Fragment key={day.index}>
                  <div className="flex items-center px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                    {day.label}
                  </div>
                  {HOURS.map((hour) => {
                    const cell = cellMap.get(`${day.index}-${hour}`) || {
                      dayIndex: day.index,
                      dayName: day.label,
                      hour,
                      count: 0,
                      intensity: 0
                    }
                    const isHovered =
                      hoveredCell?.dayIndex === day.index && hoveredCell?.hour === hour

                    return (
                      <div
                        key={hour}
                        onMouseEnter={() => setHoveredCell(cell)}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={`h-11 rounded-lg border flex flex-col items-center justify-center transition-all cursor-pointer select-none text-xs relative ${getCellColor(
                          cell.count,
                          cell.intensity
                        )} ${isHovered ? 'scale-110 z-10 shadow-lg' : ''}`}
                      >
                        <span className="text-[11px]">{cell.count > 0 ? cell.count : '—'}</span>
                      </div>
                    )
                  })}
                </React.Fragment>
              ))}
            </div>

            {/* Hover Tooltip / Detail Panel */}
            <div className="mt-4 min-h-[46px] p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs">
              {hoveredCell ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-white">
                    <Clock className="w-4 h-4 text-primary-500" />
                    <span>
                      {hoveredCell.dayName} à {hoveredCell.hour}h00
                    </span>
                  </div>
                  <span className="text-slate-400">•</span>
                  <div className="font-semibold text-slate-700 dark:text-slate-200">
                    {hoveredCell.count} rendez-vous programmés
                  </div>
                  <span className="text-slate-400">•</span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-medium ${
                      hoveredCell.count === 0
                        ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        : hoveredCell.intensity > 0.7
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200'
                        : hoveredCell.intensity > 0.4
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                    }`}
                  >
                    {getStatusText(hoveredCell.count)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 italic">
                  <Info className="w-4 h-4" />
                  <span>Survolez une case horaire pour afficher les conseils de planification et l'affluence précise.</span>
                </div>
              )}

              <div className="text-slate-500 dark:text-slate-400 text-[11px] hidden sm:block">
                Max affluence observée: <strong className="text-slate-800 dark:text-slate-200">{maxCount} RDV / créneau</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
