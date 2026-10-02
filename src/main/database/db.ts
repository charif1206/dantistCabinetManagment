import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import crypto from 'crypto'
import { Patient, Appointment, ToothRecord, ClinicalNote, User, MedicalAct, Treatment, Invoice, Payment, DashboardStats } from '@shared/types'

let dbInstance: Database.Database | null = null

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(`dentaflow_salt_${password}`).digest('hex')
}

export function getDatabasePath(): string {
  let baseDir = process.cwd()
  try {
    if (typeof app !== 'undefined' && app?.isPackaged) {
      baseDir = app.getPath('userData')
    }
  } catch {
    baseDir = process.cwd()
  }

  const dbDir = join(baseDir, 'data')
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }
  return join(dbDir, 'dentaflow.db')
}

export function initDatabase(): Database.Database {
  if (dbInstance) return dbInstance

  const dbPath = getDatabasePath()
  console.log(`[Database] Initializing SQLite database at: ${dbPath}`)

  dbInstance = new Database(dbPath)
  dbInstance.pragma('journal_mode = WAL')
  dbInstance.pragma('foreign_keys = ON')

  // Run schema migration
  executeMigrations(dbInstance)
  seedInitialDataIfEmpty(dbInstance)

  return dbInstance
}

export function migrateExistingTables(db: Database.Database): void {
  try {
    const tableExists = (table: string): boolean => {
      const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)
      return !!row
    }

    if (tableExists('patients')) {
      const cols = (db.pragma('table_info(patients)') as { name: string }[]).map((c) => c.name)
      if (!cols.includes('patientNumber')) {
        db.exec('ALTER TABLE patients ADD COLUMN patientNumber TEXT;')
        db.exec("UPDATE patients SET patientNumber = 'DZ-2026-' || substr('0000' || rowid, -4) WHERE patientNumber IS NULL;")
      }
      if (!cols.includes('cin')) {
        db.exec('ALTER TABLE patients ADD COLUMN cin TEXT;')
      }
      if (!cols.includes('wilaya')) {
        db.exec("ALTER TABLE patients ADD COLUMN wilaya TEXT DEFAULT 'Alger';")
      }
      if (!cols.includes('medicalAlerts')) {
        db.exec('ALTER TABLE patients ADD COLUMN medicalAlerts TEXT;')
      }
      if (!cols.includes('bloodGroup')) {
        db.exec("ALTER TABLE patients ADD COLUMN bloodGroup TEXT DEFAULT 'A+';")
      }
      if (!cols.includes('notes')) {
        db.exec('ALTER TABLE patients ADD COLUMN notes TEXT;')
      }
      if (!cols.includes('syncStatus')) {
        db.exec("ALTER TABLE patients ADD COLUMN syncStatus TEXT DEFAULT 'pending';")
      }
    }

    if (tableExists('appointments')) {
      const cols = (db.pragma('table_info(appointments)') as { name: string }[]).map((c) => c.name)
      if (!cols.includes('patientPhone')) {
        db.exec('ALTER TABLE appointments ADD COLUMN patientPhone TEXT;')
      }
      if (!cols.includes('dentistName')) {
        db.exec("ALTER TABLE appointments ADD COLUMN dentistName TEXT DEFAULT 'Dr. Amrani';")
      }
      if (!cols.includes('colorTag')) {
        db.exec('ALTER TABLE appointments ADD COLUMN colorTag TEXT;')
      }
      if (!cols.includes('syncStatus')) {
        db.exec("ALTER TABLE appointments ADD COLUMN syncStatus TEXT DEFAULT 'pending';")
      }
    }

    if (tableExists('treatments')) {
      const cols = (db.pragma('table_info(treatments)') as { name: string }[]).map((c) => c.name)
      if (!cols.includes('dentistName')) {
        db.exec("ALTER TABLE treatments ADD COLUMN dentistName TEXT DEFAULT 'Dr. Amrani';")
      }
      if (!cols.includes('syncStatus')) {
        db.exec("ALTER TABLE treatments ADD COLUMN syncStatus TEXT DEFAULT 'pending';")
      }
    }

    if (tableExists('payments')) {
      const cols = (db.pragma('table_info(payments)') as { name: string }[]).map((c) => c.name)
      if (!cols.includes('receiptNumber')) {
        db.exec('ALTER TABLE payments ADD COLUMN receiptNumber TEXT;')
      }
    }

    // 12. Drugs Catalog (Prompt 4)
    if (!tableExists('drugs_catalog')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS drugs_catalog (
          id TEXT PRIMARY KEY,
          brandName TEXT NOT NULL,
          genericName TEXT,
          dosage TEXT,
          form TEXT,
          defaultInstructions TEXT,
          category TEXT,
          isCustom INTEGER DEFAULT 0,
          createdAt TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_drugs_brand ON drugs_catalog(brandName);
        CREATE INDEX IF NOT EXISTS idx_drugs_category ON drugs_catalog(category);
      `)
    }

    // 13. Prescription Templates (Prompt 4)
    if (!tableExists('prescription_templates')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS prescription_templates (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          diagnosisHint TEXT,
          itemsJson TEXT NOT NULL,
          createdAt TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_prescription_templates_title ON prescription_templates(title);
      `)
    }

    // 14. Prosthetic Laboratories
    if (!tableExists('prosthetic_laboratories')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS prosthetic_laboratories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          phone TEXT NOT NULL,
          wilaya TEXT DEFAULT 'Alger',
          address TEXT,
          contactPerson TEXT,
          active INTEGER NOT NULL DEFAULT 1,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          deletedAt TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_prosthetic_labs_active ON prosthetic_laboratories(active);
      `)
    } else {
      const cols = (db.pragma('table_info(prosthetic_laboratories)') as { name: string }[]).map((c) => c.name)
      if (!cols.includes('wilaya')) db.exec("ALTER TABLE prosthetic_laboratories ADD COLUMN wilaya TEXT DEFAULT 'Alger';")
      if (!cols.includes('address')) db.exec('ALTER TABLE prosthetic_laboratories ADD COLUMN address TEXT;')
      if (!cols.includes('contactPerson')) db.exec('ALTER TABLE prosthetic_laboratories ADD COLUMN contactPerson TEXT;')
      if (!cols.includes('active')) db.exec('ALTER TABLE prosthetic_laboratories ADD COLUMN active INTEGER NOT NULL DEFAULT 1;')
      if (!cols.includes('deletedAt')) db.exec('ALTER TABLE prosthetic_laboratories ADD COLUMN deletedAt TEXT;')
    }

    // 15. Prothesis Orders
    if (!tableExists('prothesis_orders')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS prothesis_orders (
          id TEXT PRIMARY KEY,
          orderNumber TEXT NOT NULL UNIQUE,
          patientId TEXT NOT NULL,
          patientName TEXT NOT NULL,
          dentistName TEXT NOT NULL,
          labId TEXT NOT NULL,
          labName TEXT NOT NULL,
          actName TEXT NOT NULL,
          toothNumber INTEGER,
          shade TEXT NOT NULL,
          nature TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PREPARATION',
          sentDate TEXT,
          expectedDate TEXT,
          receivedDate TEXT,
          deliveryDate TEXT,
          labCostDA REAL NOT NULL DEFAULT 0.0,
          clinicPriceDA REAL NOT NULL DEFAULT 0.0,
          notes TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          deletedAt TEXT,
          FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE RESTRICT,
          FOREIGN KEY (labId) REFERENCES prosthetic_laboratories(id) ON DELETE RESTRICT
        );
        CREATE INDEX IF NOT EXISTS idx_prothesis_status ON prothesis_orders(status);
        CREATE INDEX IF NOT EXISTS idx_prothesis_patient ON prothesis_orders(patientId);
        CREATE INDEX IF NOT EXISTS idx_prothesis_lab ON prothesis_orders(labId);
      `)
    } else {
      const cols = (db.pragma('table_info(prothesis_orders)') as { name: string }[]).map((c) => c.name)
      if (!cols.includes('toothNumber')) db.exec('ALTER TABLE prothesis_orders ADD COLUMN toothNumber INTEGER;')
      if (!cols.includes('teeth')) db.exec('ALTER TABLE prothesis_orders ADD COLUMN teeth TEXT;')
      if (!cols.includes('shade')) db.exec("ALTER TABLE prothesis_orders ADD COLUMN shade TEXT DEFAULT 'A2';")
      if (!cols.includes('nature')) db.exec("ALTER TABLE prothesis_orders ADD COLUMN nature TEXT DEFAULT 'ZIRCONE';")
      if (!cols.includes('labCostDA')) db.exec('ALTER TABLE prothesis_orders ADD COLUMN labCostDA REAL NOT NULL DEFAULT 0.0;')
      if (!cols.includes('clinicPriceDA')) db.exec('ALTER TABLE prothesis_orders ADD COLUMN clinicPriceDA REAL NOT NULL DEFAULT 0.0;')
      if (!cols.includes('deletedAt')) db.exec('ALTER TABLE prothesis_orders ADD COLUMN deletedAt TEXT;')
    }

    // 16. Patient Systemic Medical History
    if (!tableExists('patient_medical_history')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS patient_medical_history (
          id TEXT PRIMARY KEY,
          patientId TEXT NOT NULL UNIQUE,
          cardioChecklist TEXT NOT NULL DEFAULT '[]',
          hematologyChecklist TEXT NOT NULL DEFAULT '[]',
          gastroChecklist TEXT NOT NULL DEFAULT '[]',
          respiratoryChecklist TEXT NOT NULL DEFAULT '[]',
          endocrineChecklist TEXT NOT NULL DEFAULT '[]',
          allergiesChecklist TEXT NOT NULL DEFAULT '[]',
          isPregnantOrNursing INTEGER DEFAULT 0,
          pregnancyMonth INTEGER,
          generalRiskLevel TEXT NOT NULL DEFAULT 'LOW',
          doctorNotes TEXT,
          updatedAt TEXT NOT NULL,
          FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_medical_history_patient ON patient_medical_history(patientId);
      `)
    }

    // 17. Devis
    if (!tableExists('devis')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS devis (
          id TEXT PRIMARY KEY,
          devisNumber TEXT NOT NULL UNIQUE,
          patientId TEXT NOT NULL,
          patientName TEXT NOT NULL,
          dentistName TEXT NOT NULL,
          date TEXT NOT NULL,
          validityDays INTEGER NOT NULL DEFAULT 30,
          totalGrossDA REAL NOT NULL DEFAULT 0.0,
          discountDA REAL NOT NULL DEFAULT 0.0,
          totalNetDA REAL NOT NULL DEFAULT 0.0,
          status TEXT NOT NULL DEFAULT 'DRAFT',
          notes TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          deletedAt TEXT,
          FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE RESTRICT
        );
        CREATE INDEX IF NOT EXISTS idx_devis_patient ON devis(patientId);
        CREATE INDEX IF NOT EXISTS idx_devis_status ON devis(status);
      `)
    }

    // 18. Devis Items
    if (!tableExists('devis_items')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS devis_items (
          id TEXT PRIMARY KEY,
          devisId TEXT NOT NULL,
          actId TEXT,
          actName TEXT NOT NULL,
          specialty TEXT NOT NULL,
          toothNumber INTEGER,
          quantity INTEGER NOT NULL DEFAULT 1,
          unitPriceDA REAL NOT NULL DEFAULT 0.0,
          totalPriceDA REAL NOT NULL DEFAULT 0.0,
          FOREIGN KEY (devisId) REFERENCES devis(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_devis_items_devis ON devis_items(devisId);
      `)
    }

    // 19. Treatment Projects
    if (!tableExists('treatment_projects')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS treatment_projects (
          id TEXT PRIMARY KEY,
          patientId TEXT NOT NULL,
          title TEXT NOT NULL,
          specialty TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PLANNED',
          totalPhases INTEGER NOT NULL DEFAULT 1,
          completedPhases INTEGER NOT NULL DEFAULT 0,
          estimatedTotalDA REAL NOT NULL DEFAULT 0.0,
          startDate TEXT,
          targetEndDate TEXT,
          roadmapJson TEXT NOT NULL DEFAULT '[]',
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_treatment_projects_patient ON treatment_projects(patientId);
      `)
    }

    // 20. Lab Test Orders
    if (!tableExists('lab_test_orders')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS lab_test_orders (
          id TEXT PRIMARY KEY,
          orderNumber TEXT NOT NULL UNIQUE,
          patientId TEXT NOT NULL,
          dentistName TEXT NOT NULL,
          requestDate TEXT NOT NULL,
          reason TEXT,
          testsRequestedJson TEXT NOT NULL DEFAULT '[]',
          resultsJson TEXT NOT NULL DEFAULT '{}',
          isCriticalAlert INTEGER DEFAULT 0,
          criticalAlertMessage TEXT,
          status TEXT NOT NULL DEFAULT 'PENDING',
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE RESTRICT
        );
        CREATE INDEX IF NOT EXISTS idx_lab_test_orders_patient ON lab_test_orders(patientId);
        CREATE INDEX IF NOT EXISTS idx_lab_test_orders_status ON lab_test_orders(status);
      `)
    }

    // 21. Waiting Room Entries
    if (!tableExists('waiting_room_entries')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS waiting_room_entries (
          id TEXT PRIMARY KEY,
          patientId TEXT NOT NULL,
          patientName TEXT NOT NULL,
          patientPhone TEXT,
          appointmentId TEXT,
          arrivalTime TEXT NOT NULL,
          calledTime TEXT,
          departureTime TEXT,
          status TEXT NOT NULL DEFAULT 'WAITING',
          isUrgent INTEGER NOT NULL DEFAULT 0,
          priorityNote TEXT,
          assignedDentist TEXT,
          createdAt TEXT NOT NULL,
          FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_waiting_status ON waiting_room_entries(status, arrivalTime);
        CREATE INDEX IF NOT EXISTS idx_waiting_patient ON waiting_room_entries(patientId);
      `)
    }

    // 22. Patient Radiographies & Imaging (Prompt 8)
    if (!tableExists('patient_radios')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS patient_radios (
          id TEXT PRIMARY KEY,
          patientId TEXT NOT NULL,
          radioType TEXT NOT NULL,
          toothNumber INTEGER,
          date TEXT NOT NULL,
          imageData TEXT NOT NULL,
          fileName TEXT,
          fileSize INTEGER,
          notes TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          deletedAt TEXT,
          FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_patient_radios_patient ON patient_radios(patientId);
        CREATE INDEX IF NOT EXISTS idx_patient_radios_date ON patient_radios(date);
      `)
    }

    if (tableExists('medical_acts')) {
      db.exec("UPDATE medical_acts SET category = 'PROTHESE_FIXE' WHERE category = 'PROTHESE';")
    }
  } catch (err) {
    console.warn('[Database] Table migration warning:', err)
  }
}

function executeMigrations(db: Database.Database): void {
  // First migrate any existing columns
  migrateExistingTables(db)

  // Read and execute schema.sql
  const schemaPath = join(__dirname, '../../src/main/database/schema.sql')
  if (existsSync(schemaPath)) {
    const ddl = readFileSync(schemaPath, 'utf8')
    db.exec(ddl)
  } else {
    // Fallback inline DDL
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        fullName TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'DENTIST',
        active INTEGER NOT NULL DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        patientNumber TEXT NOT NULL UNIQUE,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        cin TEXT,
        phone TEXT NOT NULL,
        email TEXT,
        dateOfBirth TEXT,
        gender TEXT DEFAULT 'OTHER',
        address TEXT,
        wilaya TEXT,
        medicalAlerts TEXT,
        bloodGroup TEXT,
        notes TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT,
        syncStatus TEXT DEFAULT 'pending'
      );

      CREATE TABLE IF NOT EXISTS medical_acts (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        defaultPrice REAL NOT NULL DEFAULT 0.0,
        durationMinutes INTEGER NOT NULL DEFAULT 30,
        active INTEGER NOT NULL DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        patientId TEXT NOT NULL,
        patientName TEXT NOT NULL,
        patientPhone TEXT,
        dateTime TEXT NOT NULL,
        durationMinutes INTEGER NOT NULL DEFAULT 30,
        treatmentType TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'SCHEDULED',
        dentistName TEXT,
        notes TEXT,
        colorTag TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT,
        syncStatus TEXT DEFAULT 'pending',
        FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS dental_chart_records (
        id TEXT PRIMARY KEY,
        patientId TEXT NOT NULL,
        toothNumber INTEGER NOT NULL,
        condition TEXT NOT NULL DEFAULT 'HEALTHY',
        surfaces TEXT,
        notes TEXT,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT,
        syncStatus TEXT DEFAULT 'pending',
        FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE,
        UNIQUE(patientId, toothNumber)
      );

      CREATE TABLE IF NOT EXISTS treatments (
        id TEXT PRIMARY KEY,
        patientId TEXT NOT NULL,
        toothNumber INTEGER,
        actId TEXT,
        actName TEXT NOT NULL,
        price REAL NOT NULL DEFAULT 0.0,
        status TEXT NOT NULL DEFAULT 'COMPLETED',
        date TEXT NOT NULL,
        notes TEXT,
        dentistName TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT,
        syncStatus TEXT DEFAULT 'pending',
        FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS clinical_notes (
        id TEXT PRIMARY KEY,
        patientId TEXT NOT NULL,
        practitioner TEXT NOT NULL,
        date TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'CONSULTATION',
        content TEXT NOT NULL,
        attachments TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT,
        syncStatus TEXT DEFAULT 'pending',
        FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        invoiceNumber TEXT NOT NULL UNIQUE,
        patientId TEXT NOT NULL,
        patientName TEXT NOT NULL,
        date TEXT NOT NULL,
        dueDate TEXT,
        totalAmount REAL NOT NULL DEFAULT 0.0,
        paidAmount REAL NOT NULL DEFAULT 0.0,
        remainingAmount REAL NOT NULL DEFAULT 0.0,
        status TEXT NOT NULL DEFAULT 'PENDING',
        paymentMethod TEXT,
        itemsJson TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT,
        syncStatus TEXT DEFAULT 'pending',
        FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        patientId TEXT NOT NULL,
        invoiceId TEXT,
        amount REAL NOT NULL DEFAULT 0.0,
        date TEXT NOT NULL,
        method TEXT NOT NULL DEFAULT 'CASH',
        notes TEXT,
        createdAt TEXT NOT NULL,
        deletedAt TEXT,
        syncStatus TEXT DEFAULT 'pending',
        FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS prescriptions (
        id TEXT PRIMARY KEY,
        patientId TEXT NOT NULL,
        patientName TEXT NOT NULL,
        dentistName TEXT NOT NULL,
        date TEXT NOT NULL,
        notes TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT,
        syncStatus TEXT DEFAULT 'pending',
        FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS prescription_items (
        id TEXT PRIMARY KEY,
        prescriptionId TEXT NOT NULL,
        medicineName TEXT NOT NULL,
        dosage TEXT NOT NULL,
        form TEXT NOT NULL,
        instructions TEXT NOT NULL,
        FOREIGN KEY (prescriptionId) REFERENCES prescriptions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entityType TEXT NOT NULL,
        entityId TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        retryCount INTEGER NOT NULL DEFAULT 0,
        errorMessage TEXT,
        createdAt TEXT NOT NULL,
        syncedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS drugs_catalog (
        id TEXT PRIMARY KEY,
        brandName TEXT NOT NULL,
        genericName TEXT,
        dosage TEXT,
        form TEXT,
        defaultInstructions TEXT,
        category TEXT,
        isCustom INTEGER DEFAULT 0,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS prescription_templates (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        diagnosisHint TEXT,
        itemsJson TEXT NOT NULL,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS prosthetic_laboratories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        phone TEXT NOT NULL,
        wilaya TEXT DEFAULT 'Alger',
        address TEXT,
        contactPerson TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS prothesis_orders (
        id TEXT PRIMARY KEY,
        orderNumber TEXT NOT NULL UNIQUE,
        patientId TEXT NOT NULL,
        patientName TEXT NOT NULL,
        dentistName TEXT NOT NULL,
        labId TEXT NOT NULL,
        labName TEXT NOT NULL,
        actName TEXT NOT NULL,
        toothNumber INTEGER,
        shade TEXT NOT NULL,
        nature TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PREPARATION',
        sentDate TEXT,
        expectedDate TEXT,
        receivedDate TEXT,
        deliveryDate TEXT,
        labCostDA REAL NOT NULL DEFAULT 0.0,
        clinicPriceDA REAL NOT NULL DEFAULT 0.0,
        notes TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT,
        FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE RESTRICT,
        FOREIGN KEY (labId) REFERENCES prosthetic_laboratories(id) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS patient_medical_history (
        id TEXT PRIMARY KEY,
        patientId TEXT NOT NULL UNIQUE,
        cardioChecklist TEXT NOT NULL DEFAULT '[]',
        hematologyChecklist TEXT NOT NULL DEFAULT '[]',
        gastroChecklist TEXT NOT NULL DEFAULT '[]',
        respiratoryChecklist TEXT NOT NULL DEFAULT '[]',
        endocrineChecklist TEXT NOT NULL DEFAULT '[]',
        allergiesChecklist TEXT NOT NULL DEFAULT '[]',
        isPregnantOrNursing INTEGER DEFAULT 0,
        pregnancyMonth INTEGER,
        generalRiskLevel TEXT NOT NULL DEFAULT 'LOW',
        doctorNotes TEXT,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS devis (
        id TEXT PRIMARY KEY,
        devisNumber TEXT NOT NULL UNIQUE,
        patientId TEXT NOT NULL,
        patientName TEXT NOT NULL,
        dentistName TEXT NOT NULL,
        date TEXT NOT NULL,
        validityDays INTEGER NOT NULL DEFAULT 30,
        totalGrossDA REAL NOT NULL DEFAULT 0.0,
        discountDA REAL NOT NULL DEFAULT 0.0,
        totalNetDA REAL NOT NULL DEFAULT 0.0,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        notes TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT,
        FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS devis_items (
        id TEXT PRIMARY KEY,
        devisId TEXT NOT NULL,
        actId TEXT,
        actName TEXT NOT NULL,
        specialty TEXT NOT NULL,
        toothNumber INTEGER,
        quantity INTEGER NOT NULL DEFAULT 1,
        unitPriceDA REAL NOT NULL DEFAULT 0.0,
        totalPriceDA REAL NOT NULL DEFAULT 0.0,
        FOREIGN KEY (devisId) REFERENCES devis(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS treatment_projects (
        id TEXT PRIMARY KEY,
        patientId TEXT NOT NULL,
        title TEXT NOT NULL,
        specialty TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PLANNED',
        totalPhases INTEGER NOT NULL DEFAULT 1,
        completedPhases INTEGER NOT NULL DEFAULT 0,
        estimatedTotalDA REAL NOT NULL DEFAULT 0.0,
        startDate TEXT,
        targetEndDate TEXT,
        roadmapJson TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS lab_test_orders (
        id TEXT PRIMARY KEY,
        orderNumber TEXT NOT NULL UNIQUE,
        patientId TEXT NOT NULL,
        dentistName TEXT NOT NULL,
        requestDate TEXT NOT NULL,
        reason TEXT,
        testsRequestedJson TEXT NOT NULL DEFAULT '[]',
        resultsJson TEXT NOT NULL DEFAULT '{}',
        isCriticalAlert INTEGER DEFAULT 0,
        criticalAlertMessage TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS waiting_room_entries (
        id TEXT PRIMARY KEY,
        patientId TEXT NOT NULL,
        patientName TEXT NOT NULL,
        patientPhone TEXT,
        appointmentId TEXT,
        arrivalTime TEXT NOT NULL,
        calledTime TEXT,
        departureTime TEXT,
        status TEXT NOT NULL DEFAULT 'WAITING',
        isUrgent INTEGER NOT NULL DEFAULT 0,
        priorityNote TEXT,
        assignedDentist TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
      );
    `)
  }
}

