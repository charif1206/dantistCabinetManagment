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
  },

  subscribeToStatsUpdates(callback: (stats?: DashboardStats) => void): () => void {
    const api = getElectronApi()
    const unsubElectron = api.onDashboardStatsChanged?.(() => {
      this.getStats().then(callback).catch(console.error)
    })
    const handleEvent = (): void => {
      this.getStats().then(callback).catch(console.error)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('billing:updated', handleEvent)
      window.addEventListener('stats:refresh', handleEvent)
    }
    return () => {
      unsubElectron?.()
      if (typeof window !== 'undefined') {
        window.removeEventListener('billing:updated', handleEvent)
        window.removeEventListener('stats:refresh', handleEvent)
      }
    }
  }
}
