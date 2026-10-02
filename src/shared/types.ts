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
  medicalAlerts?: string | null // Allergies, Diabète, etc.
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
  toothNumber: number // FDI notation: 11 to 48 (Permanent) and 51 to 85 (Deciduous/Pediatric)
  condition: ToothCondition
  surfaces?: string // e.g. "MOD", "O", "V", "L"
  notes?: string
  updatedAt: string
  deletedAt?: string | null
  syncStatus?: 'synced' | 'pending'
}

export type ActCategory = 'SOINS' | 'PROTHESE' | 'CHIRURGIE'

// 8 Clinical Specialties for Algerian Dental Practice
export type DentalSpecialty =
  | 'ODF'
  | 'PROTHESE_FIXE'
  | 'PROTHESE_AMOVIBLE'
  | 'CHIRURGIE'
  | 'IMPLANT'
  | 'SOINS'
  | 'SOINS_CONSERVATEURS'
  | 'ENDODONTIE'
  | 'CONSULTATION_IMAGERIE'
  | 'PARODONTIE'
  | 'PARODONTOLOGIE'

export interface MedicalAct {
  id: string
  code: string
  name: string
  category: DentalSpecialty | ActCategory | string
  specialty?: string
  defaultPrice: number // Price in Algerian Dinars (DA)
  defaultPriceDA?: number
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
  receiptNumber?: string
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
  debtorPatientsCount?: number
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

// 1. Prosthetic Laboratories & Prothesis Orders
export interface ProstheticLaboratory {
  id: string
  name: string
  phone: string
  wilaya?: string | null
  address?: string | null
  contactPerson?: string | null
  active: boolean | number
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export type ProthesisOrderStatus =
  | 'PREPARATION'
  | 'SENT'
  | 'RECEIVED'
  | 'FITTING'
  | 'DELIVERED'
  | 'REJECTED'

export type ProthesisNature =
  | 'ZIRCONE'
  | 'CERAMO_METALLIQUE'
  | 'EMAX'
  | 'STELLITE'
  | 'RESINE_COMPLETE'
  | 'RESINE_PARTIELLE'
  | 'INLAY_ONLAY'
  | string

export interface ProthesisOrder {
  id: string
  orderNumber: string // e.g. LAB-2026-0001
  patientId: string
  patientName: string
  dentistName: string
  labId: string
  labName: string
  actName: string
  toothNumber?: number | null // FDI: 11-48 or 51-85 (main tooth or first tooth)
  teeth?: string | null // All selected teeth (e.g. "11, 12, 13" for bridges)
  shade: string // Vita A1-D4, 3D Master, Bleach
  nature: ProthesisNature
  status: ProthesisOrderStatus
  sentDate?: string | null
  expectedDate?: string | null
  receivedDate?: string | null
  deliveryDate?: string | null
  labCostDA: number
  clinicPriceDA: number
  notes?: string | null
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

// 2. Patient Systemic Medical History & Risk Stratification
export type GeneralRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'

export interface MedicalAntecedentsRecord {
  id: string
  patientId: string
  cardioChecklist: string[] // HTA, Cardiopathie, Souffle, Valve, Pacemaker, Infarctus
  hematologyChecklist: string[] // Anticoagulant, Hémostase, Hémophilie, Saignement
  gastroChecklist: string[] // Hépatite B/C, Cirrhose, Ulcère
  respiratoryChecklist: string[] // Asthme, BPCO, Insuffisance
  endocrineChecklist: string[] // Diabète Type 1/2, Thyroïde
  allergiesChecklist: string[] // Pénicilline, Latex, Anesthésique avec adrénaline, AINS
  isPregnantOrNursing?: boolean | number
  pregnancyMonth?: number | null
  generalRiskLevel: GeneralRiskLevel
  doctorNotes?: string | null
  updatedAt: string
}

// 3. Devis (Official Quotations in Algerian Dinars DA)
export type DevisStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED'

export interface DevisItem {
  id: string
  devisId: string
  actId?: string | null
  actName: string
  specialty: DentalSpecialty | string
  toothNumber?: number | null
  quantity: number
  unitPriceDA: number
  totalPriceDA: number
}

export interface Devis {
  id: string
  devisNumber: string // e.g. DEV-2026-0001
  patientId: string
  patientName: string
  dentistName: string
  date: string
  validityDays: number
  totalGrossDA: number
  discountDA: number
  totalNetDA: number
  status: DevisStatus
  notes?: string | null
  items?: DevisItem[]
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

// 4. Multi-session Treatment Projects (ODF & Implant Roadmaps)
export type TreatmentProjectStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'SUSPENDED'

export interface TreatmentProjectPhase {
  phaseNumber: number
  title: string
  description?: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
  targetDate?: string
  completedDate?: string
  estimatedPriceDA?: number
  notes?: string
}

export interface TreatmentProject {
  id: string
  patientId: string
  title: string // e.g. "Orthodontie Bi-maxillaire", "Réhabilitation Implantaire"
  specialty: DentalSpecialty | string // 'ODF', 'IMPLANT', 'PROTHESE_FIXE'
  status: TreatmentProjectStatus
  totalPhases: number
  completedPhases: number
  estimatedTotalDA: number
  startDate?: string | null
  targetEndDate?: string | null
  roadmapJson: string // JSON representation of phases/steps
  createdAt: string
  updatedAt: string
}

// 5. Medical Lab Tests & Pre-operative Screenings
export type LabTestOrderStatus = 'PENDING' | 'RECEIVED' | 'VALIDATED'

export interface LabTestOrder {
  id: string
  orderNumber: string // e.g. BIL-2026-0001
  patientId: string
  dentistName: string
  requestDate: string
  reason?: string | null
  testsRequestedJson: string // e.g. ['Glycémie à jeun', 'TP/INR', 'FNS', 'Hépatite B/C']
  resultsJson: string // e.g. {'Glycémie': '1.02 g/L', 'INR': '1.10'}
  isCriticalAlert: boolean | number
  criticalAlertMessage?: string | null
  status: LabTestOrderStatus
  createdAt: string
  updatedAt: string
}

// 6. Live Waiting Room Queue
export type WaitingRoomStatus = 'WAITING' | 'IN_CHAIR' | 'DONE' | 'LEFT'

export interface WaitingRoomEntry {
  id: string
  patientId: string
  patientName: string
  patientPhone?: string | null
  appointmentId?: string | null
  arrivalTime: string
  calledTime?: string | null
  departureTime?: string | null
  status: WaitingRoomStatus
  isUrgent: boolean | number // Urgent case flag
  priorityNote?: string | null
  assignedDentist?: string | null
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
  permanentDeletePatient: (id: string) => Promise<boolean> // Hard delete (permanent)

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
  deletePrescription: (id: string) => Promise<boolean>

