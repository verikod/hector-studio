import Store from 'electron-store'
import { v4 as uuidv4 } from 'uuid'

// Fixed ID for the local server - always the same so it can be found
export const LOCAL_SERVER_ID = 'local-hector'

export interface ServerConfig {
  id: string
  name: string
  url: string
  lastUsed: number
  isLocal?: boolean  // True for the built-in local Hector server
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
    // Prevent removing the local server
    const server = servers.find(s => s.id === id)
    if (server?.isLocal) {
      throw new Error('Cannot remove the local Hector server')
    }
    
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
  
  /**
   * Register or update the local Hector server.
   * Called when local Hector starts.
   */
  registerLocalServer(url: string): ServerConfig {
    const servers = this.getServers()
    const existing = servers.find(s => s.id === LOCAL_SERVER_ID)
    
    if (existing) {
      // Update URL if changed
      return this.updateServer(LOCAL_SERVER_ID, { url, lastUsed: Date.now() })
    }
    
    // Create new local server entry
    const localServer: ServerConfig = {
      id: LOCAL_SERVER_ID,
      name: 'Local (Built-in)',
      url,
      lastUsed: Date.now(),
      isLocal: true
    }
    
    // Add at the beginning so it appears first
    store.set('servers', [localServer, ...servers])
    
    // Set as active if no other server is active
    if (!store.get('activeServerId')) {
      store.set('activeServerId', LOCAL_SERVER_ID)
    }
    
    return localServer
  }
  
  /**
   * Get the local Hector server if registered.
   */
  getLocalServer(): ServerConfig | null {
    return this.getServers().find(s => s.id === LOCAL_SERVER_ID) || null
  }
}

export const serverManager = new ServerManager()

