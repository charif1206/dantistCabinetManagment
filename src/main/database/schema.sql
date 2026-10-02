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
  receiptNumber TEXT,
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

-- 14. Prosthetic Laboratories (Mylab / Mخابر التعويضات السنية)
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

-- 15. Prothesis Orders (طلبيات المخابر والتعويضات السنية)
CREATE TABLE IF NOT EXISTS prothesis_orders (
  id TEXT PRIMARY KEY,
  orderNumber TEXT NOT NULL UNIQUE, -- e.g. LAB-2026-0001
  patientId TEXT NOT NULL,
  patientName TEXT NOT NULL,
  dentistName TEXT NOT NULL,
  labId TEXT NOT NULL,
  labName TEXT NOT NULL,
  actName TEXT NOT NULL,
  toothNumber INTEGER, -- FDI: 11-48 or 51-85 (main tooth)
  teeth TEXT, -- FDI teeth list (e.g. '11, 12, 13')
  shade TEXT NOT NULL, -- Vita Classical (A1-D4), 3D Master, Bleach
  nature TEXT NOT NULL, -- 'ZIRCONE', 'CERAMO_METALLIQUE', 'EMAX', 'STELLITE', 'RESINE_COMPLETE', etc.
  status TEXT NOT NULL DEFAULT 'PREPARATION', -- 'PREPARATION', 'SENT', 'RECEIVED', 'FITTING', 'DELIVERED', 'REJECTED'
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

-- 16. Patient Systemic Medical History (استبيان السوابق المرضية المفصل بحسب الأجهزة)
CREATE TABLE IF NOT EXISTS patient_medical_history (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL UNIQUE,
  cardioChecklist TEXT NOT NULL DEFAULT '[]', -- HTA, Cardiopathie, Souffle, Valve, Pacemaker, Infarctus
  hematologyChecklist TEXT NOT NULL DEFAULT '[]', -- Anticoagulant, Hémostase, Hémophilie, Saignement
  gastroChecklist TEXT NOT NULL DEFAULT '[]', -- Hépatite B/C, Cirrhose, Ulcère
  respiratoryChecklist TEXT NOT NULL DEFAULT '[]', -- Asthme, BPCO, Insuffisance
  endocrineChecklist TEXT NOT NULL DEFAULT '[]', -- Diabète Type 1/2, Thyroïde
  allergiesChecklist TEXT NOT NULL DEFAULT '[]', -- Pénicilline, Latex, Anesthésique avec adrénaline, AINS
  isPregnantOrNursing INTEGER DEFAULT 0,
  pregnancyMonth INTEGER,
  generalRiskLevel TEXT NOT NULL DEFAULT 'LOW', -- 'LOW', 'MODERATE', 'HIGH', 'CRITICAL'
  doctorNotes TEXT,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_medical_history_patient ON patient_medical_history(patientId);

-- 17. Devis Table (تقديرات الأسعار الرسمية)
CREATE TABLE IF NOT EXISTS devis (
  id TEXT PRIMARY KEY,
  devisNumber TEXT NOT NULL UNIQUE, -- e.g. DEV-2026-0001
  patientId TEXT NOT NULL,
  patientName TEXT NOT NULL,
  dentistName TEXT NOT NULL,
  date TEXT NOT NULL,
  validityDays INTEGER NOT NULL DEFAULT 30,
  totalGrossDA REAL NOT NULL DEFAULT 0.0,
  discountDA REAL NOT NULL DEFAULT 0.0,
  totalNetDA REAL NOT NULL DEFAULT 0.0,
  status TEXT NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'
  notes TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_devis_patient ON devis(patientId);
CREATE INDEX IF NOT EXISTS idx_devis_status ON devis(status);

-- 18. Devis Items Table (بنود وعناصر التقديرات)
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

-- 19. Treatment Projects (مشاريع وخطط العلاج متعددة الجلسات ODF & Implant)
CREATE TABLE IF NOT EXISTS treatment_projects (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL,
  title TEXT NOT NULL, -- e.g. "Orthodontie Bi-maxillaire", "Réhabilitation Implantaire"
  specialty TEXT NOT NULL, -- 'ODF', 'IMPLANT', 'PROTHESE_FIXE'
  status TEXT NOT NULL DEFAULT 'PLANNED', -- 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'SUSPENDED'
  totalPhases INTEGER NOT NULL DEFAULT 1,
  completedPhases INTEGER NOT NULL DEFAULT 0,
  estimatedTotalDA REAL NOT NULL DEFAULT 0.0,
  startDate TEXT,
  targetEndDate TEXT,
  roadmapJson TEXT NOT NULL DEFAULT '[]', -- قائمة الجلسات والخطوات
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_treatment_projects_patient ON treatment_projects(patientId);

-- 20. Medical Lab Tests & Pre-op Bilans (طلبات التحاليل المخبرية والأشعة قبل الجراحة)
CREATE TABLE IF NOT EXISTS lab_test_orders (
  id TEXT PRIMARY KEY,
  orderNumber TEXT NOT NULL UNIQUE, -- e.g. BIL-2026-0001
  patientId TEXT NOT NULL,
  dentistName TEXT NOT NULL,
  requestDate TEXT NOT NULL,
  reason TEXT, -- e.g. "Bilan pré-chirurgical avant avulsion dent de sagesse"
  testsRequestedJson TEXT NOT NULL DEFAULT '[]', -- ['Glycémie à jeun', 'TP/INR', 'FNS', 'Hépatite B/C']
  resultsJson TEXT NOT NULL DEFAULT '{}', -- {'Glycémie': '1.02 g/L', 'INR': '1.10'}
  isCriticalAlert INTEGER DEFAULT 0,
  criticalAlertMessage TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'RECEIVED', 'VALIDATED'
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_lab_test_orders_patient ON lab_test_orders(patientId);
CREATE INDEX IF NOT EXISTS idx_lab_test_orders_status ON lab_test_orders(status);

-- 21. Live Waiting Room Queue (قاعة الانتظار اللحظية)
CREATE TABLE IF NOT EXISTS waiting_room_entries (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL,
  patientName TEXT NOT NULL,
  patientPhone TEXT,
  appointmentId TEXT,
  arrivalTime TEXT NOT NULL,
  calledTime TEXT,
  departureTime TEXT,
  status TEXT NOT NULL DEFAULT 'WAITING', -- 'WAITING', 'IN_CHAIR', 'DONE', 'LEFT'
  isUrgent INTEGER NOT NULL DEFAULT 0, -- شارة مستعجل / موعد سريع
  priorityNote TEXT,
  assignedDentist TEXT,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_waiting_status ON waiting_room_entries(status, arrivalTime);
CREATE INDEX IF NOT EXISTS idx_waiting_patient ON waiting_room_entries(patientId);

-- 22. Patient Radiographies & Imaging (صور الأشعة والـ Radios في ملف المريض)
CREATE TABLE IF NOT EXISTS patient_radios (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL,
  radioType TEXT NOT NULL, -- 'Panoramique', 'Rétro-alvéolaire', 'Scanner 3D', 'Téléradiographie', 'Bitewing'
  toothNumber INTEGER, -- optional tooth number (FDI 11..48) or null
  date TEXT NOT NULL,
  imageData TEXT NOT NULL, -- base64 data URL or file path
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
