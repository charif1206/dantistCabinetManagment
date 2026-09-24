import { getElectronApi } from './apiClient'

export const backupService = {
  async createBackup(targetDir?: string): Promise<{ success: boolean; backupPath: string; sizeBytes: number; error?: string }> {
    const api = getElectronApi()
    return await api.createBackup(targetDir)
  },

  async verifyDatabase(): Promise<{ ok: boolean; message: string }> {
    const api = getElectronApi()
    return await api.verifyDatabase()
  }
}
