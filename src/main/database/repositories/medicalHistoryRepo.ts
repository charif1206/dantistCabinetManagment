import Database from 'better-sqlite3'
import { MedicalAntecedentsRecord, GeneralRiskLevel } from '@shared/types'

export class MedicalHistoryRepository {
  constructor(private db: Database.Database) {}

  getByPatientId(patientId: string): MedicalAntecedentsRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM patient_medical_history
      WHERE patientId = ?
    `)
    const row = stmt.get(patientId) as any
    if (!row) return null

    return {
      id: row.id,
      patientId: row.patientId,
      cardioChecklist: this.parseJsonArray(row.cardioChecklist),
      hematologyChecklist: this.parseJsonArray(row.hematologyChecklist),
      gastroChecklist: this.parseJsonArray(row.gastroChecklist),
      respiratoryChecklist: this.parseJsonArray(row.respiratoryChecklist),
      endocrineChecklist: this.parseJsonArray(row.endocrineChecklist),
      allergiesChecklist: this.parseJsonArray(row.allergiesChecklist),
      isPregnantOrNursing: Boolean(row.isPregnantOrNursing),
      pregnancyMonth: row.pregnancyMonth ?? null,
      generalRiskLevel: (row.generalRiskLevel as GeneralRiskLevel) || 'LOW',
      doctorNotes: row.doctorNotes ?? null,
      updatedAt: row.updatedAt
    }
  }

  save(data: Omit<MedicalAntecedentsRecord, 'id' | 'updatedAt'> & { id?: string }): MedicalAntecedentsRecord {
    const now = new Date().toISOString()
    const existing = this.getByPatientId(data.patientId)
    const id = data.id || existing?.id || `medhist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

    const row = {
      id,
      patientId: data.patientId,
      cardioChecklist: JSON.stringify(data.cardioChecklist || []),
      hematologyChecklist: JSON.stringify(data.hematologyChecklist || []),
      gastroChecklist: JSON.stringify(data.gastroChecklist || []),
      respiratoryChecklist: JSON.stringify(data.respiratoryChecklist || []),
      endocrineChecklist: JSON.stringify(data.endocrineChecklist || []),
      allergiesChecklist: JSON.stringify(data.allergiesChecklist || []),
      isPregnantOrNursing: data.isPregnantOrNursing ? 1 : 0,
      pregnancyMonth: data.pregnancyMonth ?? null,
      generalRiskLevel: data.generalRiskLevel || 'LOW',
      doctorNotes: data.doctorNotes ?? null,
      updatedAt: now
    }

    const stmt = this.db.prepare(`
      INSERT INTO patient_medical_history (
        id, patientId, cardioChecklist, hematologyChecklist, gastroChecklist,
        respiratoryChecklist, endocrineChecklist, allergiesChecklist,
        isPregnantOrNursing, pregnancyMonth, generalRiskLevel, doctorNotes, updatedAt
      ) VALUES (
        @id, @patientId, @cardioChecklist, @hematologyChecklist, @gastroChecklist,
        @respiratoryChecklist, @endocrineChecklist, @allergiesChecklist,
        @isPregnantOrNursing, @pregnancyMonth, @generalRiskLevel, @doctorNotes, @updatedAt
      )
      ON CONFLICT(patientId) DO UPDATE SET
        cardioChecklist = excluded.cardioChecklist,
        hematologyChecklist = excluded.hematologyChecklist,
        gastroChecklist = excluded.gastroChecklist,
        respiratoryChecklist = excluded.respiratoryChecklist,
        endocrineChecklist = excluded.endocrineChecklist,
        allergiesChecklist = excluded.allergiesChecklist,
        isPregnantOrNursing = excluded.isPregnantOrNursing,
        pregnancyMonth = excluded.pregnancyMonth,
        generalRiskLevel = excluded.generalRiskLevel,
        doctorNotes = excluded.doctorNotes,
        updatedAt = excluded.updatedAt
    `)
    stmt.run(row)

    return this.getByPatientId(data.patientId)!
  }

  private parseJsonArray(val: any): string[] {
    if (!val) return []
    if (Array.isArray(val)) return val
    try {
      const parsed = JSON.parse(val)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
}
