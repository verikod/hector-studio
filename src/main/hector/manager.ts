/**
 * Hector Binary Manager
 * 
 * Manages the local Hector binary:
 * - Check if installed
 * - Download from GitHub releases
 * - Version checking
 * - Spawning/killing the process
 */

import { app, BrowserWindow } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { existsSync, mkdirSync, createWriteStream, chmodSync, unlinkSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { get as httpsGet } from 'https'
import { pipeline } from 'stream/promises'
import { setTrayState } from '../tray'

// Hector compatibility - should match Studio release
const HECTOR_COMPATIBILITY = {
  minVersion: '0.9.0',
  recommendedVersion: '0.9.0',
  downloadBaseUrl: 'https://github.com/kadirpekel/hector/releases/download'
}

// State
let hectorProcess: ChildProcess | null = null
let currentPort: number = 8080

type HectorStatus = 'not_installed' | 'stopped' | 'starting' | 'running' | 'error'
let currentStatus: HectorStatus = 'not_installed'

// Event callbacks
let onStatusChange: ((status: HectorStatus, error?: string) => void) | null = null
let onLog: ((line: string, isError: boolean) => void) | null = null

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
 */
function getHectorBinaryPath(): string {
  const ext = process.platform === 'win32' ? '.exe' : ''
  return join(getHectorDir(), `hector${ext}`)
}

/**
 * Get the version file path.
 */
function getVersionFilePath(): string {
  return join(getHectorDir(), 'version.txt')
}

/**
 * Check if Hector is installed.
 */
export function isHectorInstalled(): boolean {
  return existsSync(getHectorBinaryPath())
}

/**
 * Get the installed Hector version.
 */
export async function getInstalledVersion(): Promise<string | null> {
  const versionFile = getVersionFilePath()
  if (!existsSync(versionFile)) {
    return null
  }
  try {
    const version = await readFile(versionFile, 'utf-8')
    return version.trim()
  } catch {
    return null
  }
}

/**
 * Get the download URL for the current platform.
 */
function getDownloadUrl(version: string): string {
  const platform = process.platform === 'darwin' ? 'darwin'
    : process.platform === 'win32' ? 'windows'
    : 'linux'
  
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64'
  const ext = process.platform === 'win32' ? '.exe' : ''
  
  return `${HECTOR_COMPATIBILITY.downloadBaseUrl}/v${version}/hector-${platform}-${arch}${ext}`
}

/**
 * Download Hector binary from GitHub releases.
 */
export async function downloadHector(
  version: string = HECTOR_COMPATIBILITY.recommendedVersion,
  onProgress?: (percent: number) => void
): Promise<void> {
  const url = getDownloadUrl(version)
  const binaryPath = getHectorBinaryPath()
  const tempPath = `${binaryPath}.downloading`
  
  console.log(`[hector] Downloading from ${url}`)
  
  return new Promise((resolve, reject) => {
    const handleRedirect = (url: string): void => {
      httpsGet(url, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            handleRedirect(redirectUrl)
            return
          }
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`))
          return
        }
        
        const totalSize = parseInt(response.headers['content-length'] || '0', 10)
        let downloadedSize = 0
        
        const fileStream = createWriteStream(tempPath)
        
        response.on('data', (chunk: Buffer) => {
          downloadedSize += chunk.length
          if (totalSize > 0 && onProgress) {
            onProgress((downloadedSize / totalSize) * 100)
          }
        })
        
        pipeline(response, fileStream)
          .then(() => {
            // Move temp file to final location
            try {
              if (existsSync(binaryPath)) {
                unlinkSync(binaryPath)
              }
              // Rename by copying content (more reliable cross-platform)
              const fs = require('fs')
              fs.renameSync(tempPath, binaryPath)
              
              // Make executable on Unix
              if (process.platform !== 'win32') {
                chmodSync(binaryPath, 0o755)
              }
              
              // Save version
              writeFile(getVersionFilePath(), version)
                .then(() => {
                  console.log(`[hector] Downloaded v${version} successfully`)
                  setStatus('stopped')
                  resolve()
                })
                .catch(reject)
            } catch (err) {
              reject(err)
            }
          })
          .catch((err) => {
            // Clean up temp file on error
            try {
              if (existsSync(tempPath)) {
                unlinkSync(tempPath)
              }
            } catch {}
            reject(err)
          })
      }).on('error', reject)
    }
    
    handleRedirect(url)
  })
}

/**
 * Get the workspace directory.
 */
export function getWorkspaceDir(): string {
  const workspaceConfig = join(app.getPath('userData'), 'workspace.txt')
  if (existsSync(workspaceConfig)) {
    try {
      const workspace = require('fs').readFileSync(workspaceConfig, 'utf-8').trim()
      if (workspace && existsSync(workspace)) {
        return workspace
      }
    } catch {}
  }
  
  // Default workspace
  const defaultWorkspace = join(app.getPath('home'), 'hector-workspace')
  if (!existsSync(defaultWorkspace)) {
    mkdirSync(defaultWorkspace, { recursive: true })
  }
  return defaultWorkspace
}

/**
 * Set the workspace directory.
 */
export async function setWorkspaceDir(dir: string): Promise<void> {
  const workspaceConfig = join(app.getPath('userData'), 'workspace.txt')
  await writeFile(workspaceConfig, dir)
}

/**
 * Start the local Hector server.
 */
export async function startHector(port: number = 8080): Promise<void> {
  if (hectorProcess) {
    console.log('[hector] Already running')
    return
  }
  
  if (!isHectorInstalled()) {
    throw new Error('Hector is not installed. Please download it first.')
  }
  
  const binaryPath = getHectorBinaryPath()
  const workspaceDir = getWorkspaceDir()
  
  console.log(`[hector] Starting on port ${port} with workspace ${workspaceDir}`)
  setStatus('starting')
  
  // Find free port if default is taken
  currentPort = port
  
  // Start hector with studio mode enabled
  hectorProcess = spawn(binaryPath, [
    '--port', String(port),
    '--studio',
    '--cwd', workspaceDir
  ], {
    env: {
      ...process.env,
      // Add any additional env vars here
    },
    detached: false,
  })
  
  hectorProcess.stdout?.on('data', (data: Buffer) => {
    const line = data.toString().trim()
    console.log(`[hector] ${line}`)
    onLog?.(line, false)
    
    // Detect when server is ready
    if (line.includes('Listening on') || line.includes('Server started')) {
      setStatus('running')
    }
  })
  
  hectorProcess.stderr?.on('data', (data: Buffer) => {
    const line = data.toString().trim()
    console.error(`[hector] ${line}`)
    onLog?.(line, true)
  })
  
  hectorProcess.on('close', (code) => {
    console.log(`[hector] Process exited with code ${code}`)
    hectorProcess = null
    
    if (currentStatus === 'running' || currentStatus === 'starting') {
      // Unexpected exit
      setStatus('error', `Process exited with code ${code}`)
    } else {
      setStatus('stopped')
    }
  })
  
  hectorProcess.on('error', (err) => {
    console.error('[hector] Failed to start:', err)
    hectorProcess = null
    setStatus('error', err.message)
  })
  
  // Give it a moment to start
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Check if it's still running
  if (hectorProcess && !hectorProcess.killed) {
    setStatus('running')
  }
}

/**
 * Stop the local Hector server.
 */
export async function stopHector(): Promise<void> {
  if (!hectorProcess) {
    console.log('[hector] Not running')
    return
  }
  
  console.log('[hector] Stopping...')
  
  return new Promise((resolve) => {
    const proc = hectorProcess!
    
    // Set up exit handler
    proc.once('close', () => {
      hectorProcess = null
      setStatus('stopped')
      resolve()
    })
    
    // Try graceful shutdown first
    if (process.platform === 'win32') {
      proc.kill()
    } else {
      proc.kill('SIGTERM')
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (hectorProcess) {
          proc.kill('SIGKILL')
        }
      }, 5000)
    }
  })
}

/**
 * Get the current Hector status.
 */
export function getHectorStatus(): HectorStatus {
  return currentStatus
}

/**
 * Get the current port.
 */
export function getHectorPort(): number {
  return currentPort
}

/**
 * Get the local Hector URL.
 */
export function getHectorUrl(): string {
  return `http://localhost:${currentPort}`
}

/**
 * Register status change callback.
 */
export function onHectorStatusChange(
  callback: (status: HectorStatus, error?: string) => void
): void {
  onStatusChange = callback
}

/**
 * Register log callback.
 */
export function onHectorLog(
  callback: (line: string, isError: boolean) => void
): void {
  onLog = callback
}

/**
 * Internal: Update status and notify.
 */
function setStatus(status: HectorStatus, error?: string): void {
  currentStatus = status
  
  // Update tray
  const trayState = status === 'running' ? 'running'
    : status === 'starting' ? 'starting'
    : status === 'error' ? 'error'
    : 'stopped'
  setTrayState(trayState)
  
  // Notify callback
  onStatusChange?.(status, error)
  
  // Notify renderer
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('hector-status-change', { status, error })
  })
}

/**
 * Check for updates to Hector binary.
 */
export async function checkForUpdates(): Promise<{
  hasUpdate: boolean
  currentVersion: string | null
  latestVersion: string
}> {
  const current = await getInstalledVersion()
  // For now, just compare with recommended version
  // In a full implementation, we'd check GitHub releases API
  const latest = HECTOR_COMPATIBILITY.recommendedVersion
  
  return {
    hasUpdate: current !== latest,
    currentVersion: current,
    latestVersion: latest
  }
}
