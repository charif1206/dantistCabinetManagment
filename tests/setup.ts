import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import type { ElectronAPI } from '@shared/types'

// Polyfills for browser environment in JSDOM
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })

  class MockResizeObserver {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  }

  window.ResizeObserver = MockResizeObserver as any
}

// Mock Electron native module when running in Vitest
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue(process.cwd()),
    isPackaged: false
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn()
  },
  contextBridge: {
    exposeInMainWorld: vi.fn()
  }
}))

// Comprehensive mock for window.api conforming to ElectronAPI
export const mockElectronApi: ElectronAPI = {
  // Machine & Cloud Sync
  getMachineState: vi.fn().mockResolvedValue({
    isConfigured: true,
    machineId: 'TEST-MAC-01',
    clinicName: 'Clinique Dentaire El-Amel',
    isOnline: true,
    isSyncing: false,
    lastSyncTime: new Date().toISOString(),
    pendingCount: 0
  }),
  triggerManualSync: vi.fn().mockResolvedValue(true),
  onSyncStateChanged: vi.fn().mockReturnValue(() => {}),

  // Users & Auth
  login: vi.fn().mockResolvedValue({
    success: true,
    user: {
      id: 'usr-admin',
      username: 'dr_amrani',
      fullName: 'Dr. Amrani',
      role: 'DENTIST',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  }),
  getUsers: vi.fn().mockResolvedValue([]),

  // Patients
  getPatients: vi.fn().mockResolvedValue([]),
  getPatientById: vi.fn().mockResolvedValue(null),
  savePatient: vi.fn().mockImplementation((patient) =>
    Promise.resolve({
      id: patient.id || 'patient-test-id',
      patientNumber: patient.patientNumber || 'DZ-2026-0001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'synced',
      ...patient
    })
  ),
  deletePatient: vi.fn().mockResolvedValue(true),

  // Appointments
  getAppointments: vi.fn().mockResolvedValue([]),
  saveAppointment: vi.fn().mockImplementation((appointment) =>
    Promise.resolve({
      id: appointment.id || 'appointment-test-id',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'synced',
      ...appointment
    })
  ),
  updateAppointmentStatus: vi.fn().mockResolvedValue(true),
  deleteAppointment: vi.fn().mockResolvedValue(true),

  // Dental Chart & Treatments
  getToothRecords: vi.fn().mockResolvedValue([]),
  saveToothRecord: vi.fn().mockImplementation((record) =>
    Promise.resolve({
      id: 'tooth-test-id',
      updatedAt: new Date().toISOString(),
      syncStatus: 'synced',
      ...record
    })
  ),
  getTreatments: vi.fn().mockResolvedValue([]),
  saveTreatment: vi.fn().mockImplementation((treatment) =>
    Promise.resolve({
      id: treatment.id || 'treatment-test-id',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'synced',
      ...treatment
    })
  ),

  // Clinical Notes & Prescriptions
  getClinicalNotes: vi.fn().mockResolvedValue([]),
  saveClinicalNote: vi.fn().mockImplementation((note) =>
    Promise.resolve({
      id: 'note-test-id',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...note
    })
  ),
  getPrescriptions: vi.fn().mockResolvedValue([]),
  savePrescription: vi.fn().mockImplementation((prescription) =>
    Promise.resolve({
      id: prescription.id || 'prescription-test-id',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...prescription
    })
  ),

  // Drugs Catalog & Prescription Templates (Presets)
  getDrugsCatalog: vi.fn().mockResolvedValue([]),
  saveDrug: vi.fn().mockImplementation((drug) =>
    Promise.resolve({
      id: drug.id || 'drug-test-id',
      createdAt: new Date().toISOString(),
      ...drug
    })
  ),
  deleteDrug: vi.fn().mockResolvedValue(true),
  getPrescriptionTemplates: vi.fn().mockResolvedValue([]),
  savePrescriptionTemplate: vi.fn().mockImplementation((template) =>
    Promise.resolve({
      id: template.id || 'tmpl-test-id',
      createdAt: new Date().toISOString(),
      ...template
    })
  ),
  deletePrescriptionTemplate: vi.fn().mockResolvedValue(true),

  // Medical Acts (Catalogue)
  getMedicalActs: vi.fn().mockResolvedValue([]),
  saveMedicalAct: vi.fn().mockImplementation((act) =>
    Promise.resolve({
      id: act.id || 'act-test-id',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...act
    })
  ),

  // Payments & Invoices (Billing)
  getInvoices: vi.fn().mockResolvedValue([]),
  saveInvoice: vi.fn().mockImplementation((invoice) =>
    Promise.resolve({
      id: invoice.id || 'invoice-test-id',
      invoiceNumber: invoice.invoiceNumber || 'INV-2026-0001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      remainingAmount: invoice.remainingAmount ?? 0,
      status: invoice.status || 'PENDING',
      ...invoice
    })
  ),
  recordPayment: vi.fn().mockImplementation((payment) =>
    Promise.resolve({
      id: 'pay-test-id',
      createdAt: new Date().toISOString(),
      ...payment
    })
  ),

  // Dashboard Stats
  getDashboardStats: vi.fn().mockResolvedValue({
    totalPatients: 150,
    appointmentsToday: 8,
    waitingRoomCount: 2,
    monthlyRevenue: 450000,
    activeTreatments: 12
  }),

  // Local Backup & Integrity
  createBackup: vi.fn().mockResolvedValue({
    success: true,
    backupPath: 'C:\\data\\backups\\test.db',
    sizeBytes: 2048
  }),
  verifyDatabase: vi.fn().mockResolvedValue({
    ok: true,
    message: 'Database integrity verified'
  }),

  // Native Printing & PDF Export
  printDocument: vi.fn().mockResolvedValue(true),
  exportToPDF: vi.fn().mockResolvedValue({
    success: true,
    filePath: 'C:\\data\\exports\\test.pdf'
  }),

  // 1. Prosthetic Laboratories & Orders
  getProstheticLabs: vi.fn().mockResolvedValue([]),
  saveProstheticLab: vi.fn().mockImplementation((lab) =>
    Promise.resolve({
      id: lab.id || 'lab-test-id',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...lab
    })
  ),
  deleteProstheticLab: vi.fn().mockResolvedValue(true),
  getProthesisOrders: vi.fn().mockResolvedValue([]),
  getProthesisOrderById: vi.fn().mockResolvedValue(null),
  saveProthesisOrder: vi.fn().mockImplementation((order) =>
    Promise.resolve({
      id: order.id || 'prothesis-test-id',
      orderNumber: order.orderNumber || 'LAB-2026-0001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...order
    })
  ),
  updateProthesisOrderStatus: vi.fn().mockResolvedValue(true),
  deleteProthesisOrder: vi.fn().mockResolvedValue(true),

  // 2. Patient Systemic Medical History & Risk Badges
  getPatientMedicalHistory: vi.fn().mockResolvedValue(null),
  savePatientMedicalHistory: vi.fn().mockImplementation((record) =>
    Promise.resolve({
      id: record.id || 'med-history-test-id',
      updatedAt: new Date().toISOString(),
      ...record
    })
  ),

  // 3. Devis (Quotations) & Long-Term Treatment Plans
  getDevis: vi.fn().mockResolvedValue([]),
  getDevisById: vi.fn().mockResolvedValue(null),
  saveDevis: vi.fn().mockImplementation((devis, items) =>
    Promise.resolve({
      id: devis.id || 'devis-test-id',
      devisNumber: devis.devisNumber || 'DEV-2026-0001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: items.map((item, idx) => ({
        ...item,
        id: `item-${idx + 1}`,
        devisId: devis.id || 'devis-test-id'
      })),
      ...devis
    })
  ),
  updateDevisStatus: vi.fn().mockResolvedValue(true),
  deleteDevis: vi.fn().mockResolvedValue(true),
  convertDevisToTreatments: vi.fn().mockResolvedValue({
    success: true,
    createdTreatmentsCount: 2
  }),

  // 4. Multi-session Treatment Projects (ODF / Implant)
  getTreatmentProjects: vi.fn().mockResolvedValue([]),
  getTreatmentProjectById: vi.fn().mockResolvedValue(null),
  saveTreatmentProject: vi.fn().mockImplementation((project) =>
    Promise.resolve({
      id: project.id || 'proj-test-id',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...project
    })
  ),
  deleteTreatmentProject: vi.fn().mockResolvedValue(true),

  // 5. Medical Lab Tests & Pre-op Bilans
  getLabTestOrders: vi.fn().mockResolvedValue([]),
  getLabTestOrderById: vi.fn().mockResolvedValue(null),
  saveLabTestOrder: vi.fn().mockImplementation((order) =>
    Promise.resolve({
      id: order.id || 'labtest-test-id',
      orderNumber: order.orderNumber || 'BIL-2026-0001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...order
    })
  ),
  recordLabTestResults: vi.fn().mockImplementation((id, results) =>
    Promise.resolve({
      id,
      orderNumber: 'BIL-2026-0001',
      patientId: 'patient-test-id',
      dentistName: 'Dr. Amrani',
      requestDate: '2026-09-24',
      testsRequested: ['Glycémie'],
      results,
      isCriticalAlert: false,
      status: 'RECEIVED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  ),
  deleteLabTestOrder: vi.fn().mockResolvedValue(true),

  // 6. Live Waiting Room
  getWaitingRoomEntries: vi.fn().mockResolvedValue([]),
  addToWaitingRoom: vi.fn().mockImplementation((entry) =>
    Promise.resolve({
      id: entry.id || 'wr-entry-test-id',
      createdAt: new Date().toISOString(),
      arrivalTime: entry.arrivalTime || new Date().toISOString(),
      ...entry
    })
  ),
  updateWaitingRoomStatus: vi.fn().mockResolvedValue(true),
  deleteWaitingRoomEntry: vi.fn().mockResolvedValue(true),

  // 7. Advanced Analytics & Efficiency KPIs
  getClinicalOverviewStats: vi.fn().mockResolvedValue({
    noShowRate: 5.2,
    totalAppointments: 120,
    cancelledCount: 6,
    completedCount: 110,
    averageLeadTimeDays: 2.4,
    chronicLatePatientsCount: 3,
    totalRevenueDA: 580000
  }),
  getPeakHoursDistribution: vi.fn().mockResolvedValue([]),
  getChronicLatePatients: vi.fn().mockResolvedValue([]),
  getSpecialtyDistribution: vi.fn().mockResolvedValue([])
}

// Inject into window global
if (typeof window !== 'undefined') {
  window.api = mockElectronApi
}

// Auto cleanup after each test
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
