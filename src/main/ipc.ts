import { ipcMain, dialog, app, shell } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { serverManager } from './servers/manager'
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

export function registerIPCHandlers(): void {
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
    const workspace = serverManager.addWorkspace('Default', defaultPath)

    if (workspace) {
      console.log('[ipc] Starting default workspace:', workspace.id)
      await startWorkspace(workspace)
    }

    return workspace
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
}
