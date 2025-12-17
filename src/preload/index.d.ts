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
  }

  type AuthConfig = {
    enabled: boolean
    type: string
    issuer: string
    audience: string
  }

  interface HectorAPI {
    server: {
      list: () => Promise<ServerConfig[]>
      add: (name: string, url: string) => Promise<ServerConfig>
      remove: (id: string) => Promise<void>
      getActive: () => Promise<ServerConfig | null>
      setActive: (id: string) => Promise<void>
      discoverAuth: (url: string) => Promise<AuthConfig | null>
    }
    auth: {
      login: (url: string) => Promise<void>
      logout: (url: string) => Promise<void>
      getToken: (url: string) => Promise<string | null>
      isAuthenticated: (url: string) => Promise<boolean>
    }
  }
}