export function seedInitialDataIfEmpty(db: Database.Database): void {
  const now = new Date().toISOString()
  const today = new Date().toISOString().split('T')[0]

  // 1. Seed Users (Admin, Dentist, Assistant)
  const userCount = db.prepare('SELECT count(*) as count FROM users').get() as { count: number }
  if (userCount.count === 0) {
    console.log('[Database] Seeding initial users (Admin, Dentist, Assistant)...')
    const insertUser = db.prepare(`
      INSERT INTO users (id, username, passwordHash, fullName, role, active, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `)

    insertUser.run('usr_admin', 'admin', hashPassword('admin123'), 'Administrateur Principal', 'ADMIN', now, now)
    insertUser.run('usr_dentist', 'dr_amrani', hashPassword('dentist123'), 'Dr. Mohamed Amrani', 'DENTIST', now, now)
    insertUser.run('usr_assistant', 'amira_assistant', hashPassword('assistant123'), 'Amira Mansour', 'ASSISTANT', now, now)
  }

  // 2. Seed Medical Acts (Catalogue d'actes dentaires algérien - 8 Spécialités)
  const actCount = db.prepare('SELECT count(*) as count FROM medical_acts').get() as { count: number }
  const odfCount = db.prepare("SELECT count(*) as count FROM medical_acts WHERE category = 'ODF'").get() as { count: number }
  if (actCount.count === 0 || odfCount.count === 0) {
    console.log('[Database] Seeding Algerian Medical Acts Catalogue in Dinars (DA) across 8 dental specialties...')
    const defaultActs: Omit<MedicalAct, 'createdAt' | 'updatedAt' | 'deletedAt'>[] = [
      // 1. ODF
      { id: 'act_odf_01', code: 'ODF-BRACK', name: 'Pose de brackets bi-maxillaire', category: 'ODF', defaultPrice: 80000, durationMinutes: 90, active: true },
      { id: 'act_odf_02', code: 'ODF-CTRL', name: 'Contrôle ODF & Activation', category: 'ODF', defaultPrice: 2500, durationMinutes: 30, active: true },
      { id: 'act_odf_03', code: 'ODF-CONT', name: 'Contention fixe collée', category: 'ODF', defaultPrice: 15000, durationMinutes: 45, active: true },
      { id: 'act_odf_04', code: 'ODF-GOUT', name: 'Gouttière thermoformée', category: 'ODF', defaultPrice: 8000, durationMinutes: 30, active: true },

      // 2. PROTHESE_FIXE
      { id: 'act_pfix_01', code: 'PRO-ZIRC', name: 'Couronne Zircone monolithique', category: 'PROTHESE_FIXE', defaultPrice: 22000, durationMinutes: 45, active: true },
      { id: 'act_pfix_02', code: 'PRO-CCM', name: 'Couronne Céramo-métallique', category: 'PROTHESE_FIXE', defaultPrice: 14000, durationMinutes: 45, active: true },
      { id: 'act_pfix_03', code: 'PRO-EMAX', name: 'Facette Emax', category: 'PROTHESE_FIXE', defaultPrice: 28000, durationMinutes: 60, active: true },
      { id: 'act_pfix_04', code: 'PRO-INLAY', name: 'Inlay/Onlay résine/céramique', category: 'PROTHESE_FIXE', defaultPrice: 12000, durationMinutes: 45, active: true },
      { id: 'act_pfix_05', code: 'PRO-IMP', name: 'Couronne implanto-portée', category: 'PROTHESE_FIXE', defaultPrice: 35000, durationMinutes: 60, active: true },

      // 3. PROTHESE_AMOVIBLE
      { id: 'act_pamo_01', code: 'PRO-TOT', name: 'Prothèse totale résine unimaxillaire', category: 'PROTHESE_AMOVIBLE', defaultPrice: 30000, durationMinutes: 45, active: true },
      { id: 'act_pamo_02', code: 'PRO-STEL', name: 'Châssis métallique Stellite', category: 'PROTHESE_AMOVIBLE', defaultPrice: 45000, durationMinutes: 45, active: true },
      { id: 'act_pamo_03', code: 'PRO-REP', name: 'Réparation de prothèse fêlée', category: 'PROTHESE_AMOVIBLE', defaultPrice: 4000, durationMinutes: 30, active: true },
      { id: 'act_pamo_04', code: 'PRO-REB', name: 'Rebasage complet', category: 'PROTHESE_AMOVIBLE', defaultPrice: 9000, durationMinutes: 40, active: true },

      // 4. CHIRURGIE
      { id: 'act_chir_01', code: 'CHIR-DDS', name: 'Avulsion dent incluse / Sagesse DDS', category: 'CHIRURGIE', defaultPrice: 12000, durationMinutes: 45, active: true },
      { id: 'act_chir_02', code: 'CHIR-KYST', name: 'Kystectomie apicale', category: 'CHIRURGIE', defaultPrice: 15000, durationMinutes: 60, active: true },
      { id: 'act_chir_03', code: 'CHIR-FREN', name: 'Frénectomie labiale', category: 'CHIRURGIE', defaultPrice: 8000, durationMinutes: 30, active: true },
      { id: 'act_chir_04', code: 'CHIR-CAN', name: 'Dégagement canine incluse pour ODF', category: 'CHIRURGIE', defaultPrice: 14000, durationMinutes: 45, active: true },

      // 5. IMPLANT
      { id: 'act_imp_01', code: 'IMP-TIT', name: 'Pose implant titane unitaire', category: 'IMPLANT', defaultPrice: 60000, durationMinutes: 60, active: true },
      { id: 'act_imp_02', code: 'IMP-SLIFT', name: 'Comblement osseux sinusien / Sinus Lift', category: 'IMPLANT', defaultPrice: 45000, durationMinutes: 90, active: true },
      { id: 'act_imp_03', code: 'IMP-ROG', name: 'Régénération Osseuse Guidée (ROG)', category: 'IMPLANT', defaultPrice: 30000, durationMinutes: 60, active: true },
      { id: 'act_imp_04', code: 'IMP-GREF', name: 'Greffe épithélio-conjonctive', category: 'IMPLANT', defaultPrice: 20000, durationMinutes: 60, active: true },

      // 6. SOINS
      { id: 'act_soin_01', code: 'SOIN-ENDOM', name: 'Traitement endodontique molaire (Endo inf/sup)', category: 'SOINS', defaultPrice: 9000, durationMinutes: 60, active: true },
      { id: 'act_soin_02', code: 'SOIN-ENDOU', name: 'Endodontie mono-radiculée', category: 'SOINS', defaultPrice: 5000, durationMinutes: 40, active: true },
      { id: 'act_soin_03', code: 'SOIN-COMP3', name: 'Obturation composite 3 faces (MOD)', category: 'SOINS', defaultPrice: 6000, durationMinutes: 45, active: true },
      { id: 'act_soin_04', code: 'SOIN-PULP', name: 'Pulpotomie dent lactéale', category: 'SOINS', defaultPrice: 4000, durationMinutes: 30, active: true },

      // 7. CONSULTATION_IMAGERIE
      { id: 'act_img_01', code: 'IMG-CONS', name: 'Consultation initiale & Bilan', category: 'CONSULTATION_IMAGERIE', defaultPrice: 1500, durationMinutes: 20, active: true },
      { id: 'act_img_02', code: 'IMG-PAN', name: 'Radio Panoramique 2D numérique', category: 'CONSULTATION_IMAGERIE', defaultPrice: 2000, durationMinutes: 15, active: true },
      { id: 'act_img_03', code: 'IMG-TLR', name: 'Téléradiographie céphalométrique (TLR)', category: 'CONSULTATION_IMAGERIE', defaultPrice: 2500, durationMinutes: 15, active: true },
      { id: 'act_img_04', code: 'IMG-CBCT', name: 'Tomographie 3D Cône Beam (CBCT)', category: 'CONSULTATION_IMAGERIE', defaultPrice: 6000, durationMinutes: 20, active: true },

      // 8. PARODONTIE
      { id: 'act_paro_01', code: 'PARO-DET', name: 'Détartrage et polissage complet', category: 'PARODONTIE', defaultPrice: 4000, durationMinutes: 30, active: true },
      { id: 'act_paro_02', code: 'PARO-SURF', name: 'Surfaçage radiculaire / quadrant', category: 'PARODONTIE', defaultPrice: 8000, durationMinutes: 45, active: true },
      { id: 'act_paro_03', code: 'PARO-GING', name: 'Gingivectomie à visée esthétique', category: 'PARODONTIE', defaultPrice: 10000, durationMinutes: 45, active: true }
    ]

    const insertAct = db.prepare(`
      INSERT INTO medical_acts (id, code, name, category, defaultPrice, durationMinutes, active, createdAt, updatedAt)
      VALUES (@id, @code, @name, @category, @defaultPrice, @durationMinutes, @active, '${now}', '${now}')
      ON CONFLICT(id) DO UPDATE SET
        code = excluded.code,
        name = excluded.name,
        category = excluded.category,
        defaultPrice = excluded.defaultPrice,
        durationMinutes = excluded.durationMinutes,
        active = excluded.active
    `)

    for (const act of defaultActs) {
      insertAct.run({ ...act, active: act.active ? 1 : 0 })
    }
  }

  // 3. Seed Patients (Algerian Context)
  const patientCount = db.prepare('SELECT count(*) as count FROM patients WHERE deletedAt IS NULL').get() as { count: number }
  if (patientCount.count === 0) {
    console.log('[Database] Seeding Algerian clinic demonstration patients...')
    const seedPatients: Patient[] = [
      {
        id: 'pat_dz_01',
        patientNumber: 'DZ-2026-0001',
        firstName: 'Yacine',
        lastName: 'Benali',
        cin: '16045892110',
        phone: '0550 12 34 56',
        email: 'yacine.benali@gmail.com',
        dateOfBirth: '1989-06-14',
        gender: 'M',
        address: '14 Rue Didouche Mourad',
        wilaya: 'Alger',
        medicalAlerts: 'Allergie Pénicilline',
        bloodGroup: 'A+',
        notes: 'Pose couronne zircone prévue sur 21',
        createdAt: now,
        updatedAt: now,
        syncStatus: 'synced'
      },
      {
        id: 'pat_dz_02',
        patientNumber: 'DZ-2026-0002',
        firstName: 'Amira',
        lastName: 'Mansouri',
        cin: '31098432115',
        phone: '0661 98 76 54',
        email: 'amira.mansouri@outlook.com',
        dateOfBirth: '1996-03-22',
        gender: 'F',
        address: 'Boulevard de la Soummam',
        wilaya: 'Oran',
        medicalAlerts: 'Aucune allergie connue',
        bloodGroup: 'O+',
        notes: 'Détartrage annuel et contrôle général',
        createdAt: now,
        updatedAt: now,
        syncStatus: 'synced'
      },
      {
        id: 'pat_dz_03',
        patientNumber: 'DZ-2026-0003',
        firstName: 'Karim',
        lastName: 'Belkacem',
        cin: '09012398471',
        phone: '0770 45 67 89',
        email: 'karim.belkacem@yahoo.fr',
        dateOfBirth: '1978-10-05',
        gender: 'M',
        address: 'Cité des Roses',
        wilaya: 'Blida',
        medicalAlerts: 'Diabète type 2 (Équilibré)',
        bloodGroup: 'B+',
        notes: 'Soin endodontique molaire 36 en cours',
        createdAt: now,
        updatedAt: now,
        syncStatus: 'synced'
      }
    ]

    const insertPatient = db.prepare(`
      INSERT INTO patients (id, patientNumber, firstName, lastName, cin, phone, email, dateOfBirth, gender, address, wilaya, medicalAlerts, bloodGroup, notes, createdAt, updatedAt, syncStatus)
      VALUES (@id, @patientNumber, @firstName, @lastName, @cin, @phone, @email, @dateOfBirth, @gender, @address, @wilaya, @medicalAlerts, @bloodGroup, @notes, @createdAt, @updatedAt, @syncStatus)
    `)

    for (const p of seedPatients) {
      insertPatient.run(p)
    }

    // Seed Appointments for today
    const seedAppointments: Appointment[] = [
      {
        id: 'apt_dz_01',
        patientId: 'pat_dz_01',
        patientName: 'Yacine Benali',
        patientPhone: '0550 12 34 56',
        dateTime: `${today}T09:30:00`,
        durationMinutes: 45,
        treatmentType: 'Couronne Zircone (21)',
        status: 'IN_CHAIR',
        dentistName: 'Dr. Mohamed Amrani',
        notes: 'Essayage armature zircone',
        colorTag: '#005eb2',
        createdAt: now,
        updatedAt: now,
        syncStatus: 'synced'
      },
      {
        id: 'apt_dz_02',
        patientId: 'pat_dz_02',
        patientName: 'Amira Mansouri',
        patientPhone: '0661 98 76 54',
        dateTime: `${today}T11:00:00`,
        durationMinutes: 30,
        treatmentType: 'Détartrage & Polissage',
        status: 'SCHEDULED',
        dentistName: 'Dr. Mohamed Amrani',
        notes: 'Contrôle annuel',
        colorTag: '#4597fe',
        createdAt: now,
        updatedAt: now,
        syncStatus: 'synced'
      },
      {
        id: 'apt_dz_03',
        patientId: 'pat_dz_03',
        patientName: 'Karim Belkacem',
        patientPhone: '0770 45 67 89',
        dateTime: `${today}T14:30:00`,
        durationMinutes: 60,
        treatmentType: 'Obturation canalaire (36)',
        status: 'CONFIRMED',
        dentistName: 'Dr. Mohamed Amrani',
        notes: 'Séance 2 traitement de racine',
        colorTag: '#009c25',
        createdAt: now,
        updatedAt: now,
        syncStatus: 'synced'
      }
    ]

    const insertApt = db.prepare(`
      INSERT INTO appointments (id, patientId, patientName, patientPhone, dateTime, durationMinutes, treatmentType, status, dentistName, notes, colorTag, createdAt, updatedAt, syncStatus)
      VALUES (@id, @patientId, @patientName, @patientPhone, @dateTime, @durationMinutes, @treatmentType, @status, @dentistName, @notes, @colorTag, @createdAt, @updatedAt, @syncStatus)
    `)

    for (const a of seedAppointments) {
      insertApt.run(a)
    }

    // Seed Sample Invoices with Algerian Dinars (DA)
    const seedInvoices = [
      {
        id: 'inv_01',
        invoiceNumber: 'FAC-2026-0001',
        patientId: 'pat_dz_01',
        patientName: 'Yacine Benali',
        date: today,
        totalAmount: 28000,
        paidAmount: 20000,
        remainingAmount: 8000, // 8000 DA remaining debt
        status: 'PARTIAL',
        itemsJson: JSON.stringify([{ description: 'Couronne Zircone 21', amount: 28000 }])
      }
    ]

    const insertInv = db.prepare(`
      INSERT INTO invoices (id, invoiceNumber, patientId, patientName, date, totalAmount, paidAmount, remainingAmount, status, itemsJson, createdAt, updatedAt, syncStatus)
      VALUES (@id, @invoiceNumber, @patientId, @patientName, @date, @totalAmount, @paidAmount, @remainingAmount, @status, @itemsJson, '${now}', '${now}', 'synced')
    `)

    for (const inv of seedInvoices) {
      insertInv.run(inv)
    }
  }

  // 4. Seed Algerian Drugs Catalog (Prompt 4)
  const drugCount = db.prepare('SELECT count(*) as count FROM drugs_catalog').get() as { count: number }
  if (drugCount.count === 0) {
    console.log('[Database] Seeding Algerian Dental Drugs Catalog...')
    const seedDrugs = [
      {
        id: 'drug_dz_01',
        brandName: 'Amoxicilline',
        genericName: 'Amoxicilline trihydratée',
        dosage: '1g',
        form: 'Comprimé',
        defaultInstructions: '1 cp matin et soir pendant 6 jours',
        category: 'Antibiotique',
        isCustom: 0,
        createdAt: now
      },
      {
        id: 'drug_dz_02',
        brandName: 'Bi-Rodogyl',
        genericName: 'Spiramycine / Métronidazole',
        dosage: '1.5 MUI / 250 mg',
        form: 'Comprimé',
        defaultInstructions: '1 cp 3 fois par jour au cours des repas',
        category: 'Antibiotique',
        isCustom: 0,
        createdAt: now
      },
      {
        id: 'drug_dz_03',
        brandName: 'Paracétamol',
        genericName: 'Paracétamol',
        dosage: '1g',
        form: 'Comprimé',
        defaultInstructions: '1 cp toutes les 6 heures en cas de douleur',
        category: 'Antalgique',
        isCustom: 0,
        createdAt: now
      },
      {
        id: 'drug_dz_04',
        brandName: 'Ibuprofène',
        genericName: 'Ibuprofène',
        dosage: '400mg',
        form: 'Comprimé',
        defaultInstructions: '1 cp 3 fois par jour après les repas',
        category: 'Anti-inflammatoire',
        isCustom: 0,
        createdAt: now
      },
      {
        id: 'drug_dz_05',
        brandName: 'Bain de bouche Chlorhexidine',
        genericName: 'Chlorhexidine digluconate',
        dosage: '0.12%',
        form: 'Flacon',
        defaultInstructions: '2 à 3 bains de bouche par jour après brossage',
        category: 'Bain de bouche',
        isCustom: 0,
        createdAt: now
      },
      {
        id: 'drug_dz_06',
        brandName: 'Augmentin',
        genericName: 'Amoxicilline / Acide clavulanique',
        dosage: '1g / 125mg',
        form: 'Sachet / Comprimé',
        defaultInstructions: '1 sachet matin et soir au milieu des repas pendant 7 jours',
        category: 'Antibiotique',
        isCustom: 0,
        createdAt: now
      },
      {
        id: 'drug_dz_07',
        brandName: 'Flagyl',
        genericName: 'Métronidazole',
        dosage: '500mg',
        form: 'Comprimé',
        defaultInstructions: '1 cp matin et soir pendant 7 jours',
        category: 'Antibiotique',
        isCustom: 0,
        createdAt: now
      }
    ]

    const insertDrug = db.prepare(`
      INSERT INTO drugs_catalog (id, brandName, genericName, dosage, form, defaultInstructions, category, isCustom, createdAt)
      VALUES (@id, @brandName, @genericName, @dosage, @form, @defaultInstructions, @category, @isCustom, @createdAt)
    `)

    for (const d of seedDrugs) {
      insertDrug.run(d)
    }
  }

  // 5. Seed Prescription Templates (Prompt 4)
  const templateCount = db.prepare('SELECT count(*) as count FROM prescription_templates').get() as { count: number }
  if (templateCount.count === 0) {
    console.log('[Database] Seeding Algerian Dental Prescription Templates...')
    const seedTemplates = [
      {
        id: 'tpl_dz_01',
        title: 'Infection dentaire aiguë / Abcès périapical',
        diagnosisHint: 'Abcès dentaire, parodontite aiguë ou cellulite débutante',
        itemsJson: JSON.stringify([
          {
            medicineName: 'Amoxicilline',
            dosage: '1g',
            form: 'Comprimé',
            instructions: '1 cp matin et soir pendant 6 jours'
          },
          {
            medicineName: 'Paracétamol',
            dosage: '1g',
            form: 'Comprimé',
            instructions: '1 cp toutes les 6 heures en cas de douleur'
          },
          {
            medicineName: 'Bain de bouche Chlorhexidine',
            dosage: '0.12%',
            form: 'Flacon',
            instructions: '2 à 3 bains de bouche par jour après brossage'
          }
        ]),
        createdAt: now
      },
      {
        id: 'tpl_dz_02',
        title: 'Post-avulsion chirurgicale (Dents de sagesse)',
        diagnosisHint: 'Extraction complexe ou chirurgicale de dent incluse',
        itemsJson: JSON.stringify([
          {
            medicineName: 'Bi-Rodogyl',
            dosage: '1.5 MUI / 250 mg',
            form: 'Comprimé',
            instructions: '1 cp 3 fois par jour au cours des repas pendant 6 jours'
          },
          {
            medicineName: 'Ibuprofène',
            dosage: '400mg',
            form: 'Comprimé',
            instructions: '1 cp 3 fois par jour après les repas pendant 4 jours'
          },
          {
            medicineName: 'Paracétamol',
            dosage: '1g',
            form: 'Comprimé',
            instructions: '1 cp en alternance avec l’ibuprofène si douleur'
          },
          {
            medicineName: 'Bain de bouche Chlorhexidine',
            dosage: '0.12%',
            form: 'Flacon',
            instructions: 'Bains de bouche à débuter 24h après l’intervention'
          }
        ]),
        createdAt: now
      },
      {
        id: 'tpl_dz_03',
        title: 'Gingivite & Suites de Détartrage',
        diagnosisHint: 'Saignements gingivaux, parodontite chronique stabilisée',
        itemsJson: JSON.stringify([
          {
            medicineName: 'Bain de bouche Chlorhexidine',
            dosage: '0.12%',
            form: 'Flacon',
            instructions: 'Bains de bouche purs pendant 10 jours après le brossage'
          },
          {
            medicineName: 'Paracétamol',
            dosage: '1g',
            form: 'Comprimé',
            instructions: '1 cp en cas de sensibilité dentinaire'
          }
        ]),
        createdAt: now
      }
    ]

    const insertTpl = db.prepare(`
      INSERT INTO prescription_templates (id, title, diagnosisHint, itemsJson, createdAt)
      VALUES (@id, @title, @diagnosisHint, @itemsJson, @createdAt)
    `)

    for (const t of seedTemplates) {
      insertTpl.run(t)
    }
  }
}
