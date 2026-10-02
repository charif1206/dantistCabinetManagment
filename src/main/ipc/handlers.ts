import { ipcMain, BrowserWindow } from 'electron'
import { PatientRepository } from '../database/repositories/patientRepo'
import { AppointmentRepository } from '../database/repositories/appointmentRepo'
import { ClinicalRepository } from '../database/repositories/clinicalRepo'
import { SyncQueueRepository } from '../database/repositories/syncQueueRepo'
import { UserRepository } from '../database/repositories/userRepo'
import { BillingRepository } from '../database/repositories/billingRepo'
import { MachineAuthService } from '../auth/machineAuth'
import { SyncEngine } from '../sync/syncEngine'
import { BackupService } from '../backup/backupService'
import { DrugsRepository } from '../database/repositories/drugsRepo'
import { ProthesisRepository } from '../database/repositories/prothesisRepo'
import { MedicalHistoryRepository } from '../database/repositories/medicalHistoryRepo'
import { DevisRepository } from '../database/repositories/devisRepo'
import { LabTestRepository } from '../database/repositories/labTestRepo'
import { WaitingRoomRepository } from '../database/repositories/waitingRoomRepo'
import { AdvancedStatsRepository } from '../database/repositories/advancedStatsRepo'
import { initDatabase } from '../database/db'
import { DashboardStats } from '@shared/types'

