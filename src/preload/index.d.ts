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
    auth?: AuthConfig
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
    }
    app: {
      onReady: (callback: () => void) => () => void
    }
  }
}
