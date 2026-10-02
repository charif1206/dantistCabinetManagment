import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDatabase, seedTestPatient } from '../fixtures/testDb'
import { AdvancedStatsRepository } from '../../src/main/database/repositories/advancedStatsRepo'

describe('AdvancedStatsRepository - Clinical Analytics & Specialty Distribution', () => {
  let db: Database.Database
  let statsRepo: AdvancedStatsRepository

  beforeEach(() => {
    db = createTestDatabase(true) // With seeded medical acts
    statsRepo = new AdvancedStatsRepository(db)
  })

  afterEach(() => {
    if (db && db.open) {
      db.close()
    }
  })

  it('calculates getSpecialtyDistribution without SQL errors when joining medical_acts', () => {
    const patient = seedTestPatient(db, {
      firstName: 'Karim',
      lastName: 'Benzema',
      phone: '0555998877'
    })

    const now = new Date().toISOString()
    // Insert treatments linked to acts
    const insertTreatment = db.prepare(`
      INSERT INTO treatments (id, patientId, toothNumber, actId, actName, price, status, date, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED', '2026-10-01', ?, ?)
    `)

    // ODF act
    insertTreatment.run('trt_1', patient.id, 11, 'act_odf_01', 'Pose brackets', 80000, now, now)
    // IMPLANT act
    insertTreatment.run('trt_2', patient.id, 26, 'act_imp_01', 'Pose implant titane', 60000, now, now)
    // Treatment without actId (fallback)
    insertTreatment.run('trt_3', patient.id, 36, null, 'Soin divers', 5000, now, now)

    const distribution = statsRepo.getSpecialtyDistribution()

    expect(Array.isArray(distribution)).toBe(true)
    expect(distribution.length).toBeGreaterThanOrEqual(3)

    const odfItem = distribution.find((d) => d.specialty === 'ODF')
    expect(odfItem).toBeDefined()
    expect(odfItem?.revenueDA).toBe(80000)
    expect(odfItem?.label).toBe('Orthodontie (ODF)')

    const impItem = distribution.find((d) => d.specialty === 'IMPLANT')
    expect(impItem).toBeDefined()
    expect(impItem?.revenueDA).toBe(60000)
    expect(impItem?.label).toBe('Implantologie')

    const fallbackItem = distribution.find((d) => d.specialty === 'SOINS')
    expect(fallbackItem).toBeDefined()
    expect(fallbackItem?.revenueDA).toBe(5000)
  })

  it('retrieves overview stats properly', () => {
    const overview = statsRepo.getOverview()
    expect(overview).toHaveProperty('noShowRate')
    expect(overview).toHaveProperty('totalAppointments')
    expect(overview).toHaveProperty('totalRevenueDA')
  })
})
