import Database from 'better-sqlite3'
import { SyncQueueItem } from '@shared/types'

export class SyncQueueRepository {
  constructor(private db: Database.Database) {}

  enqueue(
    entityType: SyncQueueItem['entityType'],
    entityId: string,
    operation: SyncQueueItem['operation'],
    payload: object
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO sync_queue (entityType, entityId, operation, payload, status, retryCount, createdAt)
      VALUES (?, ?, ?, ?, 'PENDING', 0, ?)
    `)
    stmt.run(entityType, entityId, operation, JSON.stringify(payload), new Date().toISOString())
  }

  getPendingItems(limit = 50): SyncQueueItem[] {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_queue
      WHERE status = 'PENDING'
      ORDER BY id ASC
      LIMIT ?
    `)
    return stmt.all(limit) as SyncQueueItem[]
  }

  markSyncing(ids: number[]): void {
    if (ids.length === 0) return
    const placeholders = ids.map(() => '?').join(',')
    const stmt = this.db.prepare(`
      UPDATE sync_queue
      SET status = 'SYNCING'
      WHERE id IN (${placeholders})
    `)
    stmt.run(...ids)
  }

  markSynced(ids: number[]): void {
    if (ids.length === 0) return
    const now = new Date().toISOString()
    const placeholders = ids.map(() => '?').join(',')
    const stmt = this.db.prepare(`
      UPDATE sync_queue
      SET status = 'SYNCED', syncedAt = ?
      WHERE id IN (${placeholders})
    `)
    stmt.run(now, ...ids)
  }

  markFailed(id: number, error: string): void {
    const stmt = this.db.prepare(`
      UPDATE sync_queue
      SET status = 'FAILED', retryCount = retryCount + 1, errorMessage = ?
      WHERE id = ?
    `)
    stmt.run(error, id)
  }

  getPendingCount(): number {
    const row = this.db.prepare(`
      SELECT count(*) as count FROM sync_queue WHERE status = 'PENDING'
    `).get() as { count: number }
    return row.count
  }
}
