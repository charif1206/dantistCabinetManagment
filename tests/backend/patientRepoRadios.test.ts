import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type Database from 'better-sqlite3'
import { createTestDatabase } from '../fixtures/testDb'
import { PatientRepository } from '../../src/main/database/repositories/patientRepo'
import { Patient, PatientRadio } from '../../src/shared/types'

describe('Prompt 8 Backend: PatientRepository Radiographies & Imaging in SQLite', () => {
  let db: Database.Database
  let patientRepo: PatientRepository
  let testPatient: Patient

  beforeEach(() => {
    db = createTestDatabase()
    patientRepo = new PatientRepository(db)
    testPatient = patientRepo.save({
      firstName: 'Amina',
      lastName: 'Haddad',
      phone: '0550112233'
    })
  })

  afterEach(() => {
    if (db && db.open) {
      db.close()
    }
  })

  it('saves and retrieves patient radiographies with metadata and examination type', () => {
    const radioData: Omit<PatientRadio, 'id' | 'createdAt' | 'updatedAt'> = {
      patientId: testPatient.id,
      radioType: 'Panoramique',
      toothNumber: null,
      date: '2026-10-02',
      imageData: 'data:image/png;base64,samplebase64panoramique',
      fileName: 'opg_amina.png',
      fileSize: 2048500,
      notes: 'Bilan panoramique complet avant traitement orthodontique'
    }

    const saved = patientRepo.saveRadio(radioData)
    expect(saved.id).toBeDefined()
    expect(saved.patientId).toBe(testPatient.id)
    expect(saved.radioType).toBe('Panoramique')
    expect(saved.notes).toBe('Bilan panoramique complet avant traitement orthodontique')

    const radios = patientRepo.getRadios(testPatient.id)
    expect(radios.length).toBe(1)
    expect(radios[0].id).toBe(saved.id)
    expect(radios[0].fileName).toBe('opg_amina.png')
    expect(radios[0].fileSize).toBe(2048500)
  })

  it('saves retroactive apical radiography with FDI tooth number and updates it', () => {
    const saved = patientRepo.saveRadio({
      patientId: testPatient.id,
      radioType: 'Rétro-alvéolaire',
      toothNumber: 36,
      date: '2026-10-02',
      imageData: 'data:image/png;base64,retro36',
      notes: 'Apex 36'
    })

    expect(saved.toothNumber).toBe(36)

    // Update notes
    const updated = patientRepo.saveRadio({
      ...saved,
      notes: 'Apex 36 - Contrôle après obturation étanche'
    })

    expect(updated.notes).toBe('Apex 36 - Contrôle après obturation étanche')

    const list = patientRepo.getRadios(testPatient.id)
    expect(list.length).toBe(1)
    expect(list[0].notes).toBe('Apex 36 - Contrôle après obturation étanche')
  })

  it('soft deletes a radiography and verifies it is excluded from getRadios', () => {
    const r1 = patientRepo.saveRadio({
      patientId: testPatient.id,
      radioType: 'Scanner 3D',
      date: '2026-10-01',
      imageData: 'data:image/png;base64,cbct'
    })

    const r2 = patientRepo.saveRadio({
      patientId: testPatient.id,
      radioType: 'Bitewing',
      date: '2026-10-02',
      imageData: 'data:image/png;base64,bitewing'
    })

    expect(patientRepo.getRadios(testPatient.id).length).toBe(2)

    const deleted = patientRepo.deleteRadio(r1.id)
    expect(deleted).toBe(true)

    const remaining = patientRepo.getRadios(testPatient.id)
    expect(remaining.length).toBe(1)
    expect(remaining[0].id).toBe(r2.id)
  })

  it('permanently deletes patient radios when patient permanentDelete is executed', () => {
    patientRepo.saveRadio({
      patientId: testPatient.id,
      radioType: 'Panoramique',
      date: '2026-10-02',
      imageData: 'data:image/png;base64,cbct'
    })

    expect(patientRepo.getRadios(testPatient.id).length).toBe(1)

    patientRepo.permanentDelete(testPatient.id)

    const count = db.prepare('SELECT count(*) as c FROM patient_radios WHERE patientId = ?').get(testPatient.id) as { c: number }
    expect(count.c).toBe(0)
  })
})
