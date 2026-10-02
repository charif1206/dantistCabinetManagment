import { PatientRadio } from '@shared/types'

export const radioService = {
  async getRadios(patientId: string): Promise<PatientRadio[]> {
    if (typeof window !== 'undefined' && window.api?.getPatientRadios) {
      return await window.api.getPatientRadios(patientId)
    }
    const stored = localStorage.getItem(`dentaflow_radios_${patientId}`)
    return stored ? JSON.parse(stored) : []
  },

  async saveRadio(
    radio: Omit<PatientRadio, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<PatientRadio> {
    if (typeof window !== 'undefined' && window.api?.savePatientRadio) {
      return await window.api.savePatientRadio(radio)
    }
    const current = await this.getRadios(radio.patientId)
    const now = new Date().toISOString()
    const id = radio.id || `rad_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const savedRadio: PatientRadio = {
      id,
      patientId: radio.patientId,
      radioType: radio.radioType,
      toothNumber: radio.toothNumber,
      date: radio.date || now.split('T')[0],
      imageData: radio.imageData,
      fileName: radio.fileName,
      fileSize: radio.fileSize,
      notes: radio.notes,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    }
    const filtered = current.filter((r) => r.id !== id)
    filtered.unshift(savedRadio)
    localStorage.setItem(`dentaflow_radios_${radio.patientId}`, JSON.stringify(filtered))
    return savedRadio
  },

  async deleteRadio(id: string, patientId?: string): Promise<boolean> {
    if (typeof window !== 'undefined' && window.api?.deletePatientRadio) {
      return await window.api.deletePatientRadio(id, patientId)
    }
    if (patientId) {
      const current = await this.getRadios(patientId)
      const filtered = current.filter((r) => r.id !== id)
      localStorage.setItem(`dentaflow_radios_${patientId}`, JSON.stringify(filtered))
    }
    return true
  }
}
