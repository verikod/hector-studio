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
    
    // Event subscriptions
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
  
  // Workspace Management (local servers)
  workspace: {
    browse: () => ipcRenderer.invoke('workspace:browse'),
    add: (name: string, path: string) => ipcRenderer.invoke('workspace:add', { name, path }),
    switch: (id: string) => ipcRenderer.invoke('workspace:switch', id),
    stop: () => ipcRenderer.invoke('workspace:stop'),
    start: (id: string) => ipcRenderer.invoke('workspace:start', id),
    getActive: () => ipcRenderer.invoke('workspace:get-active'),
    createDefault: () => ipcRenderer.invoke('workspace:create-default')
  },
  
  // Auth Management
  auth: {
    login: (url: string) => ipcRenderer.invoke('auth:login', url),
    logout: (url: string) => ipcRenderer.invoke('auth:logout', url),
    getToken: (url: string) => ipcRenderer.invoke('auth:get-token', url),
    isAuthenticated: (url: string) => ipcRenderer.invoke('auth:is-authenticated', url),
    
    onAuthStatusChange: (callback: (data: { url: string, authenticated: boolean }) => void) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('auth:status-change', handler)
      return () => ipcRenderer.removeListener('auth:status-change', handler)
    }
  },
  
  // Hector binary management
  hector: {
    isInstalled: () => ipcRenderer.invoke('hector:is-installed'),
    getVersion: () => ipcRenderer.invoke('hector:get-version'),
    download: (version?: string) => ipcRenderer.invoke('hector:download', version),
    getStatus: () => ipcRenderer.invoke('hector:get-status'),
    checkUpdates: () => ipcRenderer.invoke('hector:check-updates')
  },
  
  // App lifecycle
  app: {
    onReady: (callback: (payload: { hectorInstalled: boolean, hasWorkspaces: boolean }) => void) => {
      const handler = (_event: any, payload: { hectorInstalled: boolean, hasWorkspaces: boolean }) => callback(payload)
      ipcRenderer.on('app:ready', handler)
      return () => ipcRenderer.removeListener('app:ready', handler)
    }
  }
}

// Expose to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
