import { ToothRecord, Treatment, ClinicalNote, Prescription, MedicalAct } from '@shared/types'
import { getElectronApi } from './apiClient'

export const clinicalService = {
  // Dental Chart FDI 11..48
  async getToothRecords(patientId: string): Promise<ToothRecord[]> {
    const api = getElectronApi()
    return await api.getToothRecords(patientId)
  },

  async saveToothRecord(record: Omit<ToothRecord, 'id' | 'updatedAt'>): Promise<ToothRecord> {
    const api = getElectronApi()
    return await api.saveToothRecord(record)
  },

  // Treatments (Actes Réalisés)
  async getTreatments(patientId: string): Promise<Treatment[]> {
    const api = getElectronApi()
    return await api.getTreatments(patientId)
  },

  async saveTreatment(
    treatment: Omit<Treatment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<Treatment> {
    const api = getElectronApi()
    return await api.saveTreatment(treatment)
  },

  // Medical Acts (Catalogue d'actes dentaires - 8 Spécialités)
  async getMedicalActs(category?: string, search?: string): Promise<MedicalAct[]> {
    const api = getElectronApi()
    return await api.getMedicalActs(category, search)
  },

  async saveMedicalAct(
    act: Omit<MedicalAct, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<MedicalAct> {
    const api = getElectronApi()
    return await api.saveMedicalAct(act)
  },

  // Clinical Notes
  async getClinicalNotes(patientId: string): Promise<ClinicalNote[]> {
    const api = getElectronApi()
    return await api.getClinicalNotes(patientId)
  },

  async saveClinicalNote(
    note: Omit<ClinicalNote, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ClinicalNote> {
    const api = getElectronApi()
    return await api.saveClinicalNote(note)
  },

  // Prescriptions
  async getPrescriptions(patientId: string): Promise<Prescription[]> {
    const api = getElectronApi()
    return await api.getPrescriptions(patientId)
  },

  async savePrescription(
    prescription: Omit<Prescription, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<Prescription> {
    const api = getElectronApi()
    return await api.savePrescription(prescription)
  }
}
