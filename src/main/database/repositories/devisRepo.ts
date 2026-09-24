import Database from 'better-sqlite3'
import { Devis, DevisItem, DevisStatus, TreatmentProject } from '@shared/types'

export class DevisRepository {
  constructor(private db: Database.Database) {}

  // 1. Devis (Quotations)
  private generateDevisNumber(): string {
    const year = new Date().getFullYear()
    const row = this.db.prepare('SELECT count(*) as count FROM devis').get() as { count: number }
    const nextSeq = (row?.count || 0) + 1
    return `DEV-${year}-${String(nextSeq).padStart(4, '0')}`
  }

  getAll(patientId?: string): Devis[] {
    let query = 'SELECT * FROM devis WHERE deletedAt IS NULL'
    const params: string[] = []

    if (patientId) {
      query += ' AND patientId = ?'
      params.push(patientId)
    }

    query += ' ORDER BY date DESC, createdAt DESC'
    const devisList = this.db.prepare(query).all(...params) as Devis[]

    const getItemsStmt = this.db.prepare('SELECT * FROM devis_items WHERE devisId = ?')
    return devisList.map((d) => ({
      ...d,
      items: getItemsStmt.all(d.id) as DevisItem[]
    }))
  }

  getById(id: string): Devis | null {
    const stmt = this.db.prepare('SELECT * FROM devis WHERE id = ? AND deletedAt IS NULL')
    const row = stmt.get(id) as Devis | undefined
    if (!row) return null

    const items = this.db.prepare('SELECT * FROM devis_items WHERE devisId = ?').all(id) as DevisItem[]
    return {
      ...row,
      items
    }
  }

