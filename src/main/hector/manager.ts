/**
 * Hector Binary Manager
 * 
 * Manages the local Hector binary:
 * - Check if installed
 * - Download from GitHub releases
 * - Version checking
 * - Spawning/killing the process (one workspace at a time)
 */

import { app, BrowserWindow, net } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { existsSync, mkdirSync, createWriteStream, chmodSync, unlinkSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { get as httpsGet } from 'https'
import { pipeline } from 'stream/promises'
import { serverManager, ServerConfig } from '../servers/manager'

// Hector compatibility - should match Studio release
const HECTOR_COMPATIBILITY = {
    minVersion: '0.9.3',
    recommendedVersion: '0.9.3',
    downloadBaseUrl: 'https://github.com/verikod/hector/releases/download'
}

// State for the single active workspace
let hectorProcess: ChildProcess | null = null
let activeWorkspaceId: string | null = null

type HectorStatus = 'not_installed' | 'stopped' | 'starting' | 'running' | 'error'
let currentStatus: HectorStatus = 'not_installed'

// Event callbacks
let onStatusChange: ((status: HectorStatus, error?: string) => void) | null = null
let onLog: ((line: string, isError: boolean) => void) | null = null

// Log buffer for UI access
interface LogEntry {
    line: string
    isError: boolean
    timestamp: number
}
const MAX_LOG_LINES = 500
let logBuffer: LogEntry[] = []

/**
 * Add a log entry to the buffer and emit to all renderer windows.
 */
function addLogEntry(line: string, isError: boolean): void {
    const entry: LogEntry = { line, isError, timestamp: Date.now() }
    logBuffer.push(entry)
    if (logBuffer.length > MAX_LOG_LINES) {
        logBuffer.shift()
    }
    // Emit to all renderer windows
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('hector:log', entry)
    })
    // Also call the legacy callback if set
    onLog?.(line, isError)
}

/**
 * Get all log entries in the buffer.
 */
export function getLogs(): LogEntry[] {
    return [...logBuffer]
}

/**
 * Clear the log buffer.
 */
export function clearLogs(): void {
    logBuffer = []
}

// Startup timeout configuration
const STARTUP_TIMEOUT_MS = 30000 // 30 seconds max wait for hector to start
const HEALTH_POLL_INTERVAL_MS = 200 // Check health every 200ms

/**
 * Wait for Hector server to be healthy by polling /health endpoint.
 * Returns true if healthy within timeout, false otherwise.
 */
async function waitForHealthy(url: string, timeoutMs: number = STARTUP_TIMEOUT_MS): Promise<boolean> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeoutMs) {
        // Check if process died while waiting
        if (!hectorProcess || hectorProcess.killed) {
            console.log('[hector] Process died while waiting for health check')
            return false
        }
        
        try {
            const response = await net.fetch(`${url}/health`, {
                signal: AbortSignal.timeout(2000) // 2s timeout per request
            })
            if (response.ok) {
                console.log(`[hector] Health check passed after ${Date.now() - startTime}ms`)
                return true
            }
        } catch {
            // Server not ready yet, continue polling
        }
        
        await new Promise(r => setTimeout(r, HEALTH_POLL_INTERVAL_MS))
    }
    
    console.log(`[hector] Health check timed out after ${timeoutMs}ms`)
    return false
}

/**
 * Emit status change event for a workspace to all renderer windows.
 */
function emitWorkspaceStatus(workspaceId: string, status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error', error?: string): void {
    const statusEvent = {
        id: workspaceId,
        status: status === 'running' ? 'authenticated'
            : status === 'error' ? 'error'
                : status === 'stopped' ? 'stopped'
                    : status === 'stopping' ? 'stopping'
                        : 'checking',
        error
    }
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('server:status-change', statusEvent)
    })
}

/**
 * Notify renderers that server list has changed.
 */
function emitServersUpdated(): void {
    const servers = serverManager.getServers()
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('servers:updated', servers)
    })
}

// ============================================================================
// Binary Management
// ============================================================================

/**
 * Get the Hector binary directory.
 */
function getHectorDir(): string {
    const dir = join(app.getPath('userData'), 'hector')
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
    }
    return dir
}

