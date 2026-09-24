import { Appointment } from '@shared/types'
import { getElectronApi } from './apiClient'

export const appointmentService = {
  async getAppointments(startDate?: string, endDate?: string): Promise<Appointment[]> {
    const api = getElectronApi()
    return await api.getAppointments(startDate, endDate)
  },

  async saveAppointment(
    appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'> & { id?: string }
  ): Promise<Appointment> {
    const api = getElectronApi()
    return await api.saveAppointment(appointment)
  },

  async updateStatus(id: string, status: Appointment['status']): Promise<boolean> {
    const api = getElectronApi()
    return await api.updateAppointmentStatus(id, status)
  },

  async deleteAppointment(id: string): Promise<boolean> {
    const api = getElectronApi()
    return await api.deleteAppointment(id)
  }
}
