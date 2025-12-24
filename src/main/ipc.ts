import { ipcMain, dialog, app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { serverManager } from './servers/manager'
import { skillManager } from './skills/manager'
import { authManager } from './auth/manager'
import { stateCoordinator } from './state/coordinator'
import {
  isHectorInstalled,
  getInstalledVersion,
  downloadHector,
  stopWorkspace,
  switchWorkspace,
  startWorkspace,
  getHectorStatus,
  getActiveWorkspaceId,
  checkForUpdates,
  upgradeHector,
  getLogs,
  clearLogs
} from './hector/manager'
import {
  validateLicenseOnline,
  getCheckoutUrl
} from './license/lemonsqueezy'
import {
  getStoredLicense,
  getLicenseStatus,
  isOfflineValidationAllowed,
  updateLastValidated
} from './license/store'
import {
  getGlobalEnvVars,
  setGlobalEnvVars,
  mergeEnvVars,
  formatAsEnvFile
} from './envVars/store'
import { writeFileSync } from 'fs'

export function registerIPCHandlers(): void {
  // Bridge auth-changed events from AuthManager to renderer
  authManager.on('auth-changed', (data: { serverUrl: string; authenticated: boolean }) => {
    // Find server by URL to get ID
    const servers = serverManager.getServers()
    const server = servers.find(s => s.url === data.serverUrl)
    if (server) {
      const status = data.authenticated ? 'authenticated' : 'auth_required'
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('server:status-change', { id: server.id, status })
      })
    }
  })

  // Server Management
  ipcMain.handle('server:list', () => serverManager.getServers())

  ipcMain.handle('server:add', async (_, { name, url }) => {
    return serverManager.addServer(name, url)
  })

  ipcMain.handle('server:remove', async (_, id) => {
    serverManager.removeServer(id)
  })

  ipcMain.handle('server:get-active', () => serverManager.getActiveServer())

  ipcMain.handle('server:set-active', async (_, id) => {
    const server = serverManager.getServer(id)
    if (server?.isLocal) {
      // For workspaces, switch starts the workspace process
      await switchWorkspace(id)
    } else {
      serverManager.setActiveServer(id)
    }
  })

  ipcMain.handle('server:discover-auth', async (_, url) => {
    return authManager.discoverAuth(url)
  })

  // Probe a server and emit status change - centralizes status updates
  ipcMain.handle('server:probe', async (_, id: string) => {
    const server = serverManager.getServer(id)
    if (!server) {
      console.warn('[ipc] server:probe - server not found:', id)
      return { success: false, error: 'Server not found' }
    }

    try {
      const authConfig = await authManager.discoverAuth(server.url)
      let status: 'authenticated' | 'auth_required' | 'unreachable' = 'authenticated'
      
      if (authConfig === null) {
        status = 'unreachable'
      } else if (authConfig.enabled) {
        const isAuth = await authManager.isAuthenticated(server.url)
        status = isAuth ? 'authenticated' : 'auth_required'
      }
      
      // Emit status change to renderer
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('server:status-change', { id, status })
      })
      
      return { success: true, status }
    } catch (error) {
      // Emit error status
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('server:status-change', { 
          id, 
          status: 'unreachable', 
          error: String(error) 
        })
      })
      return { success: false, error: String(error) }
    }
  })

  // Workspace Management
  ipcMain.handle('workspace:browse', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Workspace Folder',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Select Workspace'
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  ipcMain.handle('workspace:add', async (_, { name, path }) => {
    return serverManager.addWorkspace(name, path)
  })

  ipcMain.handle('workspace:switch', async (_, id) => {
    return switchWorkspace(id)
  })

  ipcMain.handle('workspace:stop', async () => {
    return stopWorkspace()
  })

  ipcMain.handle('workspace:start', async (_, id) => {
    return switchWorkspace(id)
  })

  ipcMain.handle('workspace:get-active', () => {
    return getActiveWorkspaceId()
  })

  // Create default workspace after hector download
  ipcMain.handle('workspace:create-default', async () => {
    const documentsPath = app.getPath('documents')
    const defaultPath = join(documentsPath, 'Hector', 'Default')
    mkdirSync(defaultPath, { recursive: true })

    console.log('[ipc] Creating default workspace:', defaultPath)
    const workspace = await serverManager.addWorkspace('Default', defaultPath)

    if (workspace) {
      console.log('[ipc] Starting default workspace:', workspace.id)
      await startWorkspace(workspace)
    }

    return workspace
  })

  ipcMain.handle('workspace:create-from-skill', async (_, { name, path, skill }) => {
    // 1. Ensure directory exists
    // mkdirSync is handled by downloadSkill or browse dialog usually? 
    // Browse dialog only selects. We must ensure exists.
    mkdirSync(path, { recursive: true })

    console.log('[ipc] Creating workspace from skill:', name, path, skill.name)

    // 2. Download skill contents
    try {
        await skillManager.downloadSkill(skill, path)
    } catch (e) {
        console.error('Failed to download skill:', e)
        throw new Error(`Failed to download skill: ${(e as Error).message}`)
    }

    // 3. Add workspace
    const workspace = await serverManager.addWorkspace(name, path)

    if (workspace) {
      console.log('[ipc] Starting workspace:', workspace.id)
      await startWorkspace(workspace)
    }

    return workspace
  })

  ipcMain.handle('skills:list', async () => {
    return skillManager.listSkills()
  })

  // Workspaces feature toggle - delegates to centralized stateCoordinator
  ipcMain.handle('workspaces:is-enabled', () => {
    return serverManager.getWorkspacesEnabled()
  })

  ipcMain.handle('workspaces:enable', async () => {
    console.log('[ipc] workspaces:enable -> delegating to stateCoordinator')
    return stateCoordinator.enableWorkspaces()
  })

  ipcMain.handle('workspaces:disable', async () => {
    console.log('[ipc] workspaces:disable -> delegating to stateCoordinator')
    await stateCoordinator.disableWorkspaces()
    return { success: true }
  })

  // Auth Management
  ipcMain.handle('auth:login', async (_, url) => {
    const servers = serverManager.getServers()
    const server = servers.find(s => s.url === url)
    const clientId = server?.auth?.clientId || 'hector-studio'
    return authManager.login(url, clientId)
  })

  ipcMain.handle('auth:logout', async (_, url) => {
    return authManager.logout(url)
  })

  ipcMain.handle('auth:get-token', async (_, url) => {
    return authManager.getToken(url)
  })

  ipcMain.handle('auth:is-authenticated', async (_, url) => {
    return authManager.isAuthenticated(url)
  })

  // Hector Binary Management
  ipcMain.handle('hector:is-installed', () => isHectorInstalled())

  ipcMain.handle('hector:get-version', () => getInstalledVersion())

  ipcMain.handle('hector:download', async (_, version?: string) => {
    return downloadHector(version)
  })

  ipcMain.handle('hector:get-status', () => getHectorStatus())

  ipcMain.handle('hector:check-updates', async () => {
    return checkForUpdates()
  })

  ipcMain.handle('hector:upgrade', async () => {
    return upgradeHector()
  })

  ipcMain.handle('hector:get-logs', () => getLogs())

  ipcMain.handle('hector:clear-logs', () => {
    clearLogs()
    return { success: true }
  })

  // Workspace folder operations
  ipcMain.handle('workspace:open-folder', async (_, path: string) => {
    return shell.openPath(path)
  })

  // License Management
  ipcMain.handle('license:status', () => getLicenseStatus())

  // License:create removed - users get licenses via LemonSqueezy checkout
  // Keeping for backwards compatibility, but it does nothing
  ipcMain.handle('license:create', async () => {
    return { success: false, error: 'Please get your license from the checkout page' }
  })

  ipcMain.handle('license:activate', async (_, key: string) => {
    console.log('[ipc] license:activate -> delegating to stateCoordinator')
    const result = await stateCoordinator.activateLicense(key)
    if (result.success) {
      return { success: true, license: { email: result.state?.licenseEmail } }
    }
    return { success: false, error: result.error }
  })

  ipcMain.handle('license:validate', async () => {
    const stored = getStoredLicense()
    if (!stored) {
      return { valid: false, reason: 'No license stored' }
    }

    // Try online validation first
    const validation = await validateLicenseOnline(stored.key)
    if (validation.valid) {
      updateLastValidated()
      return { valid: true, license: stored }
    }

    // Fall back to offline validation if allowed
    if (isOfflineValidationAllowed()) {
      return { valid: true, license: stored, offline: true }
    }

    return { valid: false, reason: validation.message }
  })

  ipcMain.handle('license:deactivate', async () => {
    console.log('[ipc] license:deactivate -> delegating to stateCoordinator')
    await stateCoordinator.deactivateLicense()
    return { success: true }
  })

  ipcMain.handle('license:portal-url', () => getCheckoutUrl())

  // Environment Variables Management
  ipcMain.handle('env:get-global', () => getGlobalEnvVars())

  ipcMain.handle('env:set-global', async (_, envVars: Record<string, string>) => {
    setGlobalEnvVars(envVars)
    
    // Also update .env file for the active workspace so running Hector sees the change
    const activeWorkspace = serverManager.getActiveWorkspace()
    if (activeWorkspace?.workspacePath) {
      const workspaceEnvVars = activeWorkspace.envVars || {}
      const merged = mergeEnvVars(workspaceEnvVars) // merges global + workspace vars
      const envPath = join(activeWorkspace.workspacePath, '.hector', '.env')
      const content = formatAsEnvFile(merged)
      writeFileSync(envPath, content, 'utf-8')
      console.log(`[ipc] Updated .env file for active workspace: ${envPath}`)
    }
    
    return { success: true }
  })

  ipcMain.handle('env:get-workspace', async (_, id: string) => {
    const server = serverManager.getServer(id)
    return server?.envVars ?? {}
  })

  ipcMain.handle('env:set-workspace', async (_, { id, envVars }: { id: string; envVars: Record<string, string> }) => {
    const server = serverManager.getServer(id)
    if (!server || !server.workspacePath) {
      throw new Error('Workspace not found or has no path')
    }

    // Update workspace config
    serverManager.updateServer(id, { envVars })

    // Merge with global vars and write to .env file in .hector directory
    // This location is watched by Hector for hot-reload
    const merged = mergeEnvVars(envVars)
    const envPath = join(server.workspacePath, '.hector', '.env')
    const content = formatAsEnvFile(merged)
    
    writeFileSync(envPath, content, 'utf-8')
    console.log(`[ipc] Wrote .env file to ${envPath}`)

    return { success: true, path: envPath }
  })
}
