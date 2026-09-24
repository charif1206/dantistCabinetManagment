import { WaitingRoomEntry, WaitingRoomStatus } from '@shared/types'
import { getElectronApi } from './apiClient'

export const waitingRoomService = {
  async getWaitingQueue(status?: WaitingRoomStatus): Promise<WaitingRoomEntry[]> {
    const api = getElectronApi()
    return await api.getWaitingRoomEntries(status)
  },

  async addToWaitingQueue(
    entry: Omit<WaitingRoomEntry, 'id' | 'createdAt' | 'arrivalTime'> & {
      id?: string
      arrivalTime?: string
    }
  ): Promise<WaitingRoomEntry> {
    const api = getElectronApi()
    return await api.addToWaitingRoom(entry)
  },

  async updateStatus(
    id: string,
    status: WaitingRoomStatus,
    calledTime?: string,
    departureTime?: string
  ): Promise<boolean> {
    const api = getElectronApi()
    return await api.updateWaitingRoomStatus(id, status, calledTime, departureTime)
  },

  async callPatientToChair(id: string): Promise<boolean> {
    const api = getElectronApi()
    return await api.updateWaitingRoomStatus(id, 'IN_CHAIR', new Date().toISOString())
  },

  async finishVisit(id: string): Promise<boolean> {
    const api = getElectronApi()
    return await api.updateWaitingRoomStatus(id, 'DONE', undefined, new Date().toISOString())
  },

  async removeFromQueue(id: string): Promise<boolean> {
    const api = getElectronApi()
    return await api.deleteWaitingRoomEntry(id)
  }
}
