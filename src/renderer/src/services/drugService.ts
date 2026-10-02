import { DrugItem, PrescriptionTemplate, Prescription } from '@shared/types'
import { getElectronApi } from './apiClient'

export const drugService = {
  async getDrugsCatalog(search?: string, category?: string): Promise<DrugItem[]> {
    const api = getElectronApi()
    return await api.getDrugsCatalog(search, category)
  },

  async saveDrug(
    drug: Omit<DrugItem, 'id' | 'createdAt'> & { id?: string }
  ): Promise<DrugItem> {
    const api = getElectronApi()
    return await api.saveDrug(drug)
  },

  async deleteDrug(id: string): Promise<boolean> {
    const api = getElectronApi()
    return await api.deleteDrug(id)
  },

  async getPrescriptionTemplates(search?: string): Promise<PrescriptionTemplate[]> {
    const api = getElectronApi()
    return await api.getPrescriptionTemplates(search)
  },

  async savePrescriptionTemplate(
    template: Omit<PrescriptionTemplate, 'id' | 'createdAt'> & { id?: string }
  ): Promise<PrescriptionTemplate> {
    const api = getElectronApi()
    return await api.savePrescriptionTemplate(template)
  },

  async deletePrescriptionTemplate(id: string): Promise<boolean> {
    const api = getElectronApi()
    return await api.deletePrescriptionTemplate(id)
  },

  // Prescriptions Management (Ordonnances)
  async getPrescriptions(patientId: string) {
    const api = getElectronApi()
    return await api.getPrescriptions(patientId)
  },

  async savePrescription(
    prescription: Omit<Prescription, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<Prescription> {
    const api = getElectronApi()
    return await api.savePrescription(prescription)
  },

  async deletePrescription(id: string): Promise<boolean> {
    const api = getElectronApi()
    return await api.deletePrescription(id)
  }
}

