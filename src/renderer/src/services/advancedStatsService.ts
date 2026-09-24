import {
  ClinicalOverviewStats,
  PeakHourCell,
  ChronicLatePatient,
  SpecialtyDistribution
} from '@shared/types'
import { getElectronApi } from './apiClient'

export const advancedStatsService = {
  async getOverview(startDate?: string, endDate?: string): Promise<ClinicalOverviewStats> {
    const api = getElectronApi()
    return await api.getClinicalOverviewStats(startDate, endDate)
  },

  async getPeakHours(): Promise<PeakHourCell[]> {
    const api = getElectronApi()
    return await api.getPeakHoursDistribution()
  },

  async getChronicLatePatients(): Promise<ChronicLatePatient[]> {
    const api = getElectronApi()
    return await api.getChronicLatePatients()
  },

  async getSpecialtyDistribution(): Promise<SpecialtyDistribution[]> {
    const api = getElectronApi()
    return await api.getSpecialtyDistribution()
  }
}
