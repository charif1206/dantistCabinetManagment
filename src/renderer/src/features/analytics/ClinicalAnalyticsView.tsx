import React, { useEffect, useState } from 'react'
import {
  ClinicalOverviewStats,
  PeakHourCell,
  ChronicLatePatient,
  SpecialtyDistribution
} from '@shared/types'
import { advancedStatsService } from '../../services/advancedStatsService'
import { PeakHoursHeatmap } from './PeakHoursHeatmap'
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  CalendarX,
  Phone,
  ShieldAlert,
  BarChart3,
  Calendar,
  DollarSign,
  Activity,
  CheckCircle2,
  RefreshCw,
  Sparkles
} from 'lucide-react'

type PeriodFilter = 'month' | 'quarter' | 'year' | 'all'

export const ClinicalAnalyticsView: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<PeriodFilter>('all')
  const [overview, setOverview] = useState<ClinicalOverviewStats | null>(null)
  const [peakHours, setPeakHours] = useState<PeakHourCell[]>([])
  const [chronicPatients, setChronicPatients] = useState<ChronicLatePatient[]>([])
  const [specialties, setSpecialties] = useState<SpecialtyDistribution[]>([])

  // Calculate start/end dates based on period
  const getDateRange = (filter: PeriodFilter) => {
    const now = new Date()
    let startDate: string | undefined
    const endDate = now.toISOString().slice(0, 10)

    if (filter === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      startDate = firstDay.toISOString().slice(0, 10)
    } else if (filter === 'quarter') {
      const threeMonthsAgo = new Date()
      threeMonthsAgo.setMonth(now.getMonth() - 3)
      startDate = threeMonthsAgo.toISOString().slice(0, 10)
    } else if (filter === 'year') {
      const firstJan = new Date(now.getFullYear(), 0, 1)
      startDate = firstJan.toISOString().slice(0, 10)
    } else {
      startDate = undefined
    }

    return { startDate, endDate }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const { startDate, endDate } = getDateRange(period)
      const [ov, peaks, chronics, specs] = await Promise.all([
        advancedStatsService.getOverview(startDate, endDate),
        advancedStatsService.getPeakHours(),
        advancedStatsService.getChronicLatePatients(),
        advancedStatsService.getSpecialtyDistribution()
      ])
      setOverview(ov)
      setPeakHours(peaks)
      setChronicPatients(chronics)
      setSpecialties(specs)
    } catch (err) {
      console.error('Failed to load clinical analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [period])

  // Specialty color map
  const getSpecialtyColor = (specialty: string) => {
    switch (specialty) {
      case 'ODF':
        return 'bg-purple-500'
      case 'IMPLANT':
        return 'bg-blue-600'
      case 'PROTHESE_FIXE':
        return 'bg-teal-500'
      case 'PROTHESE_AMOVIBLE':
        return 'bg-cyan-500'
      case 'CHIRURGIE':
        return 'bg-rose-500'
      case 'ENDODONTIE':
        return 'bg-amber-500'
      case 'PARODONTOLOGIE':
      case 'PARODONTIE':
        return 'bg-emerald-500'
      case 'CONSULTATION_IMAGERIE':
        return 'bg-indigo-500'
      case 'SOINS':
      case 'SOINS_CONSERVATEURS':
        return 'bg-sky-500'
      default:
        return 'bg-slate-500'
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* Top Banner / Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 rounded-xl">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Statistiques Cliniques & Performance
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Optimisation des flux patients, réduction des no-shows et analyse d'activité par spécialité.
              </p>
            </div>
          </div>
        </div>

        {/* Period Selector & Refresh */}
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                period === 'month'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Ce mois
            </button>
            <button
              onClick={() => setPeriod('quarter')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                period === 'quarter'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              3 Mois
            </button>
            <button
              onClick={() => setPeriod('year')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                period === 'year'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Année 2026
            </button>
            <button
              onClick={() => setPeriod('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                period === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Global
            </button>
          </div>

          <button
            onClick={loadData}
            title="Rafraîchir les métriques"
            className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4 Bento Style KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: No-Show Rate */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm relative overflow-hidden group hover:border-rose-400 dark:hover:border-rose-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Taux de No-Show
            </span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <CalendarX className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {overview?.noShowRate ?? 0}%
            </span>
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              {overview?.cancelledCount ?? 0} annulation(s)
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Sur un total de {overview?.totalAppointments ?? 0} rendez-vous programmés.
          </p>
          <div className="mt-3 w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full ${
                (overview?.noShowRate ?? 0) > 15 ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(overview?.noShowRate ?? 0, 100)}%` }}
            />
          </div>
        </div>

        {/* KPI 2: Average Lead Time */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm relative overflow-hidden group hover:border-blue-400 dark:hover:border-blue-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Délai Moyen de RDV
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {overview?.averageLeadTimeDays ?? 0}
            </span>
            <span className="text-sm font-semibold text-slate-500">jours</span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Temps moyen entre la prise de RDV et le passage au fauteuil.
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Disponibilité cabinet optimale</span>
          </div>
        </div>

        {/* KPI 3: Patients with recurrent absences */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm relative overflow-hidden group hover:border-amber-400 dark:hover:border-amber-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Profils à Confirmer
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {overview?.chronicLatePatientsCount ?? 0}
            </span>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              patients signalés
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            ≥ 2 absences ou retards injustifiés (vigilance secrétariat).
          </p>
          <div className="mt-3 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Confirmation obligatoire requise</span>
          </div>
        </div>

        {/* KPI 4: Total Revenue & Volume */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm relative overflow-hidden group hover:border-emerald-400 dark:hover:border-emerald-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Recettes Soins Réalisés
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {(overview?.totalRevenueDA ?? 0).toLocaleString()}
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">DA</span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Généré sur {overview?.completedCount ?? 0} rendez-vous honorés.
          </p>
          <div className="mt-3 flex items-center gap-1 text-xs text-slate-500 font-medium">
            <Activity className="w-3.5 h-3.5 text-primary-500" />
            <span>Base actes médicaux validés</span>
          </div>
        </div>
      </div>

      {/* Heatmap Section */}
      <PeakHoursHeatmap cells={peakHours} isLoading={loading} />

      {/* Bottom Grid: Chronic Absentee Patients & Specialty Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Chronic Late / No-Show Patients */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Patients à Risque d’Absence & Retard
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Patients ayant cumulé 2 absences ou plus pour confirmation préalable
                </p>
              </div>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
              {chronicPatients.length} patient(s)
            </span>
          </div>

          {chronicPatients.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2 opacity-80" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Aucun patient à récidive d'absence détecté !
              </p>
              <p className="text-xs text-slate-500 mt-1">
                La ponctualité et le respect des rendez-vous sont à un niveau optimal.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-3">Patient</th>
                    <th className="py-2.5 px-3">Téléphone</th>
                    <th className="py-2.5 px-3 text-center">Absences</th>
                    <th className="py-2.5 px-3">Statut & Consigne</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {chronicPatients.map((p) => (
                    <tr
                      key={p.patientId}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {p.patientName}
                        </div>
                        <div className="text-[11px] text-slate-400">Dossier: {p.patientNumber}</div>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">
                        {p.patientPhone || '—'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-200">
                          {p.missedCount} / {p.totalBookings}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                          Confirmation obligatoire
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {p.patientPhone ? (
                          <a
                            href={`tel:${p.patientPhone}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 hover:bg-primary-100 font-semibold transition"
                            title="Appel de rappel / confirmation"
                          >
                            <Phone className="w-3 h-3" />
                            <span>Appeler</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Pas de tél</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column (5 cols): 8 Dental Specialties Breakdown */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Répartition par Spécialité
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Volume d’actes et chiffre d’affaires en DA
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {specialties.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Aucun acte enregistré pour le moment.
              </div>
            ) : (
              specialties.map((spec) => (
                <div key={spec.specialty} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {spec.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {spec.treatmentCount} acte(s)
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {spec.revenueDA.toLocaleString()} DA
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {spec.percentage}%
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getSpecialtyColor(
                        spec.specialty
                      )}`}
                      style={{ width: `${Math.max(spec.percentage, 3)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
