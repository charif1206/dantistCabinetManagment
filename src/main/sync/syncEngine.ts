import { SyncQueueRepository } from '../database/repositories/syncQueueRepo'
import { MachineAuthService } from '../auth/machineAuth'
import { MockFirebaseSyncService } from './mockFirebase'

export class SyncEngine {
  private syncTimer: NodeJS.Timeout | null = null
  private isSyncing = false
  private cloudService: MockFirebaseSyncService

  constructor(
    private syncRepo: SyncQueueRepository,
    private authService: MachineAuthService
  ) {
    this.cloudService = new MockFirebaseSyncService()
  }

  start(intervalMs = 5000): void {
    console.log('[SyncEngine] 🚀 Starting Background Sync Engine...')

    // Run first sync immediately after 1.5s
    setTimeout(() => {
      this.syncNow()
    }, 1500)

    // Schedule regular polling for pending queue
    this.syncTimer = setInterval(() => {
      this.syncNow()
    }, intervalMs)
  }

  stop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
  }

  async syncNow(): Promise<{ success: boolean; syncedCount: number }> {
    if (this.isSyncing) return { success: true, syncedCount: 0 }

    const authState = this.authService.getState()
    if (!authState.isAuthenticated || !authState.isOnline) {
      this.authService.updateSyncProgress(this.syncRepo.getPendingCount())
      return { success: false, syncedCount: 0 }
    }

    const pending = this.syncRepo.getPendingItems(50)
    if (pending.length === 0) {
      this.authService.updateSyncProgress(0)
      return { success: true, syncedCount: 0 }
    }

    this.isSyncing = true
    const itemIds = pending.map((p) => p.id)
    this.syncRepo.markSyncing(itemIds)

    try {
      console.log(`[SyncEngine] 📦 Processing batch of ${pending.length} changes for Cloud Sync...`)
      const result = await this.cloudService.syncBatch(authState.clinicId, authState.machineUid, pending)

      if (result.syncedIds.length > 0) {
        this.syncRepo.markSynced(result.syncedIds)
      }

      for (const fail of result.failed) {
        this.syncRepo.markFailed(fail.id, fail.error)
      }

      const now = new Date().toISOString()
      const remainingCount = this.syncRepo.getPendingCount()
      this.authService.updateSyncProgress(remainingCount, now)

      console.log(`[SyncEngine] ✅ Sync batch completed. ${result.syncedIds.length} items synced, ${remainingCount} pending.`)
      return { success: true, syncedCount: result.syncedIds.length }
    } catch (err: any) {
      console.error('[SyncEngine] ❌ Error during sync batch execution:', err)
      return { success: false, syncedCount: 0 }
    } finally {
      this.isSyncing = false
    }
  }
}
