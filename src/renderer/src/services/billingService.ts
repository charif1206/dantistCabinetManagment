import { MedicalAct, Invoice, Payment, Treatment } from '@shared/types'
import { getElectronApi } from './apiClient'

export const billingService = {
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

  async getInvoices(patientId?: string): Promise<Invoice[]> {
    const api = getElectronApi()
    return await api.getInvoices(patientId)
  },

  async saveInvoice(
    invoice: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'remainingAmount' | 'status'> & {
      id?: string
      invoiceNumber?: string
      remainingAmount?: number
      status?: Invoice['status']
    }
  ): Promise<Invoice> {
    const api = getElectronApi()
    const result = await api.saveInvoice(invoice)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('billing:updated'))
    }
    return result
  },

  async recordPayment(payment: Omit<Payment, 'id' | 'createdAt'>): Promise<Payment> {
    const api = getElectronApi()
    const result = await api.recordPayment(payment)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('billing:updated'))
    }
    return result
  }
}
