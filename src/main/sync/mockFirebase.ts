import { SyncQueueItem } from '@shared/types'

export interface CloudSyncResult {
  success: boolean
  syncedEventId: string
  cloudTimestamp: string
  error?: string
}

/**
 * Mock Firestore Cloud Synchronizer
 * Simulates real Firestore document writes partitioned by clinicId and machineUid.
 */
export class MockFirebaseSyncService {
  private inMemoryCloudStore: Map<string, any> = new Map()

  async syncBatch(
    clinicId: string,
    machineUid: string,
    items: SyncQueueItem[]
  ): Promise<{ syncedIds: number[]; failed: { id: number; error: string }[] }> {
    const syncedIds: number[] = []
    const failed: { id: number; error: string }[] = []

    // Simulate network latency (200-400ms)
    await new Promise((resolve) => setTimeout(resolve, 300))

    for (const item of items) {
      try {
        const payload = JSON.parse(item.payload)
        const cloudPath = `clinics/${clinicId}/${item.entityType}s/${item.entityId}`

        if (item.operation === 'DELETE') {
          this.inMemoryCloudStore.delete(cloudPath)
          console.log(`[MockFirestore] 🗑️ DELETED document at ${cloudPath}`)
        } else {
          // INSERT or UPDATE
          this.inMemoryCloudStore.set(cloudPath, {
            ...payload,
            _syncedByMachine: machineUid,
            _cloudSyncedAt: new Date().toISOString()
          })
          console.log(`[MockFirestore] ☁️ SYNCED document at ${cloudPath} (Operation: ${item.operation})`)
        }

        syncedIds.push(item.id)
      } catch (err: any) {
        failed.push({ id: item.id, error: err?.message || 'Serialization error' })
      }
    }

    return { syncedIds, failed }
  }

  getCloudDocumentsCount(): number {
    return this.inMemoryCloudStore.size
  }
}
