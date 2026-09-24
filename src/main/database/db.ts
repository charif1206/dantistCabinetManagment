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

function migrateExistingTables(db: Database.Database): void {
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
    `)
  }
}

function seedInitialDataIfEmpty(db: Database.Database): void {
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

  // 2. Seed Medical Acts (Catalogue d'actes dentaires algérien)
  const actCount = db.prepare('SELECT count(*) as count FROM medical_acts').get() as { count: number }
  if (actCount.count === 0) {
    console.log('[Database] Seeding Algerian Medical Acts Catalogue in Dinars (DA)...')
    const defaultActs: Omit<MedicalAct, 'createdAt' | 'updatedAt' | 'deletedAt'>[] = [
      { id: 'act_01', code: 'CONS', name: 'Consultation & Bilan bucco-dentaire', category: 'SOINS', defaultPrice: 1500, durationMinutes: 20, active: true },
      { id: 'act_02', code: 'DET', name: 'Détartrage & Polissage sus-gingival', category: 'SOINS', defaultPrice: 3500, durationMinutes: 30, active: true },
      { id: 'act_03', code: 'COMP1', name: 'Obturation composite 1 face', category: 'SOINS', defaultPrice: 3000, durationMinutes: 30, active: true },
      { id: 'act_04', code: 'COMP2', name: 'Obturation composite multi-faces (2/3 faces)', category: 'SOINS', defaultPrice: 4500, durationMinutes: 45, active: true },
      { id: 'act_05', code: 'ENDO', name: 'Traitement endodontique (Biopulpectomie molaire)', category: 'SOINS', defaultPrice: 8500, durationMinutes: 60, active: true },
      { id: 'act_06', code: 'EXT_S', name: 'Avulsion / Extraction dentaire simple', category: 'CHIRURGIE', defaultPrice: 2500, durationMinutes: 30, active: true },
      { id: 'act_07', code: 'EXT_CH', name: 'Extraction chirurgicale dent de sagesse incluse', category: 'CHIRURGIE', defaultPrice: 8000, durationMinutes: 60, active: true },
      { id: 'act_08', code: 'CR_CCM', name: 'Couronne Céramo-Métallique (CCM)', category: 'PROTHESE', defaultPrice: 18000, durationMinutes: 45, active: true },
      { id: 'act_09', code: 'CR_ZIR', name: 'Couronne tout-céramique Zircone', category: 'PROTHESE', defaultPrice: 28000, durationMinutes: 45, active: true },
      { id: 'act_10', code: 'IMP', name: 'Pose Implant dentaire titane (Phase chirurgicale)', category: 'CHIRURGIE', defaultPrice: 65000, durationMinutes: 60, active: true }
    ]

    const insertAct = db.prepare(`
      INSERT INTO medical_acts (id, code, name, category, defaultPrice, durationMinutes, active, createdAt, updatedAt)
      VALUES (@id, @code, @name, @category, @defaultPrice, @durationMinutes, @active, '${now}', '${now}')
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