/**
 * Get the Hector binary path.
 * In development, can be overridden with DEV_HECTOR_PATH environment variable.
 */
function getHectorBinaryPath(): string {
    const devPath = process.env.DEV_HECTOR_PATH
    if (devPath) {
        console.log(`[hector] DEV_HECTOR_PATH=${devPath}`)
        if (existsSync(devPath)) {
            console.log(`[hector] Using dev binary: ${devPath}`)
            return devPath
        }
    }

    const ext = process.platform === 'win32' ? '.exe' : ''
    return join(getHectorDir(), `hector${ext}`)
}

function getVersionFilePath(): string {
    return join(getHectorDir(), 'version.txt')
}

export function isHectorInstalled(): boolean {
    return existsSync(getHectorBinaryPath())
}

export async function getInstalledVersion(): Promise<string | null> {
    const versionFile = getVersionFilePath()
    if (!existsSync(versionFile)) return null
    try {
        return (await readFile(versionFile, 'utf-8')).trim()
    } catch {
        return null
    }
}

// ============================================================================
// Download Management
// ============================================================================

function getDownloadUrl(version: string): string {
    const platform = process.platform
    const arch = process.arch

    let osName: string
    let archName: string
    let ext: string

    switch (platform) {
        case 'darwin':
            osName = 'darwin'
            ext = 'tar.gz'
            break
        case 'linux':
            osName = 'linux'
            ext = 'tar.gz'
            break
        case 'win32':
            osName = 'windows'
            ext = 'zip'
            break
        default:
            throw new Error(`Unsupported platform: ${platform}`)
    }

    switch (arch) {
        case 'x64':
            archName = 'amd64'
            break
        case 'arm64':
            archName = 'arm64'
            break
        default:
            throw new Error(`Unsupported architecture: ${arch}`)
    }

    const filename = `hector_${version}_${osName}_${archName}.${ext}`
    return `${HECTOR_COMPATIBILITY.downloadBaseUrl}/v${version}/${filename}`
}

export async function downloadHector(
    version: string = HECTOR_COMPATIBILITY.recommendedVersion,
    onProgress?: (percent: number) => void
): Promise<void> {
    const url = getDownloadUrl(version)
    console.log(`[hector] Downloading from: ${url}`)

    const hectorDir = getHectorDir()
    const isZip = url.endsWith('.zip')
    const archivePath = join(hectorDir, isZip ? 'hector.zip' : 'hector.tar.gz')
    const binaryPath = getHectorBinaryPath()

    await new Promise<void>((resolve, reject) => {
        const getWithRedirects = (currentUrl: string, redirectCount = 0) => {
            if (redirectCount > 5) {
                reject(new Error('Too many redirects'))
                return
            }

            httpsGet(currentUrl, (response) => {
                if (response.statusCode === 302 || response.statusCode === 301) {
                    const redirectUrl = response.headers.location
                    if (redirectUrl) {
                        getWithRedirects(redirectUrl, redirectCount + 1)
                        return
                    }
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`Download failed: ${response.statusCode}`))
                    return
                }

                const totalSize = parseInt(response.headers['content-length'] || '0', 10)
                let downloadedSize = 0

                response.on('data', (chunk: Buffer) => {
                    downloadedSize += chunk.length
                    if (totalSize > 0 && onProgress) {
                        onProgress((downloadedSize / totalSize) * 100)
                    }
                })

                const fileStream = createWriteStream(archivePath)
                pipeline(response, fileStream)
                    .then(() => resolve())
                    .catch(reject)
            }).on('error', reject)
        }

        getWithRedirects(url)
    })

    console.log(`[hector] Downloaded archive to: ${archivePath}`)

    // Extract
    if (isZip) {
        const AdmZip = require('adm-zip')
        const zip = new AdmZip(archivePath)
        zip.extractAllTo(hectorDir, true)
    } else {
        const tar = require('tar')
        await tar.x({
            file: archivePath,
            cwd: hectorDir,
            strip: 0
        })
    }

    // Make executable on Unix
    if (process.platform !== 'win32') {
        chmodSync(binaryPath, 0o755)
    }

    // Clean up and save version
    unlinkSync(archivePath)
    await writeFile(getVersionFilePath(), version)

    console.log(`[hector] Installed version ${version}`)
}