  save(
    devisData: Omit<Devis, 'id' | 'devisNumber' | 'createdAt' | 'updatedAt' | 'items'> & {
      id?: string
      devisNumber?: string
    },
    items: Omit<DevisItem, 'id' | 'devisId'>[]
  ): Devis {
    const now = new Date().toISOString()
    const id = devisData.id || `dev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const isNew = !devisData.id || !this.getById(id)

    const transaction = this.db.transaction(() => {
      if (isNew) {
        const devisNumber = devisData.devisNumber || this.generateDevisNumber()
        const stmt = this.db.prepare(`
          INSERT INTO devis (
            id, devisNumber, patientId, patientName, dentistName, date,
            validityDays, totalGrossDA, discountDA, totalNetDA, status, notes,
            createdAt, updatedAt
          ) VALUES (
            @id, @devisNumber, @patientId, @patientName, @dentistName, @date,
            @validityDays, @totalGrossDA, @discountDA, @totalNetDA, @status, @notes,
            @createdAt, @updatedAt
          )
        `)
        stmt.run({
          id,
          devisNumber,
          patientId: devisData.patientId,
          patientName: devisData.patientName,
          dentistName: devisData.dentistName,
          date: devisData.date,
          validityDays: devisData.validityDays || 30,
          totalGrossDA: Number(devisData.totalGrossDA) || 0,
          discountDA: Number(devisData.discountDA) || 0,
          totalNetDA: Number(devisData.totalNetDA) || 0,
          status: devisData.status || 'DRAFT',
          notes: devisData.notes ?? null,
          createdAt: now,
          updatedAt: now
        })
      } else {
        const stmt = this.db.prepare(`
          UPDATE devis
          SET patientId = @patientId,
              patientName = @patientName,
              dentistName = @dentistName,
              date = @date,
              validityDays = @validityDays,
              totalGrossDA = @totalGrossDA,
              discountDA = @discountDA,
              totalNetDA = @totalNetDA,
              status = @status,
              notes = @notes,
              updatedAt = @updatedAt
          WHERE id = @id
        `)
        stmt.run({
          id,
          patientId: devisData.patientId,
          patientName: devisData.patientName,
          dentistName: devisData.dentistName,
          date: devisData.date,
          validityDays: devisData.validityDays || 30,
          totalGrossDA: Number(devisData.totalGrossDA) || 0,
          discountDA: Number(devisData.discountDA) || 0,
          totalNetDA: Number(devisData.totalNetDA) || 0,
          status: devisData.status,
          notes: devisData.notes ?? null,
          updatedAt: now
        })

        // Clear existing items for update
        this.db.prepare('DELETE FROM devis_items WHERE devisId = ?').run(id)
      }

      // Insert new items
      const insertItemStmt = this.db.prepare(`
        INSERT INTO devis_items (id, devisId, actId, actName, specialty, toothNumber, quantity, unitPriceDA, totalPriceDA)
        VALUES (@id, @devisId, @actId, @actName, @specialty, @toothNumber, @quantity, @unitPriceDA, @totalPriceDA)
      `)

      for (const item of items) {
        const itemId = `devitem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        insertItemStmt.run({
          id: itemId,
          devisId: id,
          actId: item.actId ?? null,
          actName: item.actName,
          specialty: item.specialty,
          toothNumber: item.toothNumber ?? null,
          quantity: item.quantity || 1,
          unitPriceDA: Number(item.unitPriceDA) || 0,
          totalPriceDA: Number(item.totalPriceDA) || 0
        })
      }
    })

    transaction()
    return this.getById(id)!
  }

  updateStatus(id: string, status: DevisStatus): boolean {
    const now = new Date().toISOString()
    const stmt = this.db.prepare(`
      UPDATE devis
      SET status = ?, updatedAt = ?
      WHERE id = ?
    `)
    const result = stmt.run(status, now, id)
    return result.changes > 0
  }

  delete(id: string): boolean {
    const now = new Date().toISOString()
    const stmt = this.db.prepare(`
      UPDATE devis
      SET deletedAt = ?
      WHERE id = ?
    `)
    const result = stmt.run(now, id)
    return result.changes > 0
  }

  convertToTreatments(devisId: string): { success: boolean; createdTreatmentsCount: number } {
    const devis = this.getById(devisId)
    if (!devis) {
      return { success: false, createdTreatmentsCount: 0 }
    }

    const items = devis.items || []
    if (items.length === 0) {
      return { success: false, createdTreatmentsCount: 0 }
    }

    const now = new Date().toISOString()
    const today = now.split('T')[0]

    const insertTreatmentStmt = this.db.prepare(`
      INSERT INTO treatments (
        id, patientId, toothNumber, actId, actName, price, status,
        date, notes, dentistName, createdAt, updatedAt, syncStatus
      ) VALUES (
        @id, @patientId, @toothNumber, @actId, @actName, @price, @status,
        @date, @notes, @dentistName, @createdAt, @updatedAt, 'pending'
      )
    `)

    let createdCount = 0
    const convertTransaction = this.db.transaction(() => {
      for (const item of items) {
        const treatmentId = `trt_dev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        insertTreatmentStmt.run({
          id: treatmentId,
          patientId: devis.patientId,
          toothNumber: item.toothNumber ?? null,
          actId: item.actId ?? null,
          actName: item.actName,
          price: item.totalPriceDA,
          status: 'PLANNED',
          date: today,
          notes: `Issu du devis N° ${devis.devisNumber}`,
          dentistName: devis.dentistName,
          createdAt: now,
          updatedAt: now
        })
        createdCount++
      }

      // Mark Devis as ACCEPTED
      this.db.prepare(`UPDATE devis SET status = 'ACCEPTED', updatedAt = ? WHERE id = ?`).run(now, devisId)
    })

    convertTransaction()
    return { success: true, createdTreatmentsCount: createdCount }
  }

  // 2. Treatment Projects (ODF / Implant Multi-session Roadmaps)
  getProjects(patientId?: string): TreatmentProject[] {
    let query = 'SELECT * FROM treatment_projects WHERE 1=1'
    const params: string[] = []

    if (patientId) {
      query += ' AND patientId = ?'
      params.push(patientId)
    }

    query += ' ORDER BY createdAt DESC'
    return this.db.prepare(query).all(...params) as TreatmentProject[]
  }

  getProjectById(id: string): TreatmentProject | null {
    const stmt = this.db.prepare('SELECT * FROM treatment_projects WHERE id = ?')
    const row = stmt.get(id)
    return (row as TreatmentProject) || null
  }

  saveProject(
    data: Omit<TreatmentProject, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): TreatmentProject {
    const now = new Date().toISOString()
    const id = data.id || `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const isNew = !data.id || !this.getProjectById(id)

    if (isNew) {
      const record: TreatmentProject = {
        id,
        patientId: data.patientId,
        title: data.title,
        specialty: data.specialty,
        status: data.status || 'PLANNED',
        totalPhases: data.totalPhases || 1,
        completedPhases: data.completedPhases || 0,
        estimatedTotalDA: Number(data.estimatedTotalDA) || 0,
        startDate: data.startDate ?? null,
        targetEndDate: data.targetEndDate ?? null,
        roadmapJson: typeof data.roadmapJson === 'string' ? data.roadmapJson : JSON.stringify(data.roadmapJson || []),
        createdAt: now,
        updatedAt: now
      }

      const stmt = this.db.prepare(`
        INSERT INTO treatment_projects (
          id, patientId, title, specialty, status, totalPhases,
          completedPhases, estimatedTotalDA, startDate, targetEndDate,
          roadmapJson, createdAt, updatedAt
        ) VALUES (
          @id, @patientId, @title, @specialty, @status, @totalPhases,
          @completedPhases, @estimatedTotalDA, @startDate, @targetEndDate,
          @roadmapJson, @createdAt, @updatedAt
        )
      `)
      stmt.run(record)
      return record
    } else {
      const stmt = this.db.prepare(`
        UPDATE treatment_projects
        SET title = @title,
            specialty = @specialty,
            status = @status,
            totalPhases = @totalPhases,
            completedPhases = @completedPhases,
            estimatedTotalDA = @estimatedTotalDA,
            startDate = @startDate,
            targetEndDate = @targetEndDate,
            roadmapJson = @roadmapJson,
            updatedAt = @updatedAt
        WHERE id = @id
      `)
      stmt.run({
        id,
        title: data.title,
        specialty: data.specialty,
        status: data.status,
        totalPhases: data.totalPhases,
        completedPhases: data.completedPhases,
        estimatedTotalDA: Number(data.estimatedTotalDA) || 0,
        startDate: data.startDate ?? null,
        targetEndDate: data.targetEndDate ?? null,
        roadmapJson: typeof data.roadmapJson === 'string' ? data.roadmapJson : JSON.stringify(data.roadmapJson || []),
        updatedAt: now
      })
      return this.getProjectById(id)!
    }
  }

  deleteProject(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM treatment_projects WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }
}
