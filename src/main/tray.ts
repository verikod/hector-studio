/**
 * Hector System Tray Manager
 * 
 * Provides a system tray icon with menu for:
 * - Opening/switching workspaces
 * - Managing the local Hector server
 * - Opening the main Studio window
 * - Quitting the application
 */

import { Tray, Menu, nativeImage, app, BrowserWindow, dialog } from 'electron'
import { join, basename } from 'path'
import { is } from '@electron-toolkit/utils'
import { serverManager } from './servers/manager'
import { 
  startWorkspace, 
  stopWorkspace, 
  getActiveWorkspaceId,
  isHectorInstalled,
  downloadHector
} from './hector/manager'

// Tray icon states
type TrayState = 'stopped' | 'starting' | 'running' | 'error'

let tray: Tray | null = null
let currentState: TrayState = 'stopped'

// Callbacks
let onOpenStudio: (() => void) | null = null
let onOpenPreferences: (() => void) | null = null
let onCheckUpdates: (() => void) | null = null

/**
 * Create the system tray icon and menu.
 */
export function createTray(): Tray {
  const iconPath = is.dev 
    ? join(app.getAppPath(), 'resources/icon.png')
    : join(__dirname, '../../resources/icon.png')
  
  let icon = nativeImage.createFromPath(iconPath)
  icon = icon.resize({ width: 16, height: 16 })
  
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true)
  }
  
  tray = new Tray(icon)
  tray.setToolTip('Hector')
  
  updateTrayMenu()
  
  tray.on('click', () => {
    showStudioWindow()
  })
  
  return tray
}

/**
 * Update the tray menu based on current state and workspaces.
 */
export function updateTrayMenu(): void {
  if (!tray) return
  
  const workspaces = serverManager.getWorkspaces()
  const activeWorkspaceId = getActiveWorkspaceId()
  const isRunning = currentState === 'running'
  
  const statusLabel = getStatusLabel()
  
  // Build workspace submenu
  const workspaceItems: Electron.MenuItemConstructorOptions[] = workspaces.map(ws => ({
    label: `${ws.name} (${basename(ws.workspacePath || '')})`,
    type: 'checkbox' as const,
    checked: ws.id === activeWorkspaceId,
    click: async () => {
      try {
        await startWorkspace(ws)
        updateTrayMenu()
      } catch (err) {
        console.error('[tray] Failed to start workspace:', err)
      }
    }
  }))
  
  if (workspaceItems.length > 0) {
    workspaceItems.push({ type: 'separator' })
  }
  
  workspaceItems.push({
    label: 'Open Workspace...',
    click: async () => {
      await openWorkspaceDialog()
    }
  })
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: statusLabel,
      enabled: false,
    },
    { type: 'separator' },
    
    // Workspaces submenu
    {
      label: 'Workspaces',
      submenu: workspaceItems
    },
    
    // Stop current workspace
    {
      label: 'Stop Workspace',
      enabled: isRunning,
      click: async () => {
        await stopWorkspace()
        updateTrayMenu()
      }
    },
    { type: 'separator' },
    
    // Settings
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
      click: async () => {
        if (currentState === 'running') {
          await stopWorkspace()
        }
        app.quit()
      }
    }
  ])
  
  tray.setContextMenu(contextMenu)
}

/**
 * Open a folder dialog to add a new workspace.
 */
async function openWorkspaceDialog(): Promise<void> {
  const result = await dialog.showOpenDialog({
    title: 'Select Workspace Folder',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Open Workspace'
  })
  
  if (result.canceled || result.filePaths.length === 0) {
    return
  }
  
  const workspacePath = result.filePaths[0]
  const name = basename(workspacePath)
  
  try {
    // Check if Hector is installed
    if (!isHectorInstalled()) {
      const downloadResult = await dialog.showMessageBox({
        type: 'question',
        buttons: ['Download', 'Cancel'],
        title: 'Hector Not Installed',
        message: 'Hector is not installed. Would you like to download it?'
      })
      
      if (downloadResult.response === 0) {
        await downloadHector()
      } else {
        return
      }
    }
    
    // Add workspace and start it
    const workspace = serverManager.addWorkspace(name, workspacePath)
    await startWorkspace(workspace)
    updateTrayMenu()
    
    // Notify renderers
    const servers = serverManager.getServers()
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('servers:updated', servers)
    })
  } catch (err: any) {
    console.error('[tray] Failed to add workspace:', err)
    dialog.showErrorBox('Failed to Open Workspace', err.message)
  }
}

function getStatusLabel(): string {
  const activeId = getActiveWorkspaceId()
  const workspace = activeId ? serverManager.getServer(activeId) : null
  const wsName = workspace ? ` - ${workspace.name}` : ''
  
  switch (currentState) {
    case 'stopped':
      return '⚪ Hector stopped'
    case 'starting':
      return `🟡 Starting${wsName}...`
    case 'running':
      return `🟢 Running${wsName}`
    case 'error':
      return '🔴 Error'
    default:
      return '⚪ Hector'
  }
}

function showStudioWindow(): void {
  const windows = BrowserWindow.getAllWindows()
  
  if (windows.length > 0) {
    const win = windows[0]
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  } else {
    onOpenStudio?.()
  }
}

/**
 * Update the tray state and refresh the menu.
 */
export function setTrayState(state: TrayState): void {
  currentState = state
  updateTrayMenu()
  
  if (tray) {
    tray.setToolTip(`Hector - ${getStatusLabel().replace(/[⚪🟡🟢🔴] /, '')}`)
  }
}

export function getTrayState(): TrayState {
  return currentState
}

/**
 * Register callbacks for tray menu actions.
 */
export function registerTrayCallbacks(callbacks: {
  onOpenStudio?: () => void
  onOpenPreferences?: () => void
  onCheckUpdates?: () => void
}): void {
  if (callbacks.onOpenStudio) onOpenStudio = callbacks.onOpenStudio
  if (callbacks.onOpenPreferences) onOpenPreferences = callbacks.onOpenPreferences
  if (callbacks.onCheckUpdates) onCheckUpdates = callbacks.onCheckUpdates
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
