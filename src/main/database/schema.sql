-- DentaFlow Algeria - Master SQLite Database Schema
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- 1. Users Table (Admin, Dentist, Assistant)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  fullName TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'DENTIST', -- 'ADMIN', 'DENTIST', 'ASSISTANT'
  active INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 2. Patients Table
CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  patientNumber TEXT NOT NULL UNIQUE, -- e.g. DZ-2026-0001
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

CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(lastName, firstName);
CREATE INDEX IF NOT EXISTS idx_patients_number ON patients(patientNumber);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);

-- 3. Medical Acts Table (Catalogue d'actes)
CREATE TABLE IF NOT EXISTS medical_acts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'SOINS', 'PROTHESE', 'CHIRURGIE'
  defaultPrice REAL NOT NULL DEFAULT 0.0, -- In Algerian Dinars (DA)
  durationMinutes INTEGER NOT NULL DEFAULT 30,
  active INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_acts_category ON medical_acts(category);

-- 4. Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL,
  patientName TEXT NOT NULL,
  patientPhone TEXT,
  dateTime TEXT NOT NULL,
  durationMinutes INTEGER NOT NULL DEFAULT 30,
  treatmentType TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED', -- 'SCHEDULED', 'CONFIRMED', 'IN_CHAIR', 'COMPLETED', 'CANCELLED'
  dentistName TEXT,
  notes TEXT,
  colorTag TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  syncStatus TEXT DEFAULT 'pending',
  FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_appointments_datetime ON appointments(dateTime);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patientId);

-- 5. Dental Chart Records Table (FDI World Dental System 11..48)
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

CREATE INDEX IF NOT EXISTS idx_dental_chart_patient ON dental_chart_records(patientId);

-- 6. Treatments / Actes Réalisés Table
CREATE TABLE IF NOT EXISTS treatments (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL,
  toothNumber INTEGER,
  actId TEXT,
  actName TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0.0, -- DA
  status TEXT NOT NULL DEFAULT 'COMPLETED', -- 'PLANNED', 'IN_PROGRESS', 'COMPLETED'
  date TEXT NOT NULL,
  notes TEXT,
  dentistName TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  syncStatus TEXT DEFAULT 'pending',
  FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE RESTRICT,
  FOREIGN KEY (actId) REFERENCES medical_acts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_treatments_patient ON treatments(patientId);

-- 7. Clinical Notes Table
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

-- 8. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoiceNumber TEXT NOT NULL UNIQUE,
  patientId TEXT NOT NULL,
  patientName TEXT NOT NULL,
  date TEXT NOT NULL,
  dueDate TEXT,
  totalAmount REAL NOT NULL DEFAULT 0.0, -- Total DA
  paidAmount REAL NOT NULL DEFAULT 0.0, -- Payé DA
  remainingAmount REAL NOT NULL DEFAULT 0.0, -- Dettes / Reste DA
  status TEXT NOT NULL DEFAULT 'PENDING',
  paymentMethod TEXT,
  itemsJson TEXT NOT NULL DEFAULT '[]',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  syncStatus TEXT DEFAULT 'pending',
  FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE RESTRICT
);

-- 9. Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL,
  invoiceId TEXT,
  amount REAL NOT NULL DEFAULT 0.0, -- DA
  date TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'CASH', -- 'CASH', 'CHECK', 'TRANSFER'
  notes TEXT,
  createdAt TEXT NOT NULL,
  deletedAt TEXT,
  syncStatus TEXT DEFAULT 'pending',
  FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE RESTRICT,
  FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE SET NULL
);

-- 10. Prescriptions & Prescription Items
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

-- 11. Offline-First Sync Queue
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

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status, createdAt);

-- 12. Drugs Catalog (Dictionnaire des Médicaments - Algérie)
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

-- 13. Prescription Templates (Ordonnances Types / Gabarits)
CREATE TABLE IF NOT EXISTS prescription_templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  diagnosisHint TEXT,
  itemsJson TEXT NOT NULL,
  createdAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_prescription_templates_title ON prescription_templates(title);
