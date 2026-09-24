import { getElectronApi } from './apiClient'

export const printService = {
  /**
   * Triggers native printing with background graphics enabled
   */
  async printDocument(options?: {
    silent?: boolean
    printBackground?: boolean
    deviceName?: string
  }): Promise<boolean> {
    try {
      const api = getElectronApi()
      if (api && typeof api.printDocument === 'function') {
        return await api.printDocument({
          silent: options?.silent ?? false,
          printBackground: options?.printBackground ?? true,
          deviceName: options?.deviceName
        })
      }
    } catch (err) {
      console.warn('Native Electron print failed, falling back to window.print():', err)
    }

    // Web / browser fallback
    window.print()
    return true
  },

  /**
   * Generates a high-quality PDF using Electron Chromium printToPDF and lets user save it
   */
  async exportToPDF(options?: {
    title?: string
    pageSize?: 'A4' | 'A5'
  }): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const api = getElectronApi()
      if (api && typeof api.exportToPDF === 'function') {
        return await api.exportToPDF(options)
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Export PDF non disponible' }
    }

    window.print()
    return { success: true }
  }
}
