import Store from 'electron-store'
import { v4 as uuidv4 } from 'uuid'

export interface ServerConfig {
  id: string
  name: string
  url: string
  lastUsed: number
  auth?: {
    enabled: boolean
    type: string
    issuer: string
    audience: string
    clientId?: string // User-provided client ID
  }
}

interface ServerStore {
  servers: ServerConfig[]
  activeServerId: string | null
}

const store = new Store<ServerStore>({
  name: 'servers',
  defaults: {
    servers: [],
    activeServerId: null
  }
})

export class ServerManager {
  getServers(): ServerConfig[] {
    return store.get('servers')
  }

  addServer(name: string, url: string): ServerConfig {
    const servers = this.getServers()
    // Check if URL already exists
    const existing = servers.find(s => s.url === url)
    if (existing) {
      throw new Error(`Server with URL ${url} already exists`)
    }

    const newServer: ServerConfig = {
      id: uuidv4(),
      name,
      url: url.replace(/\/$/, ''), // Remove trailing slash
      lastUsed: Date.now()
    }

    store.set('servers', [...servers, newServer])
    
    // Set as active if it's the first one
    if (servers.length === 0) {
      this.setActiveServer(newServer.id)
    }

    return newServer
  }

  removeServer(id: string): void {
    const servers = this.getServers()
    const newServers = servers.filter(s => s.id !== id)
    store.set('servers', newServers)

    // Using "activeServerId" logic
    if (store.get('activeServerId') === id) {
      store.set('activeServerId', newServers.length > 0 ? newServers[0].id : null)
    }
  }

  updateServer(id: string, updates: Partial<ServerConfig>): ServerConfig {
    const servers = this.getServers()
    const index = servers.findIndex(s => s.id === id)
    if (index === -1) {
      throw new Error('Server not found')
    }

    const updated = { ...servers[index], ...updates, lastUsed: Date.now() }
    servers[index] = updated
    store.set('servers', servers)
    return updated
  }

  getActiveServer(): ServerConfig | null {
    const id = store.get('activeServerId')
    if (!id) return null
    return this.getServers().find(s => s.id === id) || null
  }

  setActiveServer(id: string): void {
    const servers = this.getServers()
    if (!servers.find(s => s.id === id)) {
      throw new Error('Server not found')
    }
    store.set('activeServerId', id)
    // Update last used
    this.updateServer(id, { lastUsed: Date.now() })
  }
}

export const serverManager = new ServerManager()
