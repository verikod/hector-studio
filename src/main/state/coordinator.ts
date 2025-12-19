/**
 * AppStateCoordinator - Centralized state management for license and workspaces
 * 
 * This is the single source of truth for application state that has dependencies.
 * Business Rules:
 * 1. Workspaces REQUIRE valid license
 * 2. If license becomes invalid → workspaces MUST be disabled
 * 3. Workspaces can only be enabled IF license is valid
 */

import { BrowserWindow } from 'electron'
import { getLicenseStatus, storeLicense, removeLicense } from '../license/store'
import { activateLicense as activateLicenseOnline } from '../license/lemonsqueezy'
import { serverManager } from '../servers/manager'
import { startWorkspace, stopWorkspace, isHectorInstalled, downloadHector } from '../hector/manager'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'

export interface AppState {
  isLicensed: boolean
  licenseEmail: string | null
  licenseKey: string | null
  workspacesEnabled: boolean
  hectorInstalled: boolean
}

class AppStateCoordinator {
  /**
   * Get current application state
   */
  getState(): AppState {
    const licenseStatus = getLicenseStatus()
    return {
      isLicensed: licenseStatus.isLicensed,
      licenseEmail: licenseStatus.email,
      licenseKey: licenseStatus.key,
      workspacesEnabled: serverManager.getWorkspacesEnabled(),
      hectorInstalled: isHectorInstalled()
    }
  }

  /**
   * Validate and sync state on app startup
   * Enforces: If not licensed, workspaces must be disabled
   */
  async validateAndSync(): Promise<AppState> {
    console.log('[StateCoordinator] Validating state on startup...')
    
    const licenseStatus = getLicenseStatus()
    console.log('[StateCoordinator] License:', licenseStatus.isLicensed ? 'valid' : 'invalid')
    
    // Enforce rule: workspaces require license
    if (!licenseStatus.isLicensed && serverManager.getWorkspacesEnabled()) {
      console.log('[StateCoordinator] Disabling workspaces (no valid license)')
      await stopWorkspace()
      serverManager.setWorkspacesEnabled(false)
    }
    
    const state = this.getState()
    console.log('[StateCoordinator] State after validation:', state)
    
    // Broadcast initial state to all windows
    this.broadcastState(state)
    
    return state
  }

  /**
   * Activate a license key
   * Returns the updated state on success
   */
  async activateLicense(key: string): Promise<{ success: boolean; error?: string; state?: AppState }> {
    console.log('[StateCoordinator] Activating license...')
    
    try {
      // Use activateLicenseOnline which increments activation count
      // and falls back to validation if already activated
      const result = await activateLicenseOnline(key)
      
      if (!result.valid) {
        return { success: false, error: result.message || 'Invalid license key' }
      }
      
      // Store the license (key, email, status)
      const status = result.license?.status === 'disabled' ? 'inactive' : (result.license?.status || 'active')
      storeLicense(
        key,
        result.license?.email ?? '',
        status as 'active' | 'inactive' | 'expired'
      )
      
      const state = this.getState()
      this.broadcastState(state)
      
      return { success: true, state }
    } catch (err) {
      console.error('[StateCoordinator] License activation failed:', err)
      return { success: false, error: String(err) }
    }
  }

  /**
   * Deactivate license
   * Automatically disables workspaces as per business rules
   */
  async deactivateLicense(): Promise<AppState> {
    console.log('[StateCoordinator] Deactivating license...')
    
    // First, disable workspaces (rule: workspaces require license)
    if (serverManager.getWorkspacesEnabled()) {
      console.log('[StateCoordinator] Auto-disabling workspaces')
      await stopWorkspace()
      serverManager.setWorkspacesEnabled(false)
    }
    
    // Then remove license
    removeLicense()
    
    const state = this.getState()
    this.broadcastState(state)
    
    return state
  }

  /**
   * Enable workspaces feature
   * Validates license first, auto-downloads hector if needed
   */
  async enableWorkspaces(): Promise<{ success: boolean; workspaceId?: string; error?: string }> {
    console.log('[StateCoordinator] Enabling workspaces...')
    
    // Validate license first (rule: workspaces require license)
    const licenseStatus = getLicenseStatus()
    if (!licenseStatus.isLicensed) {
      console.log('[StateCoordinator] Cannot enable workspaces: no valid license')
      return { success: false, error: 'Valid license required for workspaces' }
    }
    
    try {
      // Download hector if not installed
      if (!isHectorInstalled()) {
        console.log('[StateCoordinator] Downloading hector...')
        await downloadHector()
      }
      
      // Get or create workspace
      const servers = serverManager.getServers()
      const localWorkspaces = servers.filter(s => s.isLocal)
      
      let workspaceId: string | undefined
      
      if (localWorkspaces.length === 0) {
        // Create default workspace
        const documentsPath = app.getPath('documents')
        const defaultPath = join(documentsPath, 'Hector', 'Default')
        mkdirSync(defaultPath, { recursive: true })
        
        console.log('[StateCoordinator] Creating default workspace:', defaultPath)
        const workspace = serverManager.addWorkspace('Default', defaultPath)
        
        if (workspace) {
          console.log('[StateCoordinator] Starting workspace:', workspace.id)
          await startWorkspace(workspace)
          workspaceId = workspace.id
        }
      } else {
        // Start first existing workspace
        const workspace = localWorkspaces[0]
        console.log('[StateCoordinator] Starting existing workspace:', workspace.id)
        await startWorkspace(workspace)
        workspaceId = workspace.id
      }
      
      // Enable workspaces feature
      serverManager.setWorkspacesEnabled(true)
      
      const state = this.getState()
      this.broadcastState(state)
      
      return { success: true, workspaceId }
    } catch (err) {
      console.error('[StateCoordinator] Enable workspaces failed:', err)
      return { success: false, error: String(err) }
    }
  }

  /**
   * Disable workspaces feature
   */
  async disableWorkspaces(): Promise<AppState> {
    console.log('[StateCoordinator] Disabling workspaces...')
    
    await stopWorkspace()
    serverManager.setWorkspacesEnabled(false)
    
    const state = this.getState()
    this.broadcastState(state)
    
    return state
  }

  /**
   * Broadcast state to all renderer windows
   * Emits unified app:state-changed event for useStateInit hook
   */
  private broadcastState(state: AppState): void {
    console.log('[StateCoordinator] Broadcasting state:', state)
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('app:state-changed', state)
    })
  }
}

// Singleton instance
export const stateCoordinator = new AppStateCoordinator()