  // Drugs Catalog & Prescription Templates (Prompt 4)
  getDrugsCatalog: (search?: string, category?: string) => Promise<DrugItem[]>
  saveDrug: (drug: Omit<DrugItem, 'id' | 'createdAt'> & { id?: string }) => Promise<DrugItem>
  deleteDrug: (id: string) => Promise<boolean>
  getPrescriptionTemplates: (search?: string) => Promise<PrescriptionTemplate[]>
  savePrescriptionTemplate: (template: Omit<PrescriptionTemplate, 'id' | 'createdAt'> & { id?: string }) => Promise<PrescriptionTemplate>
  deletePrescriptionTemplate: (id: string) => Promise<boolean>

  // Medical Acts (Catalogue)
  getMedicalActs: (category?: string, search?: string) => Promise<MedicalAct[]>
  saveMedicalAct: (act: Omit<MedicalAct, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<MedicalAct>

  // Payments & Invoices
  getInvoices: (patientId?: string) => Promise<Invoice[]>
  saveInvoice: (invoice: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'remainingAmount' | 'status'> & { id?: string; invoiceNumber?: string; remainingAmount?: number; status?: Invoice['status'] }) => Promise<Invoice>
  recordPayment: (payment: Omit<Payment, 'id' | 'createdAt'>) => Promise<Payment>

  // Stats
  getDashboardStats: () => Promise<DashboardStats>
  onDashboardStatsChanged?: (callback: () => void) => () => void

  // Local Backup & Integrity
  createBackup: (targetDir?: string) => Promise<{ success: boolean; backupPath: string; sizeBytes: number; error?: string }>
  verifyDatabase: () => Promise<{ ok: boolean; message: string }>

  // Native Printing & PDF Export
  printDocument: (options?: { silent?: boolean; printBackground?: boolean; deviceName?: string }) => Promise<boolean>
  exportToPDF: (options?: { title?: string; pageSize?: 'A4' | 'A5' }) => Promise<{ success: boolean; filePath?: string; error?: string }>

  // ==========================================
  // New Modules (Update 2 Expansion)
  // ==========================================

  // 1. Prosthetic Laboratories & Orders
  getProstheticLabs: () => Promise<ProstheticLaboratory[]>
  saveProstheticLab: (lab: Omit<ProstheticLaboratory, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<ProstheticLaboratory>
  deleteProstheticLab: (id: string) => Promise<boolean>
  getProthesisOrders: (filters?: { patientId?: string; labId?: string; status?: ProthesisOrderStatus }) => Promise<ProthesisOrder[]>
  getProthesisOrderById: (id: string) => Promise<ProthesisOrder | null>
  saveProthesisOrder: (order: Omit<ProthesisOrder, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'> & { id?: string; orderNumber?: string }) => Promise<ProthesisOrder>
  updateProthesisOrderStatus: (id: string, status: ProthesisOrderStatus) => Promise<boolean>
  deleteProthesisOrder: (id: string) => Promise<boolean>

  // 2. Patient Systemic Medical History & Risk Badges
  getPatientMedicalHistory: (patientId: string) => Promise<MedicalAntecedentsRecord | null>
  savePatientMedicalHistory: (record: Omit<MedicalAntecedentsRecord, 'id' | 'updatedAt'> & { id?: string }) => Promise<MedicalAntecedentsRecord>

  // 3. Devis (Quotations) & Long-Term Treatment Plans
  getDevis: (patientId?: string) => Promise<Devis[]>
  getDevisById: (id: string) => Promise<Devis | null>
  saveDevis: (
    devis: Omit<Devis, 'id' | 'devisNumber' | 'createdAt' | 'updatedAt' | 'items'> & { id?: string; devisNumber?: string },
    items: Omit<DevisItem, 'id' | 'devisId'>[]
  ) => Promise<Devis>
  updateDevisStatus: (id: string, status: DevisStatus) => Promise<boolean>
  deleteDevis: (id: string) => Promise<boolean>
  convertDevisToTreatments: (devisId: string) => Promise<{ success: boolean; createdTreatmentsCount: number }>

  // 4. Multi-session Treatment Projects (ODF / Implant)
  getTreatmentProjects: (patientId?: string) => Promise<TreatmentProject[]>
  getTreatmentProjectById: (id: string) => Promise<TreatmentProject | null>
  saveTreatmentProject: (project: Omit<TreatmentProject, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<TreatmentProject>
  deleteTreatmentProject: (id: string) => Promise<boolean>

  // 5. Medical Lab Tests & Pre-op Bilans
  getLabTestOrders: (patientId?: string) => Promise<LabTestOrder[]>
  getLabTestOrderById: (id: string) => Promise<LabTestOrder | null>
  saveLabTestOrder: (order: Omit<LabTestOrder, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'> & { id?: string; orderNumber?: string }) => Promise<LabTestOrder>
  recordLabTestResults: (id: string, results: Record<string, string>, isCritical?: boolean, alertMessage?: string) => Promise<LabTestOrder>
  deleteLabTestOrder: (id: string) => Promise<boolean>

  // 6. Live Waiting Room
  getWaitingRoomEntries: (status?: WaitingRoomStatus) => Promise<WaitingRoomEntry[]>
  addToWaitingRoom: (entry: Omit<WaitingRoomEntry, 'id' | 'createdAt' | 'arrivalTime'> & { id?: string; arrivalTime?: string }) => Promise<WaitingRoomEntry>
  updateWaitingRoomStatus: (id: string, status: WaitingRoomStatus, calledTime?: string, departureTime?: string) => Promise<boolean>
  deleteWaitingRoomEntry: (id: string) => Promise<boolean>

  // 7. Advanced Analytics & Efficiency KPIs
  getClinicalOverviewStats: (startDate?: string, endDate?: string) => Promise<ClinicalOverviewStats>
  getPeakHoursDistribution: () => Promise<PeakHourCell[]>
  getChronicLatePatients: () => Promise<ChronicLatePatient[]>
  getSpecialtyDistribution: () => Promise<SpecialtyDistribution[]>

  // 8. Patient Radiographies & Medical Imaging (Prompt 8)
  getPatientRadios: (patientId: string) => Promise<PatientRadio[]>
  savePatientRadio: (radio: Omit<PatientRadio, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<PatientRadio>
  deletePatientRadio: (id: string, patientId?: string) => Promise<boolean>
}

// 8. Patient Radiographies Interfaces (Prompt 8)
export type RadioType = 'Panoramique' | 'Rétro-alvéolaire' | 'Scanner 3D' | 'Téléradiographie' | 'Bitewing'

export interface PatientRadio {
  id: string
  patientId: string
  radioType: RadioType
  toothNumber?: number | null
  date: string
  imageData: string
  fileName?: string | null
  fileSize?: number | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

// 7. Clinical & Organizational Analytics Interfaces
export interface ClinicalOverviewStats {
  noShowRate: number
  totalAppointments: number
  cancelledCount: number
  completedCount: number
  averageLeadTimeDays: number
  chronicLatePatientsCount: number
  totalRevenueDA: number
}

export interface PeakHourCell {
  dayIndex: number
  dayName: string
  hour: number
  count: number
  intensity: number
}

export interface ChronicLatePatient {
  patientId: string
  patientName: string
  patientPhone?: string | null
  patientNumber: string
  missedCount: number
  totalBookings: number
  lastMissedDate?: string | null
  requireConfirmation: boolean
}

export interface SpecialtyDistribution {
  specialty: string
  label: string
  treatmentCount: number
  revenueDA: number
  percentage: number
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
