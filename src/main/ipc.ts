import { ipcMain } from 'electron'
import { serverManager } from './servers/manager'
import { authManager } from './auth/manager'

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
}
