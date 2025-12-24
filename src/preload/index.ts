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
    probe: (id: string) => ipcRenderer.invoke('server:probe', id),


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
    createDefault: () => ipcRenderer.invoke('workspace:create-default'),
    createFromSkill: (name: string, path: string, skill: any) => ipcRenderer.invoke('workspace:create-from-skill', { name, path, skill }),
    openFolder: (path: string) => ipcRenderer.invoke('workspace:open-folder', path)
  },

  // Skills Management
  skills: {
    list: () => ipcRenderer.invoke('skills:list')
  },

  // Workspaces Feature Toggle
  workspaces: {
    isEnabled: () => ipcRenderer.invoke('workspaces:is-enabled'),
    enable: () => ipcRenderer.invoke('workspaces:enable'),
    disable: () => ipcRenderer.invoke('workspaces:disable'),
    onEnabledChanged: (callback: (enabled: boolean) => void) => {
      const handler = (_: any, enabled: boolean) => callback(enabled)
      ipcRenderer.on('workspaces:enabled-changed', handler)
      return () => ipcRenderer.removeListener('workspaces:enabled-changed', handler)
    }
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
    checkUpdates: () => ipcRenderer.invoke('hector:check-updates'),
    upgrade: () => ipcRenderer.invoke('hector:upgrade'),
    getLogs: () => ipcRenderer.invoke('hector:get-logs'),
    clearLogs: () => ipcRenderer.invoke('hector:clear-logs'),
    onLog: (callback: (entry: { line: string, isError: boolean, timestamp: number }) => void) => {
      const handler = (_: any, entry: any) => callback(entry)
      ipcRenderer.on('hector:log', handler)
      return () => ipcRenderer.removeListener('hector:log', handler)
    }
  },

  // License management
  license: {
    getStatus: () => ipcRenderer.invoke('license:status'),
    create: (email: string) => ipcRenderer.invoke('license:create', email),
    activate: (key: string) => ipcRenderer.invoke('license:activate', key),
    validate: () => ipcRenderer.invoke('license:validate'),
    deactivate: () => ipcRenderer.invoke('license:deactivate'),
    getPortalUrl: () => ipcRenderer.invoke('license:portal-url'),
    onLicenseChanged: (callback: (data: { isLicensed: boolean; email: string | null; key: string | null }) => void) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('license:changed', handler)
      return () => ipcRenderer.removeListener('license:changed', handler)
    }
  },

  // App lifecycle
  app: {
    onReady: (callback: (payload: { hectorInstalled: boolean, hasWorkspaces: boolean, workspacesEnabled: boolean, needsRuntimeUpdate: boolean }) => void) => {
      const handler = (_event: any, payload: { hectorInstalled: boolean, hasWorkspaces: boolean, workspacesEnabled: boolean, needsRuntimeUpdate: boolean }) => callback(payload)
      ipcRenderer.on('app:ready', handler)
      return () => ipcRenderer.removeListener('app:ready', handler)
    },
    // Unified state change event from stateCoordinator
    onStateChanged: (callback: (state: { isLicensed: boolean, licenseEmail: string | null, licenseKey: string | null, workspacesEnabled: boolean, hectorInstalled: boolean }) => void) => {
      const handler = (_event: any, state: any) => callback(state)
      ipcRenderer.on('app:state-changed', handler)
      return () => ipcRenderer.removeListener('app:state-changed', handler)
    },
    checkUpdate: () => ipcRenderer.invoke('app:check-update'),
    startDownload: () => ipcRenderer.invoke('app:start-download'),
    installUpdate: () => ipcRenderer.invoke('app:install-update'),
    onUpdateStatus: (callback: (data: { status: string, data?: any }) => void) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('app:update-status', handler)
      return () => ipcRenderer.removeListener('app:update-status', handler)
    }
  },

  // Environment Variables
  env: {
    getGlobal: () => ipcRenderer.invoke('env:get-global'),
    setGlobal: (envVars: Record<string, string>) => ipcRenderer.invoke('env:set-global', envVars),
    getWorkspace: (id: string) => ipcRenderer.invoke('env:get-workspace', id),
    setWorkspace: (id: string, envVars: Record<string, string>) => ipcRenderer.invoke('env:set-workspace', { id, envVars })
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
