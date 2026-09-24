import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDatabase, seedTestPatient } from './fixtures/testDb'
import { ClinicalRepository } from '../src/main/database/repositories/clinicalRepo'

describe('In-Memory SQLite Database Test Fixture', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createTestDatabase()
  })

  afterEach(() => {
    if (db && db.open) {
      db.close()
    }
  })

  it('initializes in-memory database with all master schema tables', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
      .all() as { name: string }[]
    const tableNames = tables.map((t) => t.name)

    // Master tables
    expect(tableNames).toContain('users')
    expect(tableNames).toContain('patients')
    expect(tableNames).toContain('appointments')
    expect(tableNames).toContain('medical_acts')
    expect(tableNames).toContain('dental_chart_records')
    expect(tableNames).toContain('treatments')
    expect(tableNames).toContain('clinical_notes')
    expect(tableNames).toContain('invoices')
    expect(tableNames).toContain('payments')
    expect(tableNames).toContain('prescriptions')

    // Added modules
    expect(tableNames).toContain('drugs_catalog')
    expect(tableNames).toContain('prescription_templates')
    expect(tableNames).toContain('prosthetic_laboratories')
    expect(tableNames).toContain('prothesis_orders')
    expect(tableNames).toContain('patient_medical_history')
    expect(tableNames).toContain('devis')
    expect(tableNames).toContain('devis_items')
    expect(tableNames).toContain('treatment_projects')
    expect(tableNames).toContain('lab_test_orders')
    expect(tableNames).toContain('waiting_room_entries')
  })

  it('can seed and query patients in memory', () => {
    const patient = seedTestPatient(db, {
      firstName: 'Youcef',
      lastName: 'Belaili',
      phone: '0560987654',
      wilaya: 'Oran'
    })

    const row = db.prepare('SELECT * FROM patients WHERE id = ?').get(patient.id) as any
    expect(row).toBeDefined()
    expect(row.firstName).toBe('Youcef')
    expect(row.lastName).toBe('Belaili')
    expect(row.wilaya).toBe('Oran')
  })

  it('works seamlessly with ClinicalRepository', () => {
    const patient = seedTestPatient(db)
    const clinicalRepo = new ClinicalRepository(db)

    // Save tooth record
    clinicalRepo.saveToothRecord({
      patientId: patient.id,
      toothNumber: 16,
      condition: 'CARIES',
      surfaces: 'MOD',
      notes: 'Caries occlusale profonde'
    })

    const records = clinicalRepo.getToothRecords(patient.id)
    expect(records.length).toBe(1)
    expect(records[0].toothNumber).toBe(16)
    expect(records[0].condition).toBe('CARIES')
  })
})
