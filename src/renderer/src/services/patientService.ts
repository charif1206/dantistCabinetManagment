import { Patient, MedicalAntecedentsRecord } from '@shared/types'
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
  },

  async getMedicalHistory(patientId: string): Promise<MedicalAntecedentsRecord | null> {
    const api = getElectronApi()
    return await api.getPatientMedicalHistory(patientId)
  },

  async saveMedicalHistory(
    record: Omit<MedicalAntecedentsRecord, 'id' | 'updatedAt'> & { id?: string }
  ): Promise<MedicalAntecedentsRecord> {
    const api = getElectronApi()
    return await api.savePatientMedicalHistory(record)
  }
}
