import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: HectorAPI
  }

  type ServerConfig = {
    id: string
    name: string
    url: string
    lastUsed: number
    isLocal?: boolean
    workspacePath?: string
    port?: number
    envVars?: Record<string, string>
    auth?: AuthConfig
    tunnel?: {
      token?: string
      url?: string
    }
    secureToken?: string
  }

  type AuthConfig = {
    enabled: boolean
    type: string
    issuer: string
    audience: string
    clientId?: string
  }

  interface HectorAPI {
    server: {
      list: () => Promise<ServerConfig[]>
      add: (name: string, url: string) => Promise<ServerConfig>
      remove: (id: string) => Promise<void>
      getActive: () => Promise<ServerConfig | null>
      setActive: (id: string) => Promise<void>
      discoverAuth: (url: string) => Promise<AuthConfig | null>
      onServersUpdated: (callback: (servers: ServerConfig[]) => void) => () => void
      onServerStatusChange: (callback: (data: { id: string, status: string, error?: string }) => void) => () => void
    }
    workspace: {
      browse: () => Promise<string | null>
      add: (name: string, path: string) => Promise<ServerConfig>
      switch: (id: string) => Promise<void>
      stop: () => Promise<void>
      start: (id: string) => Promise<void>
      getActive: () => Promise<string | null>
      createDefault: () => Promise<ServerConfig>
      openFolder: (path: string) => Promise<string>
    }
    workspaces: {
      isEnabled: () => Promise<boolean>
      enable: () => Promise<{ success: boolean }>
      disable: () => Promise<{ success: boolean }>
      getPort: () => Promise<number | null>
      setPort: (port: number) => Promise<{ success: boolean }>
    }
    auth: {
      login: (url: string) => Promise<void>
      logout: (url: string) => Promise<void>
      getToken: (url: string) => Promise<string | null>
      isAuthenticated: (url: string) => Promise<boolean>
      onAuthStatusChange: (callback: (data: { url: string, authenticated: boolean }) => void) => () => void
    }
    hector: {
      isInstalled: () => Promise<boolean>
      getVersion: () => Promise<string | null>
      download: (version?: string) => Promise<void>
      getStatus: () => Promise<string>
      checkUpdates: () => Promise<{ hasUpdate: boolean, currentVersion: string | null, latestVersion: string }>
      upgrade: () => Promise<void>
      getLogs: () => Promise<{ line: string, isError: boolean, timestamp: number }[]>
      clearLogs: () => Promise<{ success: boolean }>
      onLog: (callback: (entry: { line: string, isError: boolean, timestamp: number }) => void) => () => void
    }
    license: {
      getStatus: () => Promise<{ isLicensed: boolean, email: string | null, key: string | null, activatedAt: string | null, status: string | null }>
      create: (email: string) => Promise<{ success: boolean, key?: string, error?: string }>
      activate: (key: string) => Promise<{ success: boolean, license?: any, error?: string }>
      validate: () => Promise<{ valid: boolean, license?: any, offline?: boolean, reason?: string }>
      deactivate: () => Promise<{ success: boolean }>
      getPortalUrl: () => Promise<string>
    }
    app: {
      getState: () => Promise<{ hectorInstalled: boolean, hasWorkspaces: boolean, workspacesEnabled: boolean, needsRuntimeUpdate: boolean }>
      onReady: (callback: (payload: { hectorInstalled: boolean, hasWorkspaces: boolean, workspacesEnabled: boolean, needsRuntimeUpdate: boolean }) => void) => () => void
      onStateChanged: (callback: (state: { isLicensed: boolean, licenseEmail: string | null, licenseKey: string | null, workspacesEnabled: boolean, hectorInstalled: boolean }) => void) => () => void
      checkUpdate: () => Promise<any>
      startDownload: () => Promise<void>
      installUpdate: () => Promise<void>
      onUpdateStatus: (callback: (data: { status: string, data?: any }) => void) => () => void
    }
    env: {
      getGlobal: () => Promise<Record<string, string>>
      setGlobal: (envVars: Record<string, string>) => Promise<{ success: boolean }>
      getWorkspace: (id: string) => Promise<Record<string, string>>
      setWorkspace: (id: string, envVars: Record<string, string>) => Promise<{ success: boolean, path: string }>
    }
    tunnel: {
      start: (workspaceId: string) => Promise<{ success: boolean }>
      stop: (workspaceId: string) => Promise<{ success: boolean }>
      status: (workspaceId: string) => Promise<{ workspaceId: string, publicUrl: string | null, status: string, error?: string } | null>
      onStatusChange: (callback: (state: { workspaceId: string, publicUrl: string | null, status: string, error?: string }) => void) => () => void
    }
  }
}
