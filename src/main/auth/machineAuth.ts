import { EventEmitter } from 'events'
import { MachineAccountState } from '@shared/types'
import os from 'os'
import crypto from 'crypto'

export class MachineAuthService extends EventEmitter {
  private state: MachineAccountState
  private tokenRefreshTimer: NodeJS.Timeout | null = null

  constructor() {
    super()

    const clinicId = process.env.CLINIC_ID || 'clinic_al_amal_001'
    const machineId = process.env.MACHINE_ID || this.getHardwareBoundMachineId()
    const machineUid = `machine_auth_${crypto.createHash('md5').update(`${clinicId}:${machineId}`).digest('hex').substring(0, 16)}`

    this.state = {
      clinicId,
      machineId,
      machineUid,
      isAuthenticated: false,
      isOnline: true,
      isMock: true,
      lastSyncTimestamp: null,
      pendingQueueCount: 0,
      error: null
    }
  }

  /**
   * Generates a stable hardware-bound machine identity based on system specs
   */
  private getHardwareBoundMachineId(): string {
    const hostname = os.hostname() || 'workstation'
    const platform = os.platform()
    const networkInterfaces = os.networkInterfaces()
    let macAddress = '00:00:00:00:00:00'

    for (const name of Object.keys(networkInterfaces)) {
      const net = networkInterfaces[name]
      if (net) {
        const found = net.find((item) => !item.internal && item.mac !== '00:00:00:00:00:00')
        if (found) {
          macAddress = found.mac
          break
        }
      }
    }

    const hash = crypto.createHash('sha256').update(`${hostname}-${platform}-${macAddress}`).digest('hex').substring(0, 12)
    return `ws_${hostname.toLowerCase().replace(/[^a-z0-9]/g, '')}_${hash}`
  }

  /**
   * Zero-UI Silent Authentication:
   * Called immediately during Electron Main process startup.
   * Completely backgrounded without prompting the clinic doctor or secretary.
   */
  async authenticateMachine(): Promise<MachineAccountState> {
    console.log('[MachineAuth] 🔐 Initializing Zero-UI Silent Machine Authentication...')
    console.log(`[MachineAuth] Clinic: ${this.state.clinicId} | Machine: ${this.state.machineId} (UID: ${this.state.machineUid})`)

    try {
      // Simulate real Firebase Custom Token exchange / Machine Account Sign-in
      await new Promise((resolve) => setTimeout(resolve, 800))

      this.state.isAuthenticated = true
      this.state.isOnline = true
      this.state.error = null

      console.log('[MachineAuth] ✅ Zero-UI Machine Authentication successful. Bound to Firestore scope.')
      this.emit('state-changed', this.getState())

      this.scheduleSilentTokenRenewal()
      return this.getState()
    } catch (err: any) {
      this.state.isAuthenticated = false
      this.state.error = err?.message || 'Authentication error'
      console.error('[MachineAuth] ❌ Silent Machine Authentication failed:', err)
      this.emit('state-changed', this.getState())
      return this.getState()
    }
  }

  private scheduleSilentTokenRenewal(): void {
    if (this.tokenRefreshTimer) clearInterval(this.tokenRefreshTimer)

    // Automatically renew machine token silently in the background every 45 minutes
    this.tokenRefreshTimer = setInterval(() => {
      console.log('[MachineAuth] 🔄 Silent background token renewal...')
      this.state.isAuthenticated = true
      this.emit('state-changed', this.getState())
    }, 45 * 60 * 1000)
  }

  getState(): MachineAccountState {
    return { ...this.state }
  }

  setOnlineStatus(online: boolean): void {
    if (this.state.isOnline !== online) {
      this.state.isOnline = online
      console.log(`[MachineAuth] Network status changed: ${online ? 'ONLINE' : 'OFFLINE'}`)
      this.emit('state-changed', this.getState())
    }
  }

  updateSyncProgress(pendingCount: number, lastSyncTime?: string): void {
    this.state.pendingQueueCount = pendingCount
    if (lastSyncTime) {
      this.state.lastSyncTimestamp = lastSyncTime
    }
    this.emit('state-changed', this.getState())
  }
}