// ============================================================================
// Process Management (One Workspace at a Time)
// ============================================================================

/**
 * Get the currently active workspace ID.
 */
export function getActiveWorkspaceId(): string | null {
    return activeWorkspaceId
}

/**
 * Start Hector for a specific workspace.
 * Stops any currently running workspace first.
 */
export async function startWorkspace(workspace: ServerConfig): Promise<void> {
    if (!workspace.isLocal || !workspace.workspacePath || !workspace.port) {
        throw new Error('Invalid workspace configuration')
    }

    // Stop current workspace if different
    if (hectorProcess && activeWorkspaceId !== workspace.id) {
        console.log(`[hector] Switching from workspace ${activeWorkspaceId} to ${workspace.id}`)
        await stopWorkspace()
    }

    if (hectorProcess) {
        console.log('[hector] Already running this workspace')
        // Ensure state is synced even if already running
        if (currentStatus === 'running') {
            serverManager.setActiveServer(workspace.id)
            emitServersUpdated()
            emitWorkspaceStatus(workspace.id, 'running')
        }
        return
    }

    if (!isHectorInstalled()) {
        throw new Error('Hector is not installed. Please download it first.')
    }

    const binaryPath = getHectorBinaryPath()
    const { workspacePath, port, id } = workspace

    // Ensure workspace directory exists
    if (!existsSync(workspacePath)) {
        mkdirSync(workspacePath, { recursive: true })
    }

    console.log(`[hector] Starting workspace ${id} on port ${port}: ${workspacePath}`)
    setStatus('starting')
    activeWorkspaceId = id
    emitWorkspaceStatus(id, 'starting')

    const configPath = join(workspacePath, 'agents.yaml')

    hectorProcess = spawn(binaryPath, [
        'serve',
        '--port', String(port),
        '--studio',
        '--config', configPath
    ], {
        cwd: workspacePath,
        env: { ...process.env },
        detached: false,
    })

    hectorProcess.stdout?.on('data', (data: Buffer) => {
        const line = data.toString().trim()
        console.log(`[hector] ${line}`)
        addLogEntry(line, false)
    })

    hectorProcess.stderr?.on('data', (data: Buffer) => {
        const line = data.toString().trim()
        console.error(`[hector] ${line}`)
        addLogEntry(line, true)
    })

    hectorProcess.on('close', (code) => {
        console.log(`[hector] Process exited with code ${code}`)
        const wasId = activeWorkspaceId
        hectorProcess = null
        activeWorkspaceId = null

        if (currentStatus === 'running' || currentStatus === 'starting') {
            setStatus('error', `Process exited with code ${code}`)
            if (wasId) emitWorkspaceStatus(wasId, 'error', `Process exited with code ${code}`)
        } else {
            setStatus('stopped')
            if (wasId) emitWorkspaceStatus(wasId, 'stopped')
        }
    })

    hectorProcess.on('error', (err) => {
        console.error('[hector] Failed to start:', err)
        hectorProcess = null
        activeWorkspaceId = null
        setStatus('error', err.message)
        emitWorkspaceStatus(id, 'error', err.message)
    })

    // Wait for server to actually respond to health checks.
    // This is the authoritative source of truth for 'running' status.
    // Once healthy, we emit 'running' which maps to 'authenticated' in the renderer.
    // Local workspaces in the renderer wait for this IPC event rather than probing directly.
    const serverUrl = `http://localhost:${port}`
    console.log(`[hector] Waiting for health check at ${serverUrl}/health...`)

    // Set as active server immediately to ensure persistence matches intent
    // even if we restart before health check completes
    serverManager.setActiveServer(id)
    emitServersUpdated()

    // Detached health check to prevent blocking UI
    const checkHealth = async () => {
        const proc = hectorProcess
        if (!proc) return

        const isHealthy = await waitForHealthy(serverUrl)

        // Check if process was replaced while we were waiting
        if (hectorProcess !== proc) {
            console.log('[hector] Process replaced during health check, ignoring result')
            return
        }
        
        if (isHealthy && !proc.killed) {
            setStatus('running')
            emitWorkspaceStatus(id, 'running')
        } else if (!proc.killed) {
            // Process is running but not responding to health checks - kill it
            const errorMsg = 'Server failed to respond to health checks within timeout'
            console.error('[hector]', errorMsg)
            
            // Terminate the unresponsive process
            console.log('[hector] Killing unresponsive process...')
            proc.kill('SIGKILL')
            
            // Cleanup provided we are still the global active process
            if (hectorProcess === proc) {
                hectorProcess = null
                activeWorkspaceId = null
                setStatus('error', errorMsg)
                emitWorkspaceStatus(id, 'error', errorMsg)
            }
        }
    }

    checkHealth().catch(err => {
        console.error('[hector] Error in health check loop:', err)
    })
}

