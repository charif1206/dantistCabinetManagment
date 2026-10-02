import Database from 'better-sqlite3'
import { DrugItem, PrescriptionTemplate } from '@shared/types'

export class DrugsRepository {
  constructor(private db: Database.Database) {}

  getAll(search?: string, category?: string): DrugItem[] {
    let query = 'SELECT * FROM drugs_catalog WHERE 1=1'
    const params: (string | number)[] = []

    if (category && category !== 'ALL') {
      query += ' AND category = ?'
      params.push(category)
    }

    if (search && search.trim().length > 0) {
      query += ' AND (brandName LIKE ? OR genericName LIKE ?)'
      const term = `%${search.trim()}%`
      params.push(term, term)
    }

    query += ' ORDER BY brandName ASC'

    const stmt = this.db.prepare(query)
    return stmt.all(...params) as DrugItem[]
  }

  getById(id: string): DrugItem | null {
    const stmt = this.db.prepare('SELECT * FROM drugs_catalog WHERE id = ?')
    const row = stmt.get(id)
    return (row as DrugItem) || null
  }

  save(data: Omit<DrugItem, 'id' | 'createdAt'> & { id?: string }): DrugItem {
    const now = new Date().toISOString()
    const id = data.id || `drug_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const isNew = !data.id || !this.getById(id)

    if (isNew) {
      const drug: DrugItem = {
        ...data,
        id,
        isCustom: data.isCustom !== undefined ? data.isCustom : 1,
        createdAt: now
      }

      const stmt = this.db.prepare(`
        INSERT INTO drugs_catalog (id, brandName, genericName, dosage, form, defaultInstructions, category, isCustom, createdAt)
        VALUES (@id, @brandName, @genericName, @dosage, @form, @defaultInstructions, @category, @isCustom, @createdAt)
      `)
      stmt.run(drug)
      return drug
    } else {
      const stmt = this.db.prepare(`
        UPDATE drugs_catalog
        SET brandName = @brandName,
            genericName = @genericName,
            dosage = @dosage,
            form = @form,
            defaultInstructions = @defaultInstructions,
            category = @category,
            isCustom = @isCustom
        WHERE id = @id
      `)
      stmt.run({
        ...data,
        id,
        isCustom: data.isCustom !== undefined ? data.isCustom : 0
      })

      return this.getById(id)!
    }
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM drugs_catalog WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  // Prescription Templates (Ordonnances Types)
  getTemplates(search?: string): PrescriptionTemplate[] {
    let query = 'SELECT * FROM prescription_templates WHERE 1=1'
    const params: string[] = []

    if (search && search.trim().length > 0) {
      query += ' AND (title LIKE ? OR diagnosisHint LIKE ?)'
      const term = `%${search.trim()}%`
      params.push(term, term)
    }

    query += ' ORDER BY title ASC'

    const stmt = this.db.prepare(query)
    return stmt.all(...params) as PrescriptionTemplate[]
  }

  getTemplateById(id: string): PrescriptionTemplate | null {
    const stmt = this.db.prepare('SELECT * FROM prescription_templates WHERE id = ?')
    const row = stmt.get(id)
    return (row as PrescriptionTemplate) || null
  }

  saveTemplate(data: Omit<PrescriptionTemplate, 'id' | 'createdAt'> & { id?: string }): PrescriptionTemplate {
    const now = new Date().toISOString()
    const id = data.id || `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const isNew = !data.id || !this.getTemplateById(id)

    if (isNew) {
      const template: PrescriptionTemplate = {
        ...data,
        id,
        createdAt: now
      }

      const stmt = this.db.prepare(`
        INSERT INTO prescription_templates (id, title, diagnosisHint, itemsJson, createdAt)
        VALUES (@id, @title, @diagnosisHint, @itemsJson, @createdAt)
      `)
      stmt.run(template)
      return template
    } else {
      const stmt = this.db.prepare(`
        UPDATE prescription_templates
        SET title = @title,
            diagnosisHint = @diagnosisHint,
            itemsJson = @itemsJson
        WHERE id = @id
      `)
      stmt.run({
        ...data,
        id
      })
      return this.getTemplateById(id)!
    }
  }

  deleteTemplate(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM prescription_templates WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  // Prescriptions Management
  deletePrescription(id: string): boolean {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM prescription_items WHERE prescriptionId = ?').run(id)
      const result = this.db.prepare('DELETE FROM prescriptions WHERE id = ?').run(id)
      return result.changes > 0
    })
    return tx()
  }
}

