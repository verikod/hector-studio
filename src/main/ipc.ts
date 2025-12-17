import { ipcMain } from 'electron'
import { serverManager } from './servers/manager'
import { authManager } from './auth/manager'
import {
  isHectorInstalled,
  getInstalledVersion,
  downloadHector,
  startHector,
  stopHector,
  getHectorStatus,
  getHectorUrl,
  getWorkspaceDir,
  setWorkspaceDir,
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
    serverManager.setActiveServer(id)
  })

  ipcMain.handle('server:discover-auth', async (_, url) => {
    return authManager.discoverAuth(url)
  })

  // Auth Management
  ipcMain.handle('auth:login', async (_, url) => {
    const servers = serverManager.getServers()
    const server = servers.find(s => s.url === url)
    // Default to 'hector-studio' if no client ID configured
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

  // Local Hector Management
  ipcMain.handle('hector:is-installed', () => isHectorInstalled())
  
  ipcMain.handle('hector:get-version', () => getInstalledVersion())
  
  ipcMain.handle('hector:download', async (_, version?: string) => {
    return downloadHector(version)
  })
  
  ipcMain.handle('hector:start', async (_, port?: number) => {
    return startHector(port)
  })
  
  ipcMain.handle('hector:stop', async () => {
    return stopHector()
  })
  
  ipcMain.handle('hector:get-status', () => getHectorStatus())
  
  ipcMain.handle('hector:get-url', () => getHectorUrl())
  
  ipcMain.handle('hector:get-workspace', () => getWorkspaceDir())
  
  ipcMain.handle('hector:set-workspace', async (_, dir: string) => {
    return setWorkspaceDir(dir)
  })
  
  ipcMain.handle('hector:check-updates', async () => {
    return checkForUpdates()
  })
}
