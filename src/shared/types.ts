// DentaFlow Algeria - Shared Domain Types (Strict TypeScript)

export type UserRole = 'ADMIN' | 'DENTIST' | 'ASSISTANT'

export interface User {
  id: string
  username: string
  fullName: string
  role: UserRole
  active: boolean
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export interface AuthSession {
  user: User
  token: string
  loginTime: string
}

export interface Patient {
  id: string
  patientNumber: string // e.g. DZ-2026-0001
  firstName: string
  lastName: string
  cin?: string // Carte Nationale d'Identité / N.I.N
  phone: string // Algerian mobile: 05xx, 06xx, 07xx
  email?: string
  dateOfBirth?: string
  gender?: 'M' | 'F' | 'OTHER'
  address?: string
  wilaya?: string
  medicalAlerts?: string // Allergies, Diabète, etc.
  bloodGroup?: string
  notes?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  syncStatus?: 'synced' | 'pending' | 'conflict'
}

export interface Appointment {
  id: string
  patientId: string
  patientName: string
  patientPhone?: string
  dateTime: string
  durationMinutes: number
  treatmentType: string
  status: 'SCHEDULED' | 'CONFIRMED' | 'IN_CHAIR' | 'COMPLETED' | 'CANCELLED'
  dentistName?: string
  notes?: string
  colorTag?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  syncStatus?: 'synced' | 'pending'
}

export type ToothCondition =
  | 'HEALTHY'
  | 'CARIES'
  | 'FILLED_COMPOSITE'
  | 'FILLED_AMALGAM'
  | 'CROWN'
  | 'MISSING'
  | 'IMPLANT'
  | 'ROOT_CANAL'
  | 'EXTRACTION_PLANNED'

export interface ToothRecord {
  id: string
  patientId: string
  toothNumber: number // 11 to 48 (FDI World Dental Federation notation)
  condition: ToothCondition
  surfaces?: string // e.g. "MOD", "O", "V", "L"
  notes?: string
  updatedAt: string
  deletedAt?: string | null
  syncStatus?: 'synced' | 'pending'
}

export type ActCategory = 'SOINS' | 'PROTHESE' | 'CHIRURGIE'

export interface MedicalAct {
  id: string
  code: string
  name: string
  category: ActCategory
  defaultPrice: number // Price in Algerian Dinars (DA)
  durationMinutes: number
  active: boolean
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export interface ClinicalNote {
  id: string
  patientId: string
  practitioner: string
  date: string
  title: string
  category: 'CONSULTATION' | 'PROCEDURE' | 'PRESCRIPTION' | 'EMERGENCY'
  content: string
  attachments?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  syncStatus?: 'synced' | 'pending'
}

export interface Treatment {
  id: string
  patientId: string
  toothNumber?: number
  actId?: string
  actName: string
  price: number // DA
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED'
  date: string
  notes?: string
  dentistName?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  syncStatus?: 'synced' | 'pending'
}

export interface PrescriptionItem {
  id: string
  prescriptionId: string
  medicineName: string
  dosage: string // e.g. "1g"
  form: string // e.g. "Comprimé", "Gélule", "Sirop"
  instructions: string // e.g. "1 cp 3 fois par jour pendant 6 jours"
}

export interface Prescription {
  id: string
  patientId: string
  patientName: string
  dentistName: string
  date: string
  notes?: string
  items: PrescriptionItem[]
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  syncStatus?: 'synced' | 'pending'
}

export interface Payment {
  id: string
  patientId: string
  invoiceId?: string
  amount: number // in DA
  date: string
  method: 'CASH' | 'CHECK' | 'TRANSFER'
  notes?: string
  createdAt: string
  deletedAt?: string | null
  syncStatus?: 'synced' | 'pending'
}

export interface Invoice {
  id: string
  invoiceNumber: string
  patientId: string
  patientName: string
  date: string
  dueDate?: string
  totalAmount: number // Total in DA
  paidAmount: number // Total Paid in DA
  remainingAmount: number // Debt in DA
  status: 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE'
  paymentMethod?: 'CASH' | 'CHECK' | 'TRANSFER'
  itemsJson: string
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  syncStatus?: 'synced' | 'pending'
}

export interface SyncQueueItem {
  id: number
  entityType: 'patient' | 'appointment' | 'tooth_record' | 'clinical_note' | 'invoice' | 'treatment' | 'payment' | 'prescription'
  entityId: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  payload: string
  status: 'PENDING' | 'SYNCING' | 'FAILED'
  retryCount: number
  errorMessage?: string
  createdAt: string
  syncedAt?: string
}

export interface MachineAccountState {
  clinicId: string
  machineId: string
  machineUid: string
  isAuthenticated: boolean
  isOnline: boolean
  isMock: boolean
  lastSyncTimestamp: string | null
  pendingQueueCount: number
  error?: string | null
}

export interface DashboardStats {
  todayAppointmentsCount: number
  waitingPatientsCount: number
  completedTreatmentsCount: number
  totalPatientsCount: number
  todayRevenueDA: number // Algerian Dinars
  totalDebtsDA: number // Algerian Dinars
  pendingSyncCount: number
}

// Drug Catalog & Prescription Templates (Algerian Dental Form)
export interface DrugItem {
  id: string
  brandName: string
  genericName?: string
  dosage?: string
  form?: string
  defaultInstructions?: string
  category?: string
  isCustom?: number // 0 or 1
  createdAt: string
}

export interface PrescriptionTemplateItem {
  medicineName: string
  dosage: string
  form: string
  instructions: string
}

export interface PrescriptionTemplate {
  id: string
  title: string
  diagnosisHint?: string
  itemsJson: string
  createdAt: string
}

// Window API Exposed via Preload
export interface ElectronAPI {
  // Machine & Cloud Sync
  getMachineState: () => Promise<MachineAccountState>
  triggerManualSync: () => Promise<{ success: boolean; syncedCount: number }>
  onSyncStateChanged: (callback: (state: MachineAccountState) => void) => () => void

