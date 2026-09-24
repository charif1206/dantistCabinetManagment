import { ElectronAPI } from '@shared/types'

export function getElectronApi(): ElectronAPI {
  if (typeof window !== 'undefined' && window.api) {
    return window.api
  }
  throw new Error('[Services] Electron Preload API is not available in the current context.')
}
