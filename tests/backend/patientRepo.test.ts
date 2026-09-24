import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDatabase } from '../fixtures/testDb'
import { PatientRepository } from '../../src/main/database/repositories/patientRepo'

describe('PatientRepository - Backend & SQLite Integration', () => {
  let db: Database.Database
  let patientRepo: PatientRepository

  beforeEach(() => {
    db = createTestDatabase()
    patientRepo = new PatientRepository(db)
  })

  afterEach(() => {
    if (db && db.open) {
      db.close()
    }
  })

  describe('1. Automatic Patient Number Generation', () => {
    it('creates a new patient and automatically generates sequential patient number (DZ-YYYY-XXXX)', () => {
      const year = new Date().getFullYear()

      const patient1 = patientRepo.save({
        firstName: 'Karim',
        lastName: 'Boudiaf',
        phone: '0550112233',
        wilaya: 'Alger'
      })

      expect(patient1.id).toBeDefined()
      expect(patient1.patientNumber).toBe(`DZ-${year}-0001`)
      expect(patient1.firstName).toBe('Karim')
      expect(patient1.lastName).toBe('Boudiaf')
      expect(patient1.syncStatus).toBe('pending')

      const patient2 = patientRepo.save({
        firstName: 'Fatima',
        lastName: 'Zahra',
        phone: '0661223344',
        wilaya: 'Oran'
      })

      expect(patient2.id).toBeDefined()
      expect(patient2.patientNumber).toBe(`DZ-${year}-0002`)
    })

    it('respects explicitly provided patient number if specified', () => {
      const customPatient = patientRepo.save({
        firstName: 'Nabil',
        lastName: 'Saadi',
        phone: '0770334455',
        patientNumber: 'DZ-2025-9999',
        wilaya: 'Constantine'
      })

      expect(customPatient.patientNumber).toBe('DZ-2025-9999')
    })
  })

  describe('2. Multi-Criteria Patient Search', () => {
    beforeEach(() => {
      // Seed 4 patients across different Algerian wilayas, names, phones, and CINs
      patientRepo.save({
        firstName: 'Amine',
        lastName: 'Mansouri',
        phone: '0551000001',
        cin: '160012345678',
        wilaya: 'Alger'
      })

      patientRepo.save({
        firstName: 'Samia',
        lastName: 'Belkacem',
        phone: '0662000002',
        cin: '310087654321',
        wilaya: 'Oran'
      })

      patientRepo.save({
        firstName: 'Rachid',
        lastName: 'Derridj',
        phone: '0773000003',
        cin: '250055443322',
        wilaya: 'Constantine'
      })

      patientRepo.save({
        firstName: 'Yasmine',
        lastName: 'Khelifi',
        phone: '0544000004',
        cin: '190099887766',
        wilaya: 'Sétif'
      })
    })

    it('searches by patient first name or last name', () => {
      const resultsByName = patientRepo.getAll('Amine')
      expect(resultsByName).toHaveLength(1)
      expect(resultsByName[0].lastName).toBe('Mansouri')

      const resultsByLastName = patientRepo.getAll('Belkacem')
      expect(resultsByLastName).toHaveLength(1)
      expect(resultsByLastName[0].firstName).toBe('Samia')
    })

    it('searches by phone number', () => {
      const resultsByPhone = patientRepo.getAll('0773000003')
      expect(resultsByPhone).toHaveLength(1)
      expect(resultsByPhone[0].firstName).toBe('Rachid')
    })

    it('searches by national identity card (CIN)', () => {
      const resultsByCin = patientRepo.getAll('190099887766')
      expect(resultsByCin).toHaveLength(1)
      expect(resultsByCin[0].firstName).toBe('Yasmine')
      expect(resultsByCin[0].wilaya).toBe('Sétif')
    })

    it('searches by Algerian Wilaya (e.g., Oran, Constantine, Sétif)', () => {
      const resultsOran = patientRepo.getAll('Oran')
      expect(resultsOran).toHaveLength(1)
      expect(resultsOran[0].firstName).toBe('Samia')

      const resultsSetif = patientRepo.getAll('Sétif')
      expect(resultsSetif).toHaveLength(1)
      expect(resultsSetif[0].firstName).toBe('Yasmine')
    })

    it('returns empty array when search query matches no patient', () => {
      const noResults = patientRepo.getAll('NonExistentPatient')
      expect(noResults).toHaveLength(0)
    })
  })

  describe('3. Preventing Duplicate Phone Numbers', () => {
    it('throws an explicit error when attempting to insert a patient with an existing phone number', () => {
      patientRepo.save({
        firstName: 'Walid',
        lastName: 'Zidane',
        phone: '0555998877',
        wilaya: 'Blida'
      })

      // Attempting to create another patient with the exact same phone number
      expect(() => {
        patientRepo.save({
          firstName: 'Omar',
          lastName: 'Mebarek',
          phone: '0555998877',
          wilaya: 'Tipaza'
        })
      }).toThrow('Ce numéro de téléphone existe déjà pour un autre patient.')

      // Also blocks formatted equivalent (spaces or dashes)
      expect(() => {
        patientRepo.save({
          firstName: 'Farid',
          lastName: 'Hadj',
          phone: '05 55 99 88 77',
          wilaya: 'Alger'
        })
      }).toThrow('Ce numéro de téléphone existe déjà pour un autre patient.')
    })

    it('allows updating an existing patient without triggering self-duplicate phone error', () => {
      const patient = patientRepo.save({
        firstName: 'Khadidja',
        lastName: 'Benyahia',
        phone: '0666112233',
        wilaya: 'Tlemcen'
      })

      // Updating other fields while keeping same phone
      const updated = patientRepo.save({
        id: patient.id,
        firstName: 'Khadidja Leila',
        lastName: 'Benyahia',
        phone: '0666112233',
        address: 'Centre-Ville Tlemcen'
      })

      expect(updated.firstName).toBe('Khadidja Leila')
      expect(updated.phone).toBe('0666112233')
      expect(updated.address).toBe('Centre-Ville Tlemcen')
    })

    it('allows reusing a phone number if the previous patient was soft-deleted', () => {
      const patient1 = patientRepo.save({
        firstName: 'Anis',
        lastName: 'Boumaza',
        phone: '0777445566',
        wilaya: 'Annaba'
      })

      // Soft delete patient1
      patientRepo.delete(patient1.id)
      expect(patientRepo.getById(patient1.id)).toBeNull()

      // Saving a new patient with the same phone must succeed
      const patient2 = patientRepo.save({
        firstName: 'Chafik',
        lastName: 'Touati',
        phone: '0777445566',
        wilaya: 'Guelma'
      })

      expect(patient2.id).toBeDefined()
      expect(patient2.firstName).toBe('Chafik')
    })
  })
})
