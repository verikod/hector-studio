/**
 * Hector System Tray Manager
 * 
 * Provides a system tray icon with menu for:
 * - Starting/stopping local Hector server
 * - Opening the main Studio window
 * - Accessing preferences and updates
 * - Quitting the application
 * 
 * Follows Docker Desktop pattern: tray persists even when main window is closed.
 */

import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

// Tray icon states
type TrayState = 'stopped' | 'starting' | 'running' | 'error'

let tray: Tray | null = null
let currentState: TrayState = 'stopped'

// Callbacks for tray actions
let onStartHector: (() => void) | null = null
let onStopHector: (() => void) | null = null
let onOpenStudio: (() => void) | null = null
let onOpenPreferences: (() => void) | null = null
let onCheckUpdates: (() => void) | null = null

/**
 * Create the system tray icon and menu.
 * Should be called once during app initialization.
 */
export function createTray(): Tray {
  // Get icon path - use the same icon for now, system will adapt
  const iconPath = is.dev 
    ? join(app.getAppPath(), 'resources/icon.png')
    : join(__dirname, '../../resources/icon.png')
  
  // Create a native image and resize for tray (16x16 on most platforms)
  let icon = nativeImage.createFromPath(iconPath)
  
  // Resize for tray - macOS expects 16x16 or 22x22, Windows 16x16
  icon = icon.resize({ width: 16, height: 16 })
  
  // On macOS, set as template image for proper dark/light mode handling
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true)
  }
  
  tray = new Tray(icon)
  tray.setToolTip('Hector')
  
  updateTrayMenu()
  
  // Handle tray click - show Studio window
  tray.on('click', () => {
    showStudioWindow()
  })
  
  return tray
}

/**
 * Update the tray menu based on current state.
 */
function updateTrayMenu(): void {
  if (!tray) return
  
  const isRunning = currentState === 'running'
  const isStarting = currentState === 'starting'
  
  const statusLabel = getStatusLabel()
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: statusLabel,
      enabled: false,
      icon: getStatusIcon(),
    },
    { type: 'separator' },
    
    // Start/Stop Hector
    {
      label: isRunning ? 'Stop Hector' : 'Start Hector',
      enabled: !isStarting,
      click: () => {
        if (isRunning) {
          onStopHector?.()
        } else {
          onStartHector?.()
        }
      }
    },
    { type: 'separator' },
    
    // Workspace (placeholder for now)
    {
      label: 'Workspace: ~/hector-workspace',
      enabled: false,
    },
    {
      label: 'Change Workspace...',
      enabled: false, // TODO: Implement in Phase 4
    },
    { type: 'separator' },
    
    // Settings
    {
      label: 'Environment Variables...',
      enabled: false, // TODO: Implement in Phase 4
      click: () => onOpenPreferences?.()
    },
    {
      label: 'Preferences...',
      click: () => onOpenPreferences?.()
    },
    {
      label: 'Check for Updates',
      click: () => onCheckUpdates?.()
    },
    { type: 'separator' },
    
    // Studio window
    {
      label: 'Open Hector Studio',
      click: () => showStudioWindow()
    },
    { type: 'separator' },
    
    // Quit
    {
      label: 'Quit',
      click: () => {
        // Stop Hector if running, then quit
        if (currentState === 'running') {
          onStopHector?.()
        }
        app.quit()
      }
    }
  ])
  
  tray.setContextMenu(contextMenu)
}

/**
 * Get the status label for the current state.
 */
function getStatusLabel(): string {
  switch (currentState) {
    case 'stopped':
      return '⚪ Hector is stopped'
    case 'starting':
      return '🟡 Hector is starting...'
    case 'running':
      return '🟢 Hector is running'
    case 'error':
      return '🔴 Hector error'
    default:
      return '⚪ Hector'
  }
}

/**
 * Get the status icon for the menu (optional, may not work on all platforms).
 */
function getStatusIcon(): Electron.NativeImage | undefined {
  // Return undefined for now - emoji in label is sufficient
  return undefined
}

/**
 * Show the main Studio window, creating it if needed.
 */
function showStudioWindow(): void {
  const windows = BrowserWindow.getAllWindows()
  
  if (windows.length > 0) {
    const win = windows[0]
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  } else {
    // Need to create window - call the provided callback
    onOpenStudio?.()
  }
}

/**
 * Update the tray state and refresh the menu.
 */
export function setTrayState(state: TrayState): void {
  currentState = state
  updateTrayMenu()
  
  // Update tooltip
  if (tray) {
    tray.setToolTip(`Hector - ${getStatusLabel().replace(/[⚪🟡🟢🔴] /, '')}`)
  }
}

/**
 * Get the current tray state.
 */
export function getTrayState(): TrayState {
  return currentState
}

/**
 * Register callbacks for tray menu actions.
 */
export function registerTrayCallbacks(callbacks: {
  onStartHector?: () => void
  onStopHector?: () => void
  onOpenStudio?: () => void
  onOpenPreferences?: () => void
  onCheckUpdates?: () => void
}): void {
  if (callbacks.onStartHector) onStartHector = callbacks.onStartHector
  if (callbacks.onStopHector) onStopHector = callbacks.onStopHector
  if (callbacks.onOpenStudio) onOpenStudio = callbacks.onOpenStudio
  if (callbacks.onOpenPreferences) onOpenPreferences = callbacks.onOpenPreferences
  if (callbacks.onCheckUpdates) onCheckUpdates = callbacks.onCheckUpdates
}

/**
 * Destroy the tray icon.
 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
