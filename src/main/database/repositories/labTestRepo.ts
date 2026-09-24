import Database from 'better-sqlite3'
import { LabTestOrder, LabTestOrderStatus } from '@shared/types'

export interface CriticalAlertEvaluation {
  isCritical: boolean
  alertMessage: string
}

export function evaluateCriticalLabResults(results: Record<string, string>): CriticalAlertEvaluation {
  const alerts: string[] = []

  // 1. Glycémie à jeun (g/L)
  for (const [key, val] of Object.entries(results)) {
    const k = key.toLowerCase()
    const num = parseFloat(val.replace(',', '.').replace(/[^0-9.]/g, ''))

    if (!isNaN(num)) {
      if (k.includes('glyc') || k.includes('sucre') || k.includes('glucose')) {
        if (num > 1.80) {
          alerts.push(`Glycémie critique (${val} > 1.80 g/L) : Risque infectieux majeur & retard de cicatrisation`)
        }
      }

      // 2. INR / Hémostase
      if (k.includes('inr')) {
        if (num > 3.0) {
          alerts.push(`INR critique (${val} > 3.0) : Risque hémorragique sévère, contre-indication chirurgicale/implantaire immédiate`)
        }
      }

      // 3. Plaquettes (NFS / FNS / mm3)
      if (k.includes('plaquette') || k.includes('plt')) {
        const valAdjusted = num < 1000 ? num * 1000 : num
        if (valAdjusted < 100000) {
          alerts.push(`Thrombopénie critique (${val} < 100.000 /mm³) : Risque de saignement prolongé non contrôlé`)
        }
      }

      // 4. TP (%)
      if (k.includes('tp') && !k.includes('inr')) {
        if (num < 50) {
          alerts.push(`Taux de Prothrombine effondré (${val} < 50%) : Risque hémorragique élevé`)
        }
      }
    }

    // 5. Sérologies (Positif / Réactif)
    if (k.includes('hbs') || k.includes('hcv') || k.includes('vih') || k.includes('sérologie') || k.includes('serologie')) {
      const v = val.toLowerCase()
      if (v.includes('pos') || v.includes('réactif') || v.includes('reactif')) {
        alerts.push(`Sérologie positive (${key} : ${val}) : Protocole universel renforcé de bio-sécurité chirurgicale`)
      }
    }
  }

  return {
    isCritical: alerts.length > 0,
    alertMessage: alerts.join(' | ')
  }
}

export class LabTestRepository {
  constructor(private db: Database.Database) {}

  private generateOrderNumber(): string {
    const year = new Date().getFullYear()
    const row = this.db.prepare('SELECT count(*) as count FROM lab_test_orders').get() as { count: number }
    const nextSeq = (row?.count || 0) + 1
    return `BIL-${year}-${String(nextSeq).padStart(4, '0')}`
  }

  getAll(patientId?: string): LabTestOrder[] {
    let query = 'SELECT * FROM lab_test_orders WHERE 1=1'
    const params: string[] = []

    if (patientId) {
      query += ' AND patientId = ?'
      params.push(patientId)
    }

    query += ' ORDER BY requestDate DESC, createdAt DESC'
    const rows = this.db.prepare(query).all(...params) as any[]
    return rows.map((r) => ({
      ...r,
      isCriticalAlert: Boolean(r.isCriticalAlert)
    }))
  }

  getLabOrders(patientId?: string): LabTestOrder[] {
    return this.getAll(patientId)
  }

  getById(id: string): LabTestOrder | null {
    const stmt = this.db.prepare('SELECT * FROM lab_test_orders WHERE id = ?')
    const row = stmt.get(id) as any
    if (!row) return null
    return {
      ...row,
      isCriticalAlert: Boolean(row.isCriticalAlert)
    }
  }

  getLabOrderById(id: string): LabTestOrder | null {
    return this.getById(id)
  }

