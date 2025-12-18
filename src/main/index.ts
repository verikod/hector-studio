import { registerIPCHandlers } from './ipc'
import { createTray, registerTrayCallbacks, destroyTray } from './tray'
import {
  stopWorkspace,
  downloadHector,
  checkForUpdates,
  getHectorStatus,
  startWorkspace
} from './hector/manager'
import { serverManager } from './servers/manager'
import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

function createWindow(): void {
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
}

app.whenReady().then(() => {
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

  // Create system tray
  createTray()
  
  // Register callbacks for tray actions that need window creation
  registerTrayCallbacks({
    onOpenStudio: () => {
      createWindow()
    },
    onOpenPreferences: () => {
      console.log('[tray] Preferences requested')
    },
    onCheckUpdates: async () => {
      try {
        const { hasUpdate, currentVersion, latestVersion } = await checkForUpdates()
        if (hasUpdate) {
          const result = await dialog.showMessageBox({
            type: 'info',
            buttons: ['Update', 'Later'],
            defaultId: 0,
            title: 'Update Available',
            message: `Hector ${latestVersion} is available (you have ${currentVersion || 'none'}).`
          })
          
          if (result.response === 0) {
            await downloadHector(latestVersion)
            dialog.showMessageBox({
              type: 'info',
              title: 'Update Complete',
              message: `Hector has been updated to v${latestVersion}.`
            })
          }
        } else {
          dialog.showMessageBox({
            type: 'info',
            title: 'No Updates',
            message: `You have the latest version${currentVersion ? ` (v${currentVersion})` : ''}.`
          })
        }
      } catch (err) {
        console.error('[main] Failed to check updates:', err)
        dialog.showErrorBox('Update Check Failed', String(err))
      }
    }
  })

  // Auto-start last active workspace
  const activeWorkspace = serverManager.getActiveWorkspace()
  if (activeWorkspace) {
    console.log(`[main] Auto-starting last active workspace: ${activeWorkspace.name}`)
    // Don't await this, let it start in background
    startWorkspace(activeWorkspace).catch(err => {
      console.error('[main] Failed to auto-start workspace:', err)
    })
  }

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Keep app running in tray when all windows closed
app.on('window-all-closed', () => {
  if (process.platform === 'darwin') {
    app.dock?.hide()
  }
})

// Clean up on quit
app.on('before-quit', async () => {
  if (getHectorStatus() === 'running') {
    console.log('[main] Stopping workspace before quit...')
    await stopWorkspace()
  }
  destroyTray()
})
