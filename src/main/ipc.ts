import { ipcMain, dialog } from 'electron'
import { serverManager } from './servers/manager'
import { authManager } from './auth/manager'
import {
  isHectorInstalled,
  getInstalledVersion,
  downloadHector,
  stopWorkspace,
  switchWorkspace,
  getHectorStatus,
  getActiveWorkspaceId,
  checkForUpdates
} from './hector/manager'

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
  
  ipcMain.handle('workspace:get-active', () => {
    return getActiveWorkspaceId()
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
}
