import { User } from '@shared/types'
import { getElectronApi } from './apiClient'

export const authService = {
  async login(username: string, passwordHash: string): Promise<{ success: boolean; user?: User; error?: string }> {
    const api = getElectronApi()
    return await api.login(username, passwordHash)
  },

  async getUsers(): Promise<User[]> {
    const api = getElectronApi()
    return await api.getUsers()
  }
}