/**
 * Stop the currently running workspace.
 */
export async function stopWorkspace(): Promise<void> {
    if (!hectorProcess) {
        console.log('[hector] No workspace running')
        return
    }

    const workspaceId = activeWorkspaceId
    console.log(`[hector] Stopping workspace ${workspaceId}...`)

    if (workspaceId) {
        emitWorkspaceStatus(workspaceId, 'stopping')
    }

    return new Promise((resolve) => {
        const proc = hectorProcess!

        proc.once('close', () => {
            hectorProcess = null
            activeWorkspaceId = null
            setStatus('stopped')
            if (workspaceId) {
                emitWorkspaceStatus(workspaceId, 'stopped')
            }
            resolve()
        })

        if (process.platform === 'win32') {
            proc.kill()
        } else {
            proc.kill('SIGTERM')
            setTimeout(() => {
                if (hectorProcess) {
                    proc.kill('SIGKILL')
                }
            }, 5000)
        }
    })
}

/**
 * Switch to a different workspace.
 * Stops current → Starts new.
 */
export async function switchWorkspace(workspaceId: string): Promise<void> {
    const workspace = serverManager.getServer(workspaceId)
    if (!workspace) {
        throw new Error(`Workspace ${workspaceId} not found`)
    }
    if (!workspace.isLocal) {
        throw new Error('Cannot switch to a remote server')
    }

    await startWorkspace(workspace)
}

// ============================================================================
// Status & Callbacks
// ============================================================================

export function getHectorStatus(): HectorStatus {
    return currentStatus
}

export function onHectorStatusChange(
    callback: (status: HectorStatus, error?: string) => void
): void {
    onStatusChange = callback
}

export function onHectorLog(
    callback: (line: string, isError: boolean) => void
): void {
    onLog = callback
}

function setStatus(status: HectorStatus, error?: string): void {
    currentStatus = status

    onStatusChange?.(status, error)

    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('hector-status-change', { status, error })
    })
}

export async function checkForUpdates(): Promise<{
    hasUpdate: boolean
    currentVersion: string | null
    latestVersion: string
}> {
    const current = await getInstalledVersion()
    const latest = HECTOR_COMPATIBILITY.recommendedVersion

    return {
        hasUpdate: current !== latest,
        currentVersion: current,
        latestVersion: latest
    }
}

export async function upgradeHector(onProgress?: (percent: number) => void): Promise<void> {
    // 1. Stop workspace if running
    if (currentStatus === 'running' || currentStatus === 'starting') {
        console.log('[hector] Stopping workspace for upgrade...')
        await stopWorkspace()
        // Small delay to ensure processes are fully detached/files unlocked
        await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // 2. Download new version
    const latest = HECTOR_COMPATIBILITY.recommendedVersion
    console.log(`[hector] Upgrading to version ${latest}...`)

    // Clean old binary before download to prevent stale files or permission issues
    const binaryPath = getHectorBinaryPath()
    if (existsSync(binaryPath)) {
        try {
            unlinkSync(binaryPath)
        } catch (e) {
            console.warn('[hector] Failed to delete old binary before upgrade:', e)
        }
    }

    await downloadHector(latest, onProgress)
}

// Legacy compatibility - these now delegate to workspace functions
export async function startHector(_port: number = 8080): Promise<void> {
    const active = serverManager.getActiveWorkspace()
    if (active) {
        await startWorkspace(active)
    } else {
        throw new Error('No workspace selected. Add a workspace first.')
    }
}

export async function stopHector(): Promise<void> {
    await stopWorkspace()
}
