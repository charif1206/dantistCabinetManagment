import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { initDatabase } from './database/db'
import { PatientRepository } from './database/repositories/patientRepo'
import { AppointmentRepository } from './database/repositories/appointmentRepo'
import { ClinicalRepository } from './database/repositories/clinicalRepo'
import { SyncQueueRepository } from './database/repositories/syncQueueRepo'
import { UserRepository } from './database/repositories/userRepo'
import { BillingRepository } from './database/repositories/billingRepo'
import { DrugsRepository } from './database/repositories/drugsRepo'
import { MachineAuthService } from './auth/machineAuth'
import { SyncEngine } from './sync/syncEngine'
import { BackupService } from './backup/backupService'
import { registerIpcHandlers } from './ipc/handlers'

// Suppress Chromium disk cache collisions on Windows dev reloads
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
app.commandLine.appendSwitch('disable-http-cache')

let mainWindow: BrowserWindow | null = null

// Enforce single instance lock to avoid concurrent process cache locking (0x5 Access is denied)
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  function createWindow(): void {
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1024,
      minHeight: 700,
      show: false,
      autoHideMenuBar: true,
      title: 'DentaFlow Algeria - Gestion de Cabinet Dentaire',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    mainWindow.on('ready-to-show', () => {
      if (mainWindow) {
        mainWindow.show()
      }
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
  }

  app.whenReady().then(async () => {
    console.log('=================================================================')
    console.log('🇩🇿 DentaFlow Algeria - Démarrage du Système de Cabinet Dentaire')
    console.log('=================================================================')

  // 1. Initialize SQLite Database & Repositories
  const db = initDatabase()
  const syncQueueRepo = new SyncQueueRepository(db)
  const patientRepo = new PatientRepository(db)
  const appointmentRepo = new AppointmentRepository(db)
  const clinicalRepo = new ClinicalRepository(db)
  const userRepo = new UserRepository(db)
  const billingRepo = new BillingRepository(db)
  const drugsRepo = new DrugsRepository(db)
  const backupService = new BackupService(db)

  // 2. Zero-UI Silent Machine Account Background Authentication
  const machineAuthService = new MachineAuthService()
  await machineAuthService.authenticateMachine()

  // 3. Start Background Sync Engine Daemon
  const syncEngine = new SyncEngine(syncQueueRepo, machineAuthService)
  syncEngine.start(5000)

  // 4. Register All IPC Handlers
  registerIpcHandlers(
    patientRepo,
    appointmentRepo,
    clinicalRepo,
    syncQueueRepo,
    userRepo,
    billingRepo,
    drugsRepo,
    machineAuthService,
    syncEngine,
    backupService
  )

  // 5. Open GUI Window
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
}
