import { registerIPCHandlers } from './ipc'
import {
  stopWorkspace,
  getHectorStatus,
  startWorkspace,
  isHectorInstalled
} from './hector/manager'
import { serverManager } from './servers/manager'
import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { mkdirSync } from 'fs'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    title: 'Hector Studio',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' || process.platform === 'win32' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  
  if (process.platform === 'darwin' && is.dev) {
    app.dock?.setIcon(icon)
  }
  
  return mainWindow
}

async function initializeApp(): Promise<void> {
  // Only create and start workspaces if hector is installed
  // This allows remote-only mode without local workspaces
  if (isHectorInstalled()) {
    const servers = serverManager.getServers()
    
    // Create default workspace if none exist
    if (servers.filter(s => s.isLocal).length === 0) {
      const documentsPath = app.getPath('documents')
      const defaultPath = join(documentsPath, 'Hector', 'Default')
      mkdirSync(defaultPath, { recursive: true })
      
      console.log('[main] Creating default workspace:', defaultPath)
      serverManager.addWorkspace('Default', defaultPath)
    }
    
    // Auto-start active workspace
    const activeWorkspace = serverManager.getActiveWorkspace()
    if (activeWorkspace) {
      console.log(`[main] Auto-starting workspace: ${activeWorkspace.name}`)
      try {
        await startWorkspace(activeWorkspace)
      } catch (err) {
        console.error('[main] Failed to start workspace:', err)
      }
    }
  } else {
    console.log('[main] Hector not installed, skipping workspace creation')
  }
  
  // Notify renderer that app is ready with status info
  const readyPayload = {
    hectorInstalled: isHectorInstalled(),
    hasWorkspaces: serverManager.getServers().filter(s => s.isLocal).length > 0,
    workspacesEnabled: serverManager.getWorkspacesEnabled()
  }
  console.log('[main] App ready:', readyPayload)
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('app:ready', readyPayload)
  })
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.electron')

  if (is.dev) {
    app.setName('Hector Studio')
  }
  
  app.setAboutPanelOptions({
    applicationName: 'Hector Studio',
    applicationVersion: '0.1.3',
    version: '0.1.3',
    iconPath: is.dev ? join(app.getAppPath(), 'resources/icon.png') : undefined,
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  registerIPCHandlers()

  const mainWindow = createWindow()
  
  // Initialize app after window is ready
  mainWindow.webContents.once('did-finish-load', () => {
    initializeApp().catch(err => {
      console.error('[main] Initialization failed:', err)
      // Still emit ready so app doesn't hang
      mainWindow.webContents.send('app:ready')
    })
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed
app.on('window-all-closed', () => {
  app.quit()
})

// Clean up on quit
app.on('before-quit', async () => {
  if (getHectorStatus() === 'running') {
    console.log('[main] Stopping workspace before quit...')
    await stopWorkspace()
  }
})

