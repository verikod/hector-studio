import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // Server Management
  server: {
    list: () => ipcRenderer.invoke('server:list'),
    add: (name: string, url: string) => ipcRenderer.invoke('server:add', { name, url }),
    remove: (id: string) => ipcRenderer.invoke('server:remove', id),
    getActive: () => ipcRenderer.invoke('server:get-active'),
    setActive: (id: string) => ipcRenderer.invoke('server:set-active', id),
    discoverAuth: (url: string) => ipcRenderer.invoke('server:discover-auth', url),
    
    // Event subscriptions for status updates
    onServersUpdated: (callback: (servers: any[]) => void) => {
      const handler = (_: any, servers: any[]) => callback(servers)
      ipcRenderer.on('servers:updated', handler)
      return () => ipcRenderer.removeListener('servers:updated', handler)
    },
    onServerStatusChange: (callback: (data: { id: string, status: string, error?: string }) => void) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('server:status-change', handler)
      return () => ipcRenderer.removeListener('server:status-change', handler)
    }
  },
  
  // Auth Management
  auth: {
    login: (url: string) => ipcRenderer.invoke('auth:login', url),
    logout: (url: string) => ipcRenderer.invoke('auth:logout', url),
    getToken: (url: string) => ipcRenderer.invoke('auth:get-token', url),
    isAuthenticated: (url: string) => ipcRenderer.invoke('auth:is-authenticated', url),
    
    // Event for auth status changes
    onAuthStatusChange: (callback: (data: { url: string, authenticated: boolean }) => void) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('auth:status-change', handler)
      return () => ipcRenderer.removeListener('auth:status-change', handler)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
