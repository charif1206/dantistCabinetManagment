import Database from 'better-sqlite3'
import {
  ClinicalOverviewStats,
  PeakHourCell,
  ChronicLatePatient,
  SpecialtyDistribution
} from '@shared/types'

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
// Algerian clinic working week order: Samedi (6), Dimanche (0), Lundi (1), Mardi (2), Mercredi (3), Jeudi (4)
const ALGERIAN_WEEK_ORDER = [6, 0, 1, 2, 3, 4]

export class AdvancedStatsRepository {
  constructor(private db: Database.Database) {}

  // 1. Clinical Overview (No-Shows, Lead Time, Volumes)
  getOverview(startDate?: string, endDate?: string): ClinicalOverviewStats {
    let whereClause = "WHERE (status != 'DELETED' OR status IS NOT NULL)"
    const params: string[] = []

    if (startDate && endDate) {
      whereClause += ' AND SUBSTR(dateTime, 1, 10) BETWEEN ? AND ?'
      params.push(startDate, endDate)
    }

    // Appointment totals
    const aptTotals = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
      FROM appointments
      ${whereClause}
    `).get(...params) as { total: number; cancelled: number; completed: number }

    const totalApts = aptTotals?.total || 0
    const cancelledCount = aptTotals?.cancelled || 0
    const completedCount = aptTotals?.completed || 0
    const noShowRate = totalApts > 0 ? Number(((cancelledCount / totalApts) * 100).toFixed(1)) : 0

    // Average Lead Time in days (difference between createdAt and dateTime)
    const leadTimeRow = this.db.prepare(`
      SELECT AVG(
        MAX(0, JULIANDAY(SUBSTR(dateTime, 1, 10)) - JULIANDAY(SUBSTR(createdAt, 1, 10)))
      ) as avgDays
      FROM appointments
      ${whereClause}
    `).get(...params) as { avgDays: number | null }

    const averageLeadTimeDays = leadTimeRow?.avgDays ? Number(leadTimeRow.avgDays.toFixed(1)) : 2.5

    // Chronic late/absent patients count
    const chronicRow = this.db.prepare(`
      SELECT COUNT(*) as count FROM (
        SELECT patientId
        FROM appointments
        WHERE status = 'CANCELLED'
        GROUP BY patientId
        HAVING COUNT(*) >= 2
      )
    `).get() as { count: number }

    const chronicLatePatientsCount = chronicRow?.count || 0

    // Total revenue from treatments
    const revRow = this.db.prepare(`
      SELECT COALESCE(SUM(price), 0) as totalRev
      FROM treatments
      WHERE status = 'COMPLETED'
    `).get() as { totalRev: number }

    const totalRevenueDA = revRow?.totalRev || 0

    return {
      noShowRate,
      totalAppointments: totalApts,
      cancelledCount,
      completedCount,
      averageLeadTimeDays,
      chronicLatePatientsCount,
      totalRevenueDA
    }
  }

  // 2. Weekly Peak Hours Heatmap Matrix (Saturday to Thursday, 08:00 to 20:00)
  getPeakHoursDistribution(): PeakHourCell[] {
    const rows = this.db.prepare(`
      SELECT 
        CAST(strftime('%w', dateTime) AS INTEGER) as dayOfWeek,
        CAST(strftime('%H', dateTime) AS INTEGER) as hourOfDay,
        COUNT(*) as count
      FROM appointments
      WHERE status != 'CANCELLED'
      GROUP BY dayOfWeek, hourOfDay
    `).all() as { dayOfWeek: number; hourOfDay: number; count: number }[]

    // Create lookup map
    const countMap: Record<string, number> = {}
    let maxCount = 1

    for (const r of rows) {
      const key = `${r.dayOfWeek}-${r.hourOfDay}`
      countMap[key] = r.count
      if (r.count > maxCount) maxCount = r.count
    }

    const cells: PeakHourCell[] = []
    const startHour = 8
    const endHour = 19 // up to 19:00

    for (const dayIdx of ALGERIAN_WEEK_ORDER) {
      for (let h = startHour; h <= endHour; h++) {
        const count = countMap[`${dayIdx}-${h}`] || 0
        const intensity = Number((count / maxCount).toFixed(2))
        cells.push({
          dayIndex: dayIdx,
          dayName: DAY_NAMES[dayIdx],
          hour: h,
          count,
          intensity
        })
      }
    }

    return cells
  }

  // 3. Chronic Late / Frequent Absentee Patients
  getChronicLatePatients(): ChronicLatePatient[] {
    const rows = this.db.prepare(`
      SELECT 
        a.patientId,
        COALESCE(p.lastName || ' ' || p.firstName, a.patientName) as patientName,
        p.phone as patientPhone,
        COALESCE(p.patientNumber, '—') as patientNumber,
        COUNT(CASE WHEN a.status = 'CANCELLED' THEN 1 END) as missedCount,
        COUNT(*) as totalBookings,
        MAX(CASE WHEN a.status = 'CANCELLED' THEN a.dateTime END) as lastMissedDate
      FROM appointments a
      LEFT JOIN patients p ON a.patientId = p.id
      GROUP BY a.patientId
      HAVING missedCount >= 2
      ORDER BY missedCount DESC, totalBookings DESC
      LIMIT 30
    `).all() as any[]

    return rows.map((r) => ({
      patientId: r.patientId,
      patientName: r.patientName,
      patientPhone: r.patientPhone,
      patientNumber: r.patientNumber,
      missedCount: r.missedCount,
      totalBookings: r.totalBookings,
      lastMissedDate: r.lastMissedDate,
      requireConfirmation: true
    }))
  }

  // 4. Procedures & Revenue Breakdown by Dental Specialty
  getSpecialtyDistribution(): SpecialtyDistribution[] {
    const rows = this.db.prepare(`
      SELECT 
        COALESCE(m.category, 'SOINS') as specialty,
        COUNT(t.id) as treatmentCount,
        COALESCE(SUM(t.price), 0) as revenueDA
      FROM treatments t
      LEFT JOIN medical_acts m ON t.actId = m.id
      WHERE t.deletedAt IS NULL
      GROUP BY specialty
      ORDER BY revenueDA DESC
    `).all() as { specialty: string; treatmentCount: number; revenueDA: number }[]

    const totalRev = rows.reduce((acc, r) => acc + (r.revenueDA || 0), 0) || 1

    const SPECIALTY_LABELS: Record<string, string> = {
      ODF: 'Orthodontie (ODF)',
      IMPLANT: 'Implantologie',
      PROTHESE_FIXE: 'Prothèse Fixe',
      PROTHESE_AMOVIBLE: 'Prothèse Amovible',
      CHIRURGIE: 'Chirurgie Buccale',
      SOINS: 'Soins & Esthétique',
      SOINS_CONSERVATEURS: 'Soins & Esthétique',
      ENDODONTIE: 'Endodontie',
      PARODONTIE: 'Parodontologie',
      PARODONTOLOGIE: 'Parodontologie',
      CONSULTATION_IMAGERIE: 'Consultation & Imagerie'
    }

    return rows.map((r) => ({
      specialty: r.specialty,
      label: SPECIALTY_LABELS[r.specialty] || r.specialty,
      treatmentCount: r.treatmentCount,
      revenueDA: r.revenueDA,
      percentage: Number(((r.revenueDA / totalRev) * 100).toFixed(1))
    }))
  }
}

