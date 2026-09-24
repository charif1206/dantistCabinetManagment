import { LabTestOrder } from '@shared/types'
import { getElectronApi } from './apiClient'

export function evaluateCriticalLabResults(results: Record<string, string>): {
  isCritical: boolean
  alertMessage: string
} {
  const alerts: string[] = []

  for (const [key, val] of Object.entries(results)) {
    const k = key.toLowerCase()
    const num = parseFloat(val.replace(',', '.').replace(/[^0-9.]/g, ''))

    if (!isNaN(num)) {
      // 1. Glycémie à jeun > 1.80 g/L
      if (k.includes('glyc') || k.includes('sucre') || k.includes('glucose')) {
        if (num > 1.80) {
          alerts.push(`Glycémie critique (${val} > 1.80 g/L) : Risque infectieux majeur & retard de cicatrisation`)
        }
      }

      // 2. INR > 3.0
      if (k.includes('inr')) {
        if (num > 3.0) {
          alerts.push(`INR critique (${val} > 3.0) : Risque hémorragique sévère, contre-indication chirurgicale/implantaire`)
        }
      }

      // 3. Plaquettes < 100,000 /mm³
      if (k.includes('plaquette') || k.includes('plt')) {
        const valAdjusted = num < 1000 ? num * 1000 : num
        if (valAdjusted < 100000) {
          alerts.push(`Thrombopénie critique (${val} < 100.000 /mm³) : Risque de saignement prolongé non contrôlé`)
        }
      }

      // 4. TP < 50%
      if (k.includes('tp') && !k.includes('inr')) {
        if (num < 50) {
          alerts.push(`Taux de Prothrombine effondré (${val} < 50%) : Risque hémorragique élevé`)
        }
      }
    }

    // 5. Sérologies
    if (k.includes('hbs') || k.includes('hcv') || k.includes('vih') || k.includes('sérologie') || k.includes('serologie')) {
      const v = val.toLowerCase()
      if (v.includes('pos') || v.includes('réactif') || v.includes('reactif')) {
        alerts.push(`Sérologie positive (${key} : ${val}) : Protocole universel renforcé de bio-sécurité chirurgicale`)
      }
    }
  }

  return {
    isCritical: alerts.length > 0,
    alertMessage: alerts.join(' | ')
  }
}

export const labTestService = {
  async getLabOrders(patientId?: string): Promise<LabTestOrder[]> {
    const api = getElectronApi()
    return await api.getLabTestOrders(patientId)
  },

  async getLabOrderById(id: string): Promise<LabTestOrder | null> {
    const api = getElectronApi()
    return await api.getLabTestOrderById(id)
  },

  async saveLabOrder(
    order: Omit<LabTestOrder, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'> & {
      id?: string
      orderNumber?: string
    }
  ): Promise<LabTestOrder> {
    const api = getElectronApi()
    return await api.saveLabTestOrder(order)
  },

  async recordResults(
    id: string,
    results: Record<string, string>,
    isCritical?: boolean,
    alertMessage?: string
  ): Promise<LabTestOrder> {
    const api = getElectronApi()
    return await api.recordLabTestResults(id, results, isCritical, alertMessage)
  },

  async deleteLabOrder(id: string): Promise<boolean> {
    const api = getElectronApi()
    return await api.deleteLabTestOrder(id)
  },

  evaluateCritical(results: Record<string, string>): { isCritical: boolean; alertMessage: string } {
    return evaluateCriticalLabResults(results)
  }
}
