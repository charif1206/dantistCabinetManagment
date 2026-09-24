import { Patient } from '@shared/types'
import { getElectronApi } from './apiClient'

export const patientService = {
  async getPatients(search?: string): Promise<Patient[]> {
    const api = getElectronApi()
    return await api.getPatients(search)
  },

  async getPatientById(id: string): Promise<Patient | null> {
    const api = getElectronApi()
    return await api.getPatientById(id)
  },

  async savePatient(
    patient: Omit<Patient, 'id' | 'patientNumber' | 'createdAt' | 'updatedAt' | 'syncStatus'> & { id?: string; patientNumber?: string }
  ): Promise<Patient> {
    const api = getElectronApi()
    return await api.savePatient(patient)
  },

  async deletePatient(id: string): Promise<boolean> {
    const api = getElectronApi()
    return await api.deletePatient(id)
  }
}
