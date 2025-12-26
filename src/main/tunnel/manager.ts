/**
 * Cloudflare Tunnel Manager
 *
 * Manages Quick Tunnels using cloudflared to expose local workspaces
 * to the public internet via *.trycloudflare.com URLs.
 */

import { BrowserWindow } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { bin, install } from 'cloudflared'
import { existsSync } from 'fs'
import { serverManager } from '../servers/manager'

export interface TunnelState {
  workspaceId: string
  publicUrl: string | null
  status: 'stopped' | 'starting' | 'running' | 'error'
  error?: string
}

// Active tunnels by workspace ID (in practice, only one at a time)
const tunnels: Map<string, { process: ChildProcess; state: TunnelState }> = new Map()

/**
 * Emit tunnel status change to all renderer windows.
 */
function emitTunnelStatus(state: TunnelState): void {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('tunnel:status-change', state)
  })
}

/**
 * Ensure cloudflared binary is installed.
 */
async function ensureCloudflared(): Promise<string> {
  const binaryPath = bin
  if (!existsSync(binaryPath)) {
    console.log('[tunnel] Installing cloudflared binary...')
    await install(binaryPath)
    console.log('[tunnel] cloudflared installed successfully')
  }
  return binaryPath
}

/**
 * Start a Quick Tunnel for a workspace.
 */
export async function startTunnel(workspaceId: string): Promise<void> {
  // Check if already running
  const existing = tunnels.get(workspaceId)
  if (existing && existing.state.status === 'running') {
    console.log(`[tunnel] Tunnel already running for workspace ${workspaceId}`)
    return
  }

  // Get workspace port
  const workspace = serverManager.getServer(workspaceId)
  if (!workspace?.port) {
    throw new Error('Workspace not found or has no port assigned')
  }

  const port = workspace.port
  console.log(`[tunnel] Starting tunnel for workspace ${workspaceId} on port ${port}`)

  // Set starting state
  const state: TunnelState = {
    workspaceId,
    publicUrl: null,
    status: 'starting'
  }
  emitTunnelStatus(state)

  try {
    // Ensure cloudflared is installed
    const binaryPath = await ensureCloudflared()

    // Quick Tunnel uses: cloudflared tunnel --url http://localhost:PORT
    // NOT "tunnel run" which requires a named tunnel ID
    const proc = spawn(binaryPath, [
      'tunnel',
      '--url', `http://localhost:${port}`
    ], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    // Store tunnel
    tunnels.set(workspaceId, { process: proc, state })

    // Parse URL from output (cloudflared outputs URL to stderr)
    const urlPattern = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/

    proc.stderr?.on('data', (data: Buffer) => {
      const line = data.toString()
      console.log(`[tunnel] ${line.trim()}`)

      // Look for the public URL
      const match = line.match(urlPattern)
      if (match && state.status === 'starting') {
        state.publicUrl = match[0]
        state.status = 'running'
        console.log(`[tunnel] Public URL ready: ${state.publicUrl}`)
        emitTunnelStatus(state)
      }
    })

    proc.stdout?.on('data', (data: Buffer) => {
      const line = data.toString()
      console.log(`[tunnel] ${line.trim()}`)

      // Also check stdout for URL
      const match = line.match(urlPattern)
      if (match && state.status === 'starting') {
        state.publicUrl = match[0]
        state.status = 'running'
        console.log(`[tunnel] Public URL ready: ${state.publicUrl}`)
        emitTunnelStatus(state)
      }
    })

    proc.on('close', (code) => {
      console.log(`[tunnel] Process exited with code ${code}`)
      tunnels.delete(workspaceId)

      if (state.status === 'running' || state.status === 'starting') {
        state.status = code === 0 ? 'stopped' : 'error'
        state.error = code !== 0 ? `Tunnel exited with code ${code}` : undefined
        state.publicUrl = null
        emitTunnelStatus(state)
      }
    })

    proc.on('error', (err) => {
      console.error('[tunnel] Process error:', err)
      tunnels.delete(workspaceId)
      state.status = 'error'
      state.error = err.message
      state.publicUrl = null
      emitTunnelStatus(state)
    })

    // Timeout for URL detection
    setTimeout(() => {
      if (state.status === 'starting') {
        console.warn('[tunnel] Timeout waiting for tunnel URL')
        state.status = 'error'
        state.error = 'Timeout waiting for tunnel to start'
        emitTunnelStatus(state)
        proc.kill()
      }
    }, 30000) // 30 second timeout

  } catch (err) {
    state.status = 'error'
    state.error = (err as Error).message
    emitTunnelStatus(state)
    throw err
  }
}

/**
 * Stop the tunnel for a workspace.
 */
export async function stopTunnel(workspaceId: string): Promise<void> {
  const entry = tunnels.get(workspaceId)
  if (!entry) {
    console.log(`[tunnel] No tunnel running for workspace ${workspaceId}`)
    return
  }

  console.log(`[tunnel] Stopping tunnel for workspace ${workspaceId}`)
  
  return new Promise((resolve) => {
    entry.process.once('close', () => {
      tunnels.delete(workspaceId)
      entry.state.status = 'stopped'
      entry.state.publicUrl = null
      emitTunnelStatus(entry.state)
      resolve()
    })

    entry.process.kill('SIGTERM')

    // Force kill after timeout
    setTimeout(() => {
      if (tunnels.has(workspaceId)) {
        entry.process.kill('SIGKILL')
      }
    }, 5000)
  })
}

/**
 * Get the current tunnel state for a workspace.
 */
export function getTunnelState(workspaceId: string): TunnelState | null {
  const entry = tunnels.get(workspaceId)
  return entry?.state ?? null
}

/**
 * Stop all running tunnels (called on app quit or workspace cleanup).
 */
export async function stopAllTunnels(): Promise<void> {
  const workspaceIds = Array.from(tunnels.keys())
  await Promise.all(workspaceIds.map(id => stopTunnel(id)))
}
