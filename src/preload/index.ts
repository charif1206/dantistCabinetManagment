import { contextBridge, ipcRenderer } from 'electron'
import {
  ElectronAPI,
  MachineAccountState,
  Patient,
  Appointment,
  ToothRecord,
  Treatment,
  MedicalAct,
  Payment,
  Invoice,
  ClinicalNote,
  Prescription,
  DrugItem,
  PrescriptionTemplate
} from '../shared/types'

const api: ElectronAPI = {
  // Machine & Cloud Sync
  getMachineState: () => ipcRenderer.invoke('machine:getState'),
  triggerManualSync: () => ipcRenderer.invoke('sync:triggerManual'),
  onSyncStateChanged: (callback: (state: MachineAccountState) => void) => {
    const handler = (_event: any, state: MachineAccountState) => callback(state)
    ipcRenderer.on('sync:stateChanged', handler)
    return () => {
      ipcRenderer.removeListener('sync:stateChanged', handler)
    }
  },

  // Users & Auth
  login: (username: string, passwordHash: string) =>
    ipcRenderer.invoke('auth:login', username, passwordHash),
  getUsers: () => ipcRenderer.invoke('users:getAll'),

  // Patients
  getPatients: (search?: string) => ipcRenderer.invoke('patients:getAll', search),
  getPatientById: (id: string) => ipcRenderer.invoke('patients:getById', id),
  savePatient: (patient: Omit<Patient, 'id' | 'patientNumber' | 'createdAt' | 'updatedAt' | 'syncStatus'> & { id?: string; patientNumber?: string }) =>
    ipcRenderer.invoke('patients:save', patient),
  deletePatient: (id: string) => ipcRenderer.invoke('patients:delete', id),

  // Appointments
  getAppointments: (startDate?: string, endDate?: string) =>
    ipcRenderer.invoke('appointments:getAll', startDate, endDate),
  saveAppointment: (appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'> & { id?: string }) =>
    ipcRenderer.invoke('appointments:save', appointment),
  updateAppointmentStatus: (id: string, status: Appointment['status']) =>
    ipcRenderer.invoke('appointments:updateStatus', id, status),
  deleteAppointment: (id: string) => ipcRenderer.invoke('appointments:delete', id),

  // Dental Chart & Treatments
  getToothRecords: (patientId: string) => ipcRenderer.invoke('clinical:getToothRecords', patientId),
  saveToothRecord: (record: Omit<ToothRecord, 'id' | 'updatedAt'>) =>
    ipcRenderer.invoke('clinical:saveToolRecord', record),
  getTreatments: (patientId: string) => ipcRenderer.invoke('clinical:getTreatments', patientId),
  saveTreatment: (treatment: Omit<Treatment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) =>
    ipcRenderer.invoke('clinical:saveTreatment', treatment),

  // Clinical Notes & Prescriptions
  getClinicalNotes: (patientId: string) => ipcRenderer.invoke('clinical:getNotes', patientId),
  saveClinicalNote: (note: Omit<ClinicalNote, 'id' | 'createdAt' | 'updatedAt'>) =>
    ipcRenderer.invoke('clinical:saveNote', note),
  getPrescriptions: (patientId: string) => ipcRenderer.invoke('prescriptions:getAll', patientId),
  savePrescription: (prescription: Omit<Prescription, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) =>
    ipcRenderer.invoke('prescriptions:save', prescription),

  // Drugs Catalog & Prescription Templates (Prompt 4)
  getDrugsCatalog: (search?: string, category?: string) =>
    ipcRenderer.invoke('drugs:getAll', search, category),
  saveDrug: (drug: Omit<DrugItem, 'id' | 'createdAt'> & { id?: string }) =>
    ipcRenderer.invoke('drugs:save', drug),
  deleteDrug: (id: string) => ipcRenderer.invoke('drugs:delete', id),
  getPrescriptionTemplates: (search?: string) =>
    ipcRenderer.invoke('prescriptionTemplates:getAll', search),
  savePrescriptionTemplate: (template: Omit<PrescriptionTemplate, 'id' | 'createdAt'> & { id?: string }) =>
    ipcRenderer.invoke('prescriptionTemplates:save', template),
  deletePrescriptionTemplate: (id: string) =>
    ipcRenderer.invoke('prescriptionTemplates:delete', id),

  // Medical Acts (Catalogue)
  getMedicalActs: (category?: string, search?: string) =>
    ipcRenderer.invoke('acts:getAll', category, search),
  saveMedicalAct: (act: Omit<MedicalAct, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) =>
    ipcRenderer.invoke('acts:save', act),

  // Invoices & Payments
  getInvoices: (patientId?: string) => ipcRenderer.invoke('invoices:getAll', patientId),
  saveInvoice: (
    invoice: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'remainingAmount' | 'status'> & {
      id?: string
      invoiceNumber?: string
      remainingAmount?: number
      status?: Invoice['status']
    }
  ) => ipcRenderer.invoke('invoices:save', invoice),
  recordPayment: (payment: Omit<Payment, 'id' | 'createdAt'>) =>
    ipcRenderer.invoke('payments:record', payment),

  // Stats
  getDashboardStats: () => ipcRenderer.invoke('dashboard:getStats'),

  // Local Backup & Integrity
  createBackup: (targetDir?: string) => ipcRenderer.invoke('backup:create', targetDir),
  verifyDatabase: () => ipcRenderer.invoke('backup:verify'),

  // Native Printing & PDF Export
  printDocument: (options?: { silent?: boolean; printBackground?: boolean; deviceName?: string }) =>
    ipcRenderer.invoke('app:print', options),
  exportToPDF: (options?: { title?: string; pageSize?: 'A4' | 'A5' }) =>
    ipcRenderer.invoke('app:exportToPDF', options),

  // 1. Prosthetic Laboratories & Orders
  getProstheticLabs: () => ipcRenderer.invoke('labs:getAll'),
  saveProstheticLab: (lab) => ipcRenderer.invoke('labs:save', lab),
  deleteProstheticLab: (id) => ipcRenderer.invoke('labs:delete', id),
  getProthesisOrders: (filters) => ipcRenderer.invoke('prothesis:getAll', filters),
  getProthesisOrderById: (id) => ipcRenderer.invoke('prothesis:getById', id),
  saveProthesisOrder: (order) => ipcRenderer.invoke('prothesis:save', order),
  updateProthesisOrderStatus: (id, status) => ipcRenderer.invoke('prothesis:updateStatus', id, status),
  deleteProthesisOrder: (id) => ipcRenderer.invoke('prothesis:delete', id),

  // 2. Patient Systemic Medical History & Risk Badges
  getPatientMedicalHistory: (patientId) => ipcRenderer.invoke('medicalHistory:getByPatientId', patientId),
  savePatientMedicalHistory: (record) => ipcRenderer.invoke('medicalHistory:save', record),

  // 3. Devis (Quotations) & Long-Term Treatment Plans
  getDevis: (patientId) => ipcRenderer.invoke('devis:getAll', patientId),
  getDevisById: (id) => ipcRenderer.invoke('devis:getById', id),
  saveDevis: (devis, items) => ipcRenderer.invoke('devis:save', devis, items),
  updateDevisStatus: (id, status) => ipcRenderer.invoke('devis:updateStatus', id, status),
  deleteDevis: (id) => ipcRenderer.invoke('devis:delete', id),
  convertDevisToTreatments: (devisId) => ipcRenderer.invoke('devis:convertToTreatments', devisId),

  // 4. Multi-session Treatment Projects (ODF / Implant)
  getTreatmentProjects: (patientId) => ipcRenderer.invoke('treatmentProjects:getAll', patientId),
  getTreatmentProjectById: (id) => ipcRenderer.invoke('treatmentProjects:getById', id),
  saveTreatmentProject: (project) => ipcRenderer.invoke('treatmentProjects:save', project),
  deleteTreatmentProject: (id) => ipcRenderer.invoke('treatmentProjects:delete', id),

  // 5. Medical Lab Tests & Pre-op Bilans
  getLabTestOrders: (patientId) => ipcRenderer.invoke('labTests:getAll', patientId),
  getLabTestOrderById: (id) => ipcRenderer.invoke('labTests:getById', id),
  saveLabTestOrder: (order) => ipcRenderer.invoke('labTests:save', order),
  recordLabTestResults: (id, results, isCritical, alertMessage) =>
    ipcRenderer.invoke('labTests:recordResults', id, results, isCritical, alertMessage),
  deleteLabTestOrder: (id) => ipcRenderer.invoke('labTests:delete', id),

  // 6. Live Waiting Room
  getWaitingRoomEntries: (status) => ipcRenderer.invoke('waitingRoom:getAll', status),
  addToWaitingRoom: (entry) => ipcRenderer.invoke('waitingRoom:add', entry),
  updateWaitingRoomStatus: (id, status, calledTime, departureTime) =>
    ipcRenderer.invoke('waitingRoom:updateStatus', id, status, calledTime, departureTime),
  deleteWaitingRoomEntry: (id) => ipcRenderer.invoke('waitingRoom:delete', id),

  // 7. Advanced Analytics & Efficiency KPIs
  getClinicalOverviewStats: (startDate, endDate) =>
    ipcRenderer.invoke('analytics:getOverview', startDate, endDate),
  getPeakHoursDistribution: () => ipcRenderer.invoke('analytics:getPeakHours'),
  getChronicLatePatients: () => ipcRenderer.invoke('analytics:getChronicLate'),
  getSpecialtyDistribution: () => ipcRenderer.invoke('analytics:getSpecialtyDistribution')
}

// Expose strictly via contextBridge
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Failed to expose Electron API to renderer:', error)
  }
} else {
  // @ts-ignore
  window.api = api
}