export function registerIpcHandlers(
  patientRepo: PatientRepository,
  appointmentRepo: AppointmentRepository,
  clinicalRepo: ClinicalRepository,
  syncQueueRepo: SyncQueueRepository,
  userRepo: UserRepository,
  billingRepo: BillingRepository,
  drugsRepo: DrugsRepository,
  authService: MachineAuthService,
  syncEngine: SyncEngine,
  backupService: BackupService
): void {
  const db = initDatabase()
  const prothesisRepo = new ProthesisRepository(db)
  const medicalHistoryRepo = new MedicalHistoryRepository(db)
  const devisRepo = new DevisRepository(db)
  const labTestRepo = new LabTestRepository(db)
  const waitingRoomRepo = new WaitingRoomRepository(db)
  const advancedStatsRepo = new AdvancedStatsRepository(db)
  // 1. Machine & Cloud Sync
  ipcMain.handle('machine:getState', () => {
    return authService.getState()
  })

  ipcMain.handle('sync:triggerManual', async () => {
    return await syncEngine.syncNow()
  })

  authService.on('state-changed', (state) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('sync:stateChanged', state)
      }
    }
  })

  // 2. Authentication & Users
  ipcMain.handle('auth:login', (_event, username: string, passwordHash: string) => {
    const user = userRepo.verifyCredentials(username, passwordHash)
    if (user) {
      return { success: true, user }
    }
    return { success: false, error: 'Identifiants invalides' }
  })

  ipcMain.handle('users:getAll', () => {
    return userRepo.getAll()
  })

  // 3. Patients
  ipcMain.handle('patients:getAll', (_event, search?: string) => {
    return patientRepo.getAll(search)
  })

  ipcMain.handle('patients:getById', (_event, id: string) => {
    return patientRepo.getById(id)
  })

  ipcMain.handle('patients:save', (_event, data) => {
    return patientRepo.save(data)
  })

  ipcMain.handle('patients:delete', (_event, id: string) => {
    return patientRepo.delete(id)
  })

  ipcMain.handle('patients:permanentDelete', (_event, id: string) => {
    return patientRepo.permanentDelete(id)
  })

  // 4. Appointments
  ipcMain.handle('appointments:getAll', (_event, startDate?: string, endDate?: string) => {
    return appointmentRepo.getAll(startDate, endDate)
  })

  ipcMain.handle('appointments:save', (_event, data) => {
    return appointmentRepo.save(data)
  })

  ipcMain.handle('appointments:updateStatus', (_event, id: string, status) => {
    return appointmentRepo.updateStatus(id, status)
  })

  ipcMain.handle('appointments:delete', (_event, id: string) => {
    return appointmentRepo.delete(id)
  })

  // 5. Clinical Records, Treatments, Notes & Prescriptions
  ipcMain.handle('clinical:getToothRecords', (_event, patientId: string) => {
    return clinicalRepo.getToothRecords(patientId)
  })

  ipcMain.handle('clinical:saveToolRecord', (_event, record) => {
    return clinicalRepo.saveToothRecord(record)
  })

  ipcMain.handle('clinical:getTreatments', (_event, patientId: string) => {
    return billingRepo.getTreatmentsByPatient(patientId)
  })

  ipcMain.handle('clinical:saveTreatment', (_event, treatment) => {
    return billingRepo.saveTreatment(treatment)
  })

  ipcMain.handle('clinical:getNotes', (_event, patientId: string) => {
    return clinicalRepo.getClinicalNotes(patientId)
  })

  ipcMain.handle('clinical:saveNote', (_event, note) => {
    return clinicalRepo.saveClinicalNote(note)
  })

  ipcMain.handle('prescriptions:getAll', (_event, patientId: string) => {
    return clinicalRepo.getPrescriptions(patientId)
  })

  ipcMain.handle('prescriptions:save', (_event, prescription) => {
    return clinicalRepo.savePrescription(prescription)
  })

  ipcMain.handle('prescriptions:delete', (_event, id: string) => {
    return clinicalRepo.deletePrescription(id)
  })

  // 5b. Drugs Catalog & Prescription Templates (Prompt 4)
  ipcMain.handle('drugs:getAll', (_event, search?: string, category?: string) => {
    return drugsRepo.getAll(search, category)
  })

  ipcMain.handle('drugs:save', (_event, drug) => {
    return drugsRepo.save(drug)
  })

  ipcMain.handle('drugs:delete', (_event, id: string) => {
    return drugsRepo.delete(id)
  })

  ipcMain.handle('prescriptionTemplates:getAll', (_event, search?: string) => {
    return drugsRepo.getTemplates(search)
  })

  ipcMain.handle('prescriptionTemplates:save', (_event, template) => {
    return drugsRepo.saveTemplate(template)
  })

  ipcMain.handle('prescriptionTemplates:delete', (_event, id: string) => {
    return drugsRepo.deleteTemplate(id)
  })

  // 6. Medical Acts (Catalogue)
  ipcMain.handle('acts:getAll', (_event, category?: string, search?: string) => {
    return clinicalRepo.getMedicalActs(category, search)
  })

  ipcMain.handle('acts:save', (_event, act) => {
    return billingRepo.saveAct(act)
  })

  // 7. Invoices & Payments
  ipcMain.handle('invoices:getAll', (_event, patientId?: string) => {
    return billingRepo.getInvoices(patientId)
  })

  ipcMain.handle('invoices:save', (_event, invoice) => {
    const result = billingRepo.saveInvoice(invoice)
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('dashboard:statsUpdated')
      }
    })
    return result
  })

  ipcMain.handle('payments:record', (_event, payment) => {
    const result = billingRepo.recordPayment(payment)
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('dashboard:statsUpdated')
      }
    })
    return result
  })

  // 8. Dashboard KPIs (with Algerian Dinars)
  ipcMain.handle('dashboard:getStats', (): DashboardStats => {
    const aptStats = appointmentRepo.getTodayStats()
    const totalPatients = patientRepo.getCount()
    const finStats = billingRepo.getFinancialStats()
    const pendingSync = syncQueueRepo.getPendingCount()

    return {
      todayAppointmentsCount: aptStats.todayCount,
      waitingPatientsCount: aptStats.waitingCount,
      completedTreatmentsCount: aptStats.completedCount,
      totalPatientsCount: totalPatients,
      todayRevenueDA: finStats.todayRevenueDA,
      totalDebtsDA: finStats.totalDebtsDA,
      debtorPatientsCount: finStats.debtorPatientsCount,
      pendingSyncCount: pendingSync
    }
  })

  // 9. Local Backup & Database Integrity Checks
  ipcMain.handle('backup:create', async (_event, targetDir?: string) => {
    return await backupService.createBackup(targetDir)
  })

  ipcMain.handle('backup:verify', () => {
    return backupService.verifyIntegrity()
  })

  // 10. Native Printing & High-Resolution PDF Export
  ipcMain.handle('app:print', async (_event, options) => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    if (!win) return false
    return new Promise<boolean>((resolve) => {
      win.webContents.print(
        {
          silent: options?.silent ?? false,
          printBackground: options?.printBackground ?? true,
          deviceName: options?.deviceName || ''
        },
        (success, failureReason) => {
          if (!success && failureReason !== 'cancelled') {
            console.warn('Native print:', failureReason)
          }
          resolve(success)
        }
      )
    })
  })

  ipcMain.handle('app:exportToPDF', async (_event, options) => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    if (!win) return { success: false, error: 'Fenêtre introuvable' }
    try {
      const { dialog } = await import('electron')
      const fs = await import('fs/promises')
      const safeTitle = (options?.title || 'Document_Medical').replace(/[\\/:*?"<>|]/g, '_')
      const defaultFilename = `${safeTitle}_${new Date().toISOString().slice(0, 10)}.pdf`
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: 'Exporter le Document en PDF',
        defaultPath: defaultFilename,
        filters: [{ name: 'Document PDF (*.pdf)', extensions: ['pdf'] }]
      })
      if (canceled || !filePath) return { success: false, error: 'Opération annulée' }

      const pdfData = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: options?.pageSize || 'A4',
        landscape: false
      })
      await fs.writeFile(filePath, pdfData)
      return { success: true, filePath }
    } catch (err: any) {
      console.error('Error generating PDF:', err)
      return { success: false, error: err?.message || 'Erreur lors de la génération du PDF' }
    }
  })

  // 11. Prosthetic Laboratories & Orders
  ipcMain.handle('labs:getAll', () => {
    return prothesisRepo.getLabs()
  })

  ipcMain.handle('labs:save', (_event, lab) => {
    return prothesisRepo.saveLab(lab)
  })

  ipcMain.handle('labs:delete', (_event, id: string) => {
    return prothesisRepo.deleteLab(id)
  })

  ipcMain.handle('prothesis:getAll', (_event, filters) => {
    return prothesisRepo.getOrders(filters)
  })

  ipcMain.handle('prothesis:getById', (_event, id: string) => {
    return prothesisRepo.getOrderById(id)
  })

  ipcMain.handle('prothesis:save', (_event, order) => {
    return prothesisRepo.saveOrder(order)
  })

  ipcMain.handle('prothesis:updateStatus', (_event, id: string, status) => {
    return prothesisRepo.updateOrderStatus(id, status)
  })

  ipcMain.handle('prothesis:delete', (_event, id: string) => {
    return prothesisRepo.deleteOrder(id)
  })

  // 12. Patient Systemic Medical History & Risk Badges
  ipcMain.handle('medicalHistory:getByPatientId', (_event, patientId: string) => {
    return medicalHistoryRepo.getByPatientId(patientId)
  })

  ipcMain.handle('medicalHistory:save', (_event, record) => {
    return medicalHistoryRepo.save(record)
  })

  // 13. Devis (Quotations) & Treatment Plans
  ipcMain.handle('devis:getAll', (_event, patientId?: string) => {
    return devisRepo.getAll(patientId)
  })

  ipcMain.handle('devis:getById', (_event, id: string) => {
    return devisRepo.getById(id)
  })

  ipcMain.handle('devis:save', (_event, devis, items) => {
    return devisRepo.save(devis, items)
  })

  ipcMain.handle('devis:updateStatus', (_event, id: string, status) => {
    return devisRepo.updateStatus(id, status)
  })

  ipcMain.handle('devis:delete', (_event, id: string) => {
    return devisRepo.delete(id)
  })

  ipcMain.handle('devis:convertToTreatments', (_event, devisId: string) => {
    return devisRepo.convertToTreatments(devisId)
  })

  // 14. Treatment Projects (ODF / Implant Multi-session Roadmaps)
  ipcMain.handle('treatmentProjects:getAll', (_event, patientId?: string) => {
    return devisRepo.getProjects(patientId)
  })

  ipcMain.handle('treatmentProjects:getById', (_event, id: string) => {
    return devisRepo.getProjectById(id)
  })

  ipcMain.handle('treatmentProjects:save', (_event, project) => {
    return devisRepo.saveProject(project)
  })

  ipcMain.handle('treatmentProjects:delete', (_event, id: string) => {
    return devisRepo.deleteProject(id)
  })

  // 15. Medical Lab Tests & Pre-op Bilans
  ipcMain.handle('labTests:getAll', (_event, patientId?: string) => {
    return labTestRepo.getAll(patientId)
  })

  ipcMain.handle('labTests:getById', (_event, id: string) => {
    return labTestRepo.getById(id)
  })

  ipcMain.handle('labTests:save', (_event, order) => {
    return labTestRepo.save(order)
  })

  ipcMain.handle('labTests:recordResults', (_event, id: string, results, isCritical, alertMessage) => {
    return labTestRepo.recordResults(id, results, isCritical, alertMessage)
  })

  ipcMain.handle('labTests:delete', (_event, id: string) => {
    return labTestRepo.delete(id)
  })

  // 16. Live Waiting Room Queue
  ipcMain.handle('waitingRoom:getAll', (_event, status) => {
    return waitingRoomRepo.getAll(status)
  })

  ipcMain.handle('waitingRoom:add', (_event, entry) => {
    return waitingRoomRepo.add(entry)
  })

  ipcMain.handle('waitingRoom:updateStatus', (_event, id: string, status, calledTime, departureTime) => {
    return waitingRoomRepo.updateStatus(id, status, calledTime, departureTime)
  })

  ipcMain.handle('waitingRoom:delete', (_event, id: string) => {
    return waitingRoomRepo.delete(id)
  })

  // 17. Advanced Clinical & Organizational Analytics
  ipcMain.handle('analytics:getOverview', (_event, startDate?: string, endDate?: string) => {
    return advancedStatsRepo.getOverview(startDate, endDate)
  })

  ipcMain.handle('analytics:getPeakHours', () => {
    return advancedStatsRepo.getPeakHoursDistribution()
  })

  ipcMain.handle('analytics:getChronicLate', () => {
    return advancedStatsRepo.getChronicLatePatients()
  })

  ipcMain.handle('analytics:getSpecialtyDistribution', () => {
    return advancedStatsRepo.getSpecialtyDistribution()
  })

  // 18. Patient Radiographies & Medical Imaging (Prompt 8)
  ipcMain.handle('radios:getAll', (_event, patientId: string) => {
    return patientRepo.getRadios(patientId)
  })

  ipcMain.handle('radios:save', (_event, radio) => {
    return patientRepo.saveRadio(radio)
  })

  ipcMain.handle('radios:delete', (_event, id: string) => {
    return patientRepo.deleteRadio(id)
  })
}

