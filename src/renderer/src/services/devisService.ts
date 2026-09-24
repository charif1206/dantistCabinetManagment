import {
  Devis,
  DevisItem,
  DevisStatus,
  TreatmentProject
} from '@shared/types'
import { getElectronApi } from './apiClient'

export const devisService = {
  // 1. Devis (Estimations / Quotations)
  async getDevis(patientId?: string): Promise<Devis[]> {
    const api = getElectronApi()
    return await api.getDevis(patientId)
  },

  async getDevisById(id: string): Promise<Devis | null> {
    const api = getElectronApi()
    return await api.getDevisById(id)
  },

  async saveDevis(
    devis: Omit<Devis, 'id' | 'devisNumber' | 'createdAt' | 'updatedAt' | 'items'> & {
      id?: string
      devisNumber?: string
    },
    items: Omit<DevisItem, 'id' | 'devisId'>[]
  ): Promise<Devis> {
    const api = getElectronApi()
    return await api.saveDevis(devis, items)
  },

  async updateDevisStatus(id: string, status: DevisStatus): Promise<boolean> {
    const api = getElectronApi()
    return await api.updateDevisStatus(id, status)
  },

  async deleteDevis(id: string): Promise<boolean> {
    const api = getElectronApi()
    return await api.deleteDevis(id)
  },

  async convertDevisToTreatments(
    devisId: string
  ): Promise<{ success: boolean; createdTreatmentsCount: number }> {
    const api = getElectronApi()
    return await api.convertDevisToTreatments(devisId)
  },

  // 2. Treatment Projects (Long-term roadmaps ODF / Implant)
  async getTreatmentProjects(patientId?: string): Promise<TreatmentProject[]> {
    const api = getElectronApi()
    return await api.getTreatmentProjects(patientId)
  },

  async getTreatmentProjectById(id: string): Promise<TreatmentProject | null> {
    const api = getElectronApi()
    return await api.getTreatmentProjectById(id)
  },

  async saveTreatmentProject(
    project: Omit<TreatmentProject, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<TreatmentProject> {
    const api = getElectronApi()
    return await api.saveTreatmentProject(project)
  },

  async deleteTreatmentProject(id: string): Promise<boolean> {
    const api = getElectronApi()
    return await api.deleteTreatmentProject(id)
  }
}
