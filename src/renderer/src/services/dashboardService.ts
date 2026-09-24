import { DashboardStats, MachineAccountState } from '@shared/types'
import { getElectronApi } from './apiClient'

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    const api = getElectronApi()
    return await api.getDashboardStats()
  },

  async getMachineState(): Promise<MachineAccountState> {
    const api = getElectronApi()
    return await api.getMachineState()
  },

  async triggerSync(): Promise<{ success: boolean; syncedCount: number }> {
    const api = getElectronApi()
    return await api.triggerManualSync()
  },

  subscribeToSyncState(callback: (state: MachineAccountState) => void): () => void {
    const api = getElectronApi()
    return api.onSyncStateChanged(callback)
  }
}
