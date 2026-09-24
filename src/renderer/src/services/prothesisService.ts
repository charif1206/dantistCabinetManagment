import {
  ProstheticLaboratory,
  ProthesisOrder,
  ProthesisOrderStatus
} from '@shared/types'
import { getElectronApi } from './apiClient'

export const prothesisService = {
  // Laboratories
  async getLabs(): Promise<ProstheticLaboratory[]> {
    const api = getElectronApi()
    return await api.getProstheticLabs()
  },

  async saveLab(
    lab: Omit<ProstheticLaboratory, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<ProstheticLaboratory> {
    const api = getElectronApi()
    return await api.saveProstheticLab(lab)
  },

  async deleteLab(id: string): Promise<boolean> {
    const api = getElectronApi()
    return await api.deleteProstheticLab(id)
  },

  // Orders
  async getOrders(filters?: {
    patientId?: string
    labId?: string
    status?: ProthesisOrderStatus
  }): Promise<ProthesisOrder[]> {
    const api = getElectronApi()
    return await api.getProthesisOrders(filters)
  },

  async getOrderById(id: string): Promise<ProthesisOrder | null> {
    const api = getElectronApi()
    return await api.getProthesisOrderById(id)
  },

  async saveOrder(
    order: Omit<ProthesisOrder, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'> & {
      id?: string
      orderNumber?: string
    }
  ): Promise<ProthesisOrder> {
    const api = getElectronApi()
    return await api.saveProthesisOrder(order)
  },

  async updateOrderStatus(id: string, status: ProthesisOrderStatus): Promise<boolean> {
    const api = getElectronApi()
    return await api.updateProthesisOrderStatus(id, status)
  },

  async deleteOrder(id: string): Promise<boolean> {
    const api = getElectronApi()
    return await api.deleteProthesisOrder(id)
  }
}