  save(
    data: Omit<LabTestOrder, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'> & {
      id?: string
      orderNumber?: string
    }
  ): LabTestOrder {
    const now = new Date().toISOString()
    const id = data.id || `bil_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const isNew = !data.id || !this.getById(id)

    if (isNew) {
      const orderNumber = data.orderNumber || this.generateOrderNumber()
      const record: LabTestOrder = {
        id,
        orderNumber,
        patientId: data.patientId,
        dentistName: data.dentistName,
        requestDate: data.requestDate,
        reason: data.reason ?? null,
        testsRequestedJson: typeof data.testsRequestedJson === 'string' ? data.testsRequestedJson : JSON.stringify(data.testsRequestedJson || []),
        resultsJson: typeof data.resultsJson === 'string' ? data.resultsJson : JSON.stringify(data.resultsJson || {}),
        isCriticalAlert: data.isCriticalAlert ? 1 : 0,
        criticalAlertMessage: data.criticalAlertMessage ?? null,
        status: data.status || 'PENDING',
        createdAt: now,
        updatedAt: now
      }

      const stmt = this.db.prepare(`
        INSERT INTO lab_test_orders (
          id, orderNumber, patientId, dentistName, requestDate, reason,
          testsRequestedJson, resultsJson, isCriticalAlert, criticalAlertMessage,
          status, createdAt, updatedAt
        ) VALUES (
          @id, @orderNumber, @patientId, @dentistName, @requestDate, @reason,
          @testsRequestedJson, @resultsJson, @isCriticalAlert, @criticalAlertMessage,
          @status, @createdAt, @updatedAt
        )
      `)
      stmt.run(record)
      return { ...record, isCriticalAlert: Boolean(record.isCriticalAlert) }
    } else {
      const stmt = this.db.prepare(`
        UPDATE lab_test_orders
        SET patientId = @patientId,
            dentistName = @dentistName,
            requestDate = @requestDate,
            reason = @reason,
            testsRequestedJson = @testsRequestedJson,
            resultsJson = @resultsJson,
            isCriticalAlert = @isCriticalAlert,
            criticalAlertMessage = @criticalAlertMessage,
            status = @status,
            updatedAt = @updatedAt
        WHERE id = @id
      `)
      stmt.run({
        id,
        patientId: data.patientId,
        dentistName: data.dentistName,
        requestDate: data.requestDate,
        reason: data.reason ?? null,
        testsRequestedJson: typeof data.testsRequestedJson === 'string' ? data.testsRequestedJson : JSON.stringify(data.testsRequestedJson || []),
        resultsJson: typeof data.resultsJson === 'string' ? data.resultsJson : JSON.stringify(data.resultsJson || {}),
        isCriticalAlert: data.isCriticalAlert ? 1 : 0,
        criticalAlertMessage: data.criticalAlertMessage ?? null,
        status: data.status,
        updatedAt: now
      })
      return this.getById(id)!
    }
  }

  saveLabOrder(
    data: Omit<LabTestOrder, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'> & {
      id?: string
      orderNumber?: string
    }
  ): LabTestOrder {
    return this.save(data)
  }

  recordResults(
    id: string,
    results: Record<string, string>,
    isCritical?: boolean,
    alertMessage?: string
  ): LabTestOrder {
    const now = new Date().toISOString()
    
    // Auto-evaluate if not explicitly specified
    let finalCritical = isCritical
    let finalAlert: string | null | undefined = alertMessage
    if (finalCritical === undefined) {
      const evalRes = evaluateCriticalLabResults(results)
      finalCritical = evalRes.isCritical
      finalAlert = evalRes.alertMessage || null
    }

    const stmt = this.db.prepare(`
      UPDATE lab_test_orders
      SET resultsJson = ?,
          isCriticalAlert = ?,
          criticalAlertMessage = ?,
          status = 'RECEIVED',
          updatedAt = ?
      WHERE id = ?
    `)
    stmt.run(JSON.stringify(results), finalCritical ? 1 : 0, finalAlert ?? null, now, id)
    return this.getById(id)!
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM lab_test_orders WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  deleteLabOrder(id: string): boolean {
    return this.delete(id)
  }
}
