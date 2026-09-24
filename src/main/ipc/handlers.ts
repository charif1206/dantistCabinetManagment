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
  ipcMain.handle('acts:getAll', () => {
    return billingRepo.getAllActs()
  })

  ipcMain.handle('acts:save', (_event, act) => {
    return billingRepo.saveAct(act)
  })

  // 7. Invoices & Payments
  ipcMain.handle('invoices:getAll', (_event, patientId?: string) => {
    return billingRepo.getInvoices(patientId)
  })

  ipcMain.handle('invoices:save', (_event, invoice) => {
    return billingRepo.saveInvoice(invoice)
  })

  ipcMain.handle('payments:record', (_event, payment) => {
    return billingRepo.recordPayment(payment)
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
}
