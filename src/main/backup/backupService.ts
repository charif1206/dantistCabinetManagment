import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync, mkdirSync, statSync } from 'fs'
import { getDatabasePath } from '../database/db'

export interface BackupResult {
  success: boolean
  backupPath: string
  sizeBytes: number
  timestamp: string
  integrityOk: boolean
  error?: string
}

export class BackupService {
  constructor(private db: Database.Database) {}

  /**
   * Verifies the SQLite database health using PRAGMA integrity_check
   */
  verifyIntegrity(): { ok: boolean; message: string } {
    try {
      const rows = this.db.pragma('integrity_check') as { integrity_check: string }[]
      const isOk = rows.length > 0 && rows[0].integrity_check === 'ok'
      return {
        ok: isOk,
        message: isOk ? 'Base de données SQLite saine et intègre' : JSON.stringify(rows)
      }
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Erreur lors de la vérification' }
    }
  }

  /**
   * Performs an atomic online SQLite backup without blocking active clinical operations.
   */
  async createBackup(targetDirectory?: string): Promise<BackupResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const dbPath = getDatabasePath()
    const defaultBackupDir = join(dbPath, '..', 'backups')

    const outDir = targetDirectory || defaultBackupDir
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true })
    }

    const backupFile = join(outDir, `dentaflow-backup-${timestamp}.db`)

    try {
      // 1. Verify integrity before backup
      const check = this.verifyIntegrity()
      if (!check.ok) {
        throw new Error(`Échec du contrôle d'intégrité préalable: ${check.message}`)
      }

      // 2. Online non-blocking backup via better-sqlite3 native backup API
      await this.db.backup(backupFile)

      const stats = statSync(backupFile)

      console.log(`[BackupService] Backup successfully created at: ${backupFile} (${stats.size} bytes)`)

      return {
        success: true,
        backupPath: backupFile,
        sizeBytes: stats.size,
        timestamp,
        integrityOk: true
      }
    } catch (error: any) {
      console.error('[BackupService] Error creating backup:', error)
      return {
        success: false,
        backupPath: backupFile,
        sizeBytes: 0,
        timestamp,
        integrityOk: false,
        error: error?.message || 'Erreur inconnue lors de la sauvegarde'
      }
    }
  }
}
