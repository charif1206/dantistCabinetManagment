import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDatabase } from '../fixtures/testDb'
import { DrugsRepository } from '../../src/main/database/repositories/drugsRepo'

describe('DrugsRepository & Algerian Dental Pharmacopeia - SQLite Integration', () => {
  let db: Database.Database
  let drugsRepo: DrugsRepository

  beforeEach(() => {
    // Initialize in-memory database with initial seeds populated
    db = createTestDatabase(true)
    drugsRepo = new DrugsRepository(db)
  })

  afterEach(() => {
    if (db && db.open) {
      db.close()
    }
  })

  describe('1. Initial Seeding Engine (drugs_catalog)', () => {
    it('verifies that the 5 foundational Algerian dental medicines are properly seeded', () => {
      const allDrugs = drugsRepo.getAll()
      expect(allDrugs.length).toBeGreaterThanOrEqual(5)

      // 1. Amoxicilline 1g (Comprimé)
      const amox = allDrugs.find(
        (d) => d.brandName.toLowerCase().includes('amoxicilline') && d.dosage === '1g'
      )
      expect(amox).toBeDefined()
      expect(amox?.form).toBe('Comprimé')
      expect(amox?.category).toBe('Antibiotique')
      expect(amox?.isCustom).toBe(0)

      // 2. Bi-Rodogyl (Spiramycine / Métronidazole)
      const birodogyl = allDrugs.find((d) => d.brandName.toLowerCase().includes('bi-rodogyl'))
      expect(birodogyl).toBeDefined()
      expect(birodogyl?.genericName).toContain('Spiramycine')
      expect(birodogyl?.genericName).toContain('Métronidazole')
      expect(birodogyl?.category).toBe('Antibiotique')

      // 3. Paracétamol 1g
      const paracetamol = allDrugs.find(
        (d) => d.brandName.toLowerCase().includes('paracétamol') && d.dosage === '1g'
      )
      expect(paracetamol).toBeDefined()
      expect(paracetamol?.form).toBe('Comprimé')
      expect(paracetamol?.category).toBe('Antalgique')

      // 4. Ibuprofène 400mg
      const ibuprofene = allDrugs.find(
        (d) => d.brandName.toLowerCase().includes('ibuprofène') && d.dosage === '400mg'
      )
      expect(ibuprofene).toBeDefined()
      expect(ibuprofene?.category).toBe('Anti-inflammatoire')
      expect(ibuprofene?.form).toBe('Comprimé')

      // 5. Bain de bouche Chlorhexidine 0.12%
      const bainBouche = allDrugs.find(
        (d) =>
          d.brandName.toLowerCase().includes('chlorhexidine') ||
          d.genericName?.toLowerCase().includes('chlorhexidine')
      )
      expect(bainBouche).toBeDefined()
      expect(bainBouche?.dosage).toBe('0.12%')
      expect(bainBouche?.category).toBe('Bain de bouche')
    })
  })

  describe('2. CRUD Operations & Fast Search', () => {
    it('performs fast search using keyword "Amox" and retrieves the drug with dosage and default instructions', () => {
      const results = drugsRepo.getAll('Amox')
      expect(results.length).toBeGreaterThanOrEqual(1)

      const drug = results[0]
      expect(drug.brandName).toContain('Amoxicilline')
      expect(drug.dosage).toBe('1g')
      expect(drug.defaultInstructions).toBeTruthy()
      expect(drug.defaultInstructions).toContain('matin et soir')
    })

    it('filters drugs catalog by category (e.g. Antibiotique, Antalgique)', () => {
      const antibiotics = drugsRepo.getAll(undefined, 'Antibiotique')
      expect(antibiotics.length).toBeGreaterThanOrEqual(2)
      for (const item of antibiotics) {
        expect(item.category).toBe('Antibiotique')
      }

      const analgesics = drugsRepo.getAll(undefined, 'Antalgique')
      expect(analgesics.length).toBeGreaterThanOrEqual(1)
      expect(analgesics.some((d) => d.brandName === 'Paracétamol')).toBe(true)
    })

    it('saves a new custom drug with isCustom = 1 and retrieves it by id', () => {
      const newCustomDrug = drugsRepo.save({
        brandName: 'Kétoprofène Biocare',
        genericName: 'Kétoprofène',
        dosage: '100mg',
        form: 'Gélule',
        defaultInstructions: '1 gélule midi et soir au cours du repas',
        category: 'Anti-inflammatoire',
        isCustom: 1
      })

      expect(newCustomDrug.id).toBeDefined()
      expect(newCustomDrug.isCustom).toBe(1)
      expect(newCustomDrug.createdAt).toBeDefined()

      const fetched = drugsRepo.getById(newCustomDrug.id)
      expect(fetched).not.toBeNull()
      expect(fetched?.brandName).toBe('Kétoprofène Biocare')
      expect(fetched?.isCustom).toBe(1)
      expect(fetched?.dosage).toBe('100mg')
    })

    it('updates an existing drug item in the catalog', () => {
      const drug = drugsRepo.save({
        brandName: 'Tramadol DZ',
        genericName: 'Tramadol chlorhydrate',
        dosage: '50mg',
        form: 'Gélule',
        defaultInstructions: 'En cas de douleur intense',
        category: 'Antalgique',
        isCustom: 1
      })

      const updated = drugsRepo.save({
        id: drug.id,
        brandName: 'Tramadol DZ Forte',
        genericName: 'Tramadol chlorhydrate',
        dosage: '100mg',
        form: 'Gélule',
        defaultInstructions: '1 gélule maximum 2 fois par jour',
        category: 'Antalgique',
        isCustom: 1
      })

      expect(updated.id).toBe(drug.id)
      expect(updated.brandName).toBe('Tramadol DZ Forte')
      expect(updated.dosage).toBe('100mg')

      const reloaded = drugsRepo.getById(drug.id)
      expect(reloaded?.brandName).toBe('Tramadol DZ Forte')
    })

    it('deletes a custom drug from the catalog', () => {
      const drug = drugsRepo.save({
        brandName: 'TempDrug',
        dosage: '10mg',
        form: 'Comprimé',
        category: 'Autre',
        isCustom: 1
      })

      expect(drugsRepo.getById(drug.id)).not.toBeNull()

      const deleted = drugsRepo.delete(drug.id)
      expect(deleted).toBe(true)
      expect(drugsRepo.getById(drug.id)).toBeNull()
    })
  })

  describe('3. Prescription Templates (Ordonnances Types)', () => {
    it('saves a template named "Suite d\'avulsion chirurgicale" containing antibiotic and analgesic, then decodes itemsJson properly', () => {
      const templateItems = [
        {
          medicineName: 'Bi-Rodogyl',
          genericName: 'Spiramycine / Métronidazole',
          dosage: '1.5 MUI / 250 mg',
          form: 'Comprimé',
          instructions: '1 cp 3 fois par jour au cours des repas pendant 6 jours'
        },
        {
          medicineName: 'Paracétamol',
          genericName: 'Paracétamol',
          dosage: '1g',
          form: 'Comprimé',
          instructions: '1 cp toutes les 6 heures en cas de douleur'
        },
        {
          medicineName: 'Bain de bouche Chlorhexidine',
          genericName: 'Chlorhexidine',
          dosage: '0.12%',
          form: 'Flacon',
          instructions: 'Bains de bouche tièdes 3 fois par jour dès le lendemain'
        }
      ]

      const savedTemplate = drugsRepo.saveTemplate({
        title: "Suite d'avulsion chirurgicale",
        diagnosisHint: 'Extraction chirurgicale de dents de sagesse incluses ou germectomie',
        itemsJson: JSON.stringify(templateItems)
      })

      expect(savedTemplate.id).toBeDefined()
      expect(savedTemplate.title).toBe("Suite d'avulsion chirurgicale")

      // Retrieve by ID
      const fetched = drugsRepo.getTemplateById(savedTemplate.id)
      expect(fetched).not.toBeNull()
      expect(fetched?.title).toBe("Suite d'avulsion chirurgicale")

      // Parse itemsJson array
      const parsedItems = JSON.parse(fetched!.itemsJson)
      expect(Array.isArray(parsedItems)).toBe(true)
      expect(parsedItems).toHaveLength(3)

      // Verify antibiotic item
      const antibiotic = parsedItems.find((i: any) => i.medicineName === 'Bi-Rodogyl')
      expect(antibiotic).toBeDefined()
      expect(antibiotic.dosage).toBe('1.5 MUI / 250 mg')

      // Verify analgesic item
      const analgesic = parsedItems.find((i: any) => i.medicineName === 'Paracétamol')
      expect(analgesic).toBeDefined()
      expect(analgesic.dosage).toBe('1g')
    })

    it('searches templates by title keyword', () => {
      const searchResults = drugsRepo.getTemplates('avulsion')
      expect(searchResults.length).toBeGreaterThanOrEqual(1)
      expect(searchResults[0].title.toLowerCase()).toContain('avulsion')
    })

    it('deletes a prescription template', () => {
      const template = drugsRepo.saveTemplate({
        title: 'Modèle temporaire à supprimer',
        itemsJson: '[]'
      })

      expect(drugsRepo.getTemplateById(template.id)).not.toBeNull()
      const success = drugsRepo.deleteTemplate(template.id)
      expect(success).toBe(true)
      expect(drugsRepo.getTemplateById(template.id)).toBeNull()
    })

    it('deletes an entire prescription and its child items permanently from SQLite', () => {
      // Find an existing patient for foreign key integrity
      const existingPatient = db.prepare('SELECT id FROM patients LIMIT 1').get() as { id: string }
      const patientId = existingPatient ? existingPatient.id : 'pat-del-temp'

      if (!existingPatient) {
        db.prepare(`
          INSERT INTO patients (id, patientNumber, firstName, lastName, phone, createdAt, updatedAt)
          VALUES ('pat-del-temp', 'DZ-TEMP-01', 'Test', 'Patient', '0555000000', '2026-10-02', '2026-10-02')
        `).run()
      }

      // Insert a dummy prescription directly
      db.prepare(`
        INSERT INTO prescriptions (id, patientId, patientName, dentistName, date, createdAt, updatedAt)
        VALUES ('presc-del-test', ?, 'Test Patient', 'Dr. Amrani', '2026-10-02', '2026-10-02', '2026-10-02')
      `).run(patientId)

      db.prepare(`
        INSERT INTO prescription_items (id, prescriptionId, medicineName, dosage, form, instructions)
        VALUES ('item-del-test', 'presc-del-test', 'Amoxicilline', '1g', 'Comprimé', '1 cp matin et soir')
      `).run()

      // Verify insertion
      const prescBefore = db.prepare('SELECT * FROM prescriptions WHERE id = ?').get('presc-del-test')
      const itemBefore = db.prepare('SELECT * FROM prescription_items WHERE prescriptionId = ?').get('presc-del-test')
      expect(prescBefore).toBeDefined()
      expect(itemBefore).toBeDefined()

      // Delete via repository
      const deleted = drugsRepo.deletePrescription('presc-del-test')
      expect(deleted).toBe(true)

      // Verify permanent removal
      const prescAfter = db.prepare('SELECT * FROM prescriptions WHERE id = ?').get('presc-del-test')
      const itemAfter = db.prepare('SELECT * FROM prescription_items WHERE prescriptionId = ?').get('presc-del-test')
      expect(prescAfter).toBeUndefined()
      expect(itemAfter).toBeUndefined()
    })
  })
})
