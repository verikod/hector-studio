import Store from 'electron-store'
import { v4 as uuidv4 } from 'uuid'



export interface ServerConfig {
  id: string
  name: string
  url: string
  lastUsed: number
  isLocal?: boolean       // True for workspace-based local server
  workspacePath?: string  // Absolute path to workspace directory (only for local)
  port?: number           // Port for local server (auto-assigned)
  envVars?: Record<string, string> // Workspace-scoped environment variables
  auth?: {
    enabled: boolean
    type: string
    issuer: string
    audience: string
    clientId?: string
  }
  tunnel?: {
    token?: string
    url?: string
  }
}

interface ServerStore {
  servers: ServerConfig[]
  activeServerId: string | null
  workspacesEnabled: boolean  // Whether local workspaces feature is enabled
  defaultPort: number | null  // Global port for all workspaces
}

const store = new Store<ServerStore>({
  name: 'servers',
  defaults: {
    servers: [],
    activeServerId: null,
    workspacesEnabled: false,  // Default to false, user must opt-in
    defaultPort: null  // Set on first workspace startup
  }
})

export class ServerManager {
  constructor() {
    this.cleanupInvalidServers()
  }

  /**
   * Remove invalid local servers (missing workspacePath or port)
   * This handles migration from legacy single-server model.
   */
  private cleanupInvalidServers() {
    const servers = store.get('servers')
    const validServers = servers.filter(s => {
      // Keep remote servers
      if (!s.isLocal) return true
      
      // Keep valid local workspaces
      if (s.workspacePath && s.port) return true
      
      console.log(`[ServerManager] Removing invalid local server: ${s.name} (${s.id})`)
      return false
    })
    
    if (validServers.length !== servers.length) {
      store.set('servers', validServers)
      
      // Reset active ID if removed
      const activeId = store.get('activeServerId')
      if (activeId && !validServers.find(s => s.id === activeId)) {
        store.set('activeServerId', null)
      }
    }
  }

  getServers(): ServerConfig[] {
    return store.get('servers')
  }
  
  /**
   * Get all workspace (local) servers.
   */
  getWorkspaces(): ServerConfig[] {
    return this.getServers().filter(s => s.isLocal)
  }
  
  /**
   * Get all remote servers.
   */
  getRemoteServers(): ServerConfig[] {
    return this.getServers().filter(s => !s.isLocal)
  }
  

  /**
   * Find a free port using the OS kernel.
   * This avoids race conditions and collisions with other apps.
   */
  public async findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      import('net').then(({ createServer }) => {
        const srv = createServer()
        srv.unref()
        srv.on('error', reject)
        srv.listen(0, () => {
          const { port } = srv.address() as import('net').AddressInfo
          srv.close(() => resolve(port))
        })
      }).catch(reject)
    })
  }

  /**
   * Add a remote server by URL.
   */
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
  
  /**
   * Add a workspace (local server).
   * Finds a free port dynamically.
   */
  async addWorkspace(name: string, workspacePath: string): Promise<ServerConfig> {
    const servers = this.getServers()
    
    // Check if workspace path already exists
    const existing = servers.find(s => s.workspacePath === workspacePath)
    if (existing) {
      throw new Error(`Workspace at ${workspacePath} already exists`)
    }
    
    const port = await this.findFreePort()
    const url = `http://localhost:${port}`
    
    const newWorkspace: ServerConfig = {
      id: uuidv4(),
      name,
      url,
      workspacePath,
      port,
      isLocal: true,
      lastUsed: Date.now()
    }
    
    // Add workspaces at the beginning
    store.set('servers', [newWorkspace, ...servers])
    
    return newWorkspace
  }

  removeServer(id: string): void {
    const servers = this.getServers()
    const newServers = servers.filter(s => s.id !== id)
    store.set('servers', newServers)

    // Clear active if removed
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

  getServer(id: string): ServerConfig | null {
    return this.getServers().find(s => s.id === id) || null
  }

  getActiveServer(): ServerConfig | null {
    const id = store.get('activeServerId')
    if (!id) return null
    return this.getServers().find(s => s.id === id) || null
  }

  setActiveServer(id: string | null): void {
    if (id === null) {
      store.set('activeServerId', null)
      return
    }
    const servers = this.getServers()
    if (!servers.find(s => s.id === id)) {
      throw new Error('Server not found')
    }
    store.set('activeServerId', id)
    // Update last used
    this.updateServer(id, { lastUsed: Date.now() })
  }
  
  /**
   * Get the active workspace (local server) if any.
   */
  getActiveWorkspace(): ServerConfig | null {
    const active = this.getActiveServer()
    return active?.isLocal ? active : null
  }
  
  /**
   * Check if workspaces feature is enabled.
   */
  getWorkspacesEnabled(): boolean {
    return store.get('workspacesEnabled')
  }
  
  /**
   * Enable or disable workspaces feature.
   */
  setWorkspacesEnabled(enabled: boolean): void {
    store.set('workspacesEnabled', enabled)
  }
  
  /**
   * Get the global default port for all workspaces.
   */
  getDefaultPort(): number | null {
    return store.get('defaultPort')
  }
  
  /**
   * Set the global default port for all workspaces.
   */
  setDefaultPort(port: number): void {
    store.set('defaultPort', port)
  }
}

export const serverManager = new ServerManager()