  // Users & Auth
  login: (username: string, passwordHash: string) => Promise<{ success: boolean; user?: User; error?: string }>
  getUsers: () => Promise<User[]>

  // Patients
  getPatients: (search?: string) => Promise<Patient[]>
  getPatientById: (id: string) => Promise<Patient | null>
  savePatient: (patient: Omit<Patient, 'id' | 'patientNumber' | 'createdAt' | 'updatedAt' | 'syncStatus'> & { id?: string; patientNumber?: string }) => Promise<Patient>
  deletePatient: (id: string) => Promise<boolean> // Soft delete

  // Appointments
  getAppointments: (startDate?: string, endDate?: string) => Promise<Appointment[]>
  saveAppointment: (appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'> & { id?: string }) => Promise<Appointment>
  updateAppointmentStatus: (id: string, status: Appointment['status']) => Promise<boolean>
  deleteAppointment: (id: string) => Promise<boolean>

  // Dental Chart & Treatments
  getToothRecords: (patientId: string) => Promise<ToothRecord[]>
  saveToothRecord: (record: Omit<ToothRecord, 'id' | 'updatedAt'>) => Promise<ToothRecord>
  getTreatments: (patientId: string) => Promise<Treatment[]>
  saveTreatment: (treatment: Omit<Treatment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<Treatment>

  // Clinical Notes & Prescriptions
  getClinicalNotes: (patientId: string) => Promise<ClinicalNote[]>
  saveClinicalNote: (note: Omit<ClinicalNote, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ClinicalNote>
  getPrescriptions: (patientId: string) => Promise<Prescription[]>
  savePrescription: (prescription: Omit<Prescription, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<Prescription>

  // Drugs Catalog & Prescription Templates (Prompt 4)
  getDrugsCatalog: (search?: string, category?: string) => Promise<DrugItem[]>
  saveDrug: (drug: Omit<DrugItem, 'id' | 'createdAt'> & { id?: string }) => Promise<DrugItem>
  deleteDrug: (id: string) => Promise<boolean>
  getPrescriptionTemplates: (search?: string) => Promise<PrescriptionTemplate[]>
  savePrescriptionTemplate: (template: Omit<PrescriptionTemplate, 'id' | 'createdAt'> & { id?: string }) => Promise<PrescriptionTemplate>
  deletePrescriptionTemplate: (id: string) => Promise<boolean>

  // Medical Acts (Catalogue)
  getMedicalActs: () => Promise<MedicalAct[]>
  saveMedicalAct: (act: Omit<MedicalAct, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<MedicalAct>

  // Payments & Invoices
  getInvoices: (patientId?: string) => Promise<Invoice[]>
  saveInvoice: (invoice: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'remainingAmount' | 'status'> & { id?: string; invoiceNumber?: string; remainingAmount?: number; status?: Invoice['status'] }) => Promise<Invoice>
  recordPayment: (payment: Omit<Payment, 'id' | 'createdAt'>) => Promise<Payment>

  // Stats
  getDashboardStats: () => Promise<DashboardStats>

  // Local Backup & Integrity
  createBackup: (targetDir?: string) => Promise<{ success: boolean; backupPath: string; sizeBytes: number; error?: string }>
  verifyDatabase: () => Promise<{ ok: boolean; message: string }>

  // Native Printing & PDF Export
  printDocument: (options?: { silent?: boolean; printBackground?: boolean; deviceName?: string }) => Promise<boolean>
  exportToPDF: (options?: { title?: string; pageSize?: 'A4' | 'A5' }) => Promise<{ success: boolean; filePath?: string; error?: string }>
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
