import { registerIPCHandlers } from './ipc'
import { initializeUpdater } from './updater'
import {
  stopWorkspace,
  getHectorStatus,
  startWorkspace,
  isHectorInstalled,
  checkForUpdates
} from './hector/manager'
import { serverManager } from './servers/manager'
import { stateCoordinator } from './state/coordinator'
import { app, shell, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

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
  // Check for runtime updates
  let needsRuntimeUpdate = false

  if (isHectorInstalled()) {
    try {
      const updates = await checkForUpdates()
      needsRuntimeUpdate = updates.hasUpdate
      if (needsRuntimeUpdate) {
        console.log('[main] Runtime update required:', updates)
      }
    } catch (err) {
      console.error('[main] Failed to check for updates:', err)
    }

    // Auto-start active workspace only if:
    // 1. No runtime update needed
    // 2. Workspaces are enabled (will be validated by stateCoordinator)
    const activeWorkspace = serverManager.getActiveWorkspace()
    if (activeWorkspace && !needsRuntimeUpdate && serverManager.getWorkspacesEnabled()) {
      console.log(`[main] Auto-starting workspace: ${activeWorkspace.name}`)
      startWorkspace(activeWorkspace).catch(err => {
        console.error('[main] Failed to start workspace:', err)
      })
    }
  } else {
    console.log('[main] Hector not installed, skipping workspace auto-start')
  }

  // Use centralized state coordinator to validate and sync state
  // This enforces business rules: license required for workspaces, etc.
  const state = await stateCoordinator.validateAndSync()

  // Also send app:ready for backwards compatibility (includes needsRuntimeUpdate)
  const readyPayload = {
    hectorInstalled: state.hectorInstalled,
    hasWorkspaces: serverManager.getServers().filter(s => s.isLocal).length > 0,
    workspacesEnabled: state.workspacesEnabled,
    needsRuntimeUpdate,
    isLicensed: state.isLicensed
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
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    iconPath: is.dev ? join(app.getAppPath(), 'resources/icon.png') : undefined,
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register Cmd+Shift+D (Ctrl+Shift+D on Windows/Linux) to toggle DevTools
  // Works in both development and production builds for debugging
  globalShortcut.register('CommandOrControl+Shift+D', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    if (focusedWindow) {
      if (focusedWindow.webContents.isDevToolsOpened()) {
        focusedWindow.webContents.closeDevTools()
      } else {
        focusedWindow.webContents.openDevTools()
      }
    }
  })

  ipcMain.on('ping', () => console.log('pong'))

  registerIPCHandlers()
  initializeUpdater()

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

