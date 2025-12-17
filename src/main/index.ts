import { registerIPCHandlers } from './ipc'
import { createTray, registerTrayCallbacks, destroyTray } from './tray'
import {
  isHectorInstalled,
  startHector,
  stopHector,
  downloadHector,
  checkForUpdates,
  getHectorStatus
} from './hector/manager'
import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

function createWindow(): void {
  // Create the browser window.
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

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  
  // Set the dock icon for macOS in development
  if (process.platform === 'darwin' && is.dev) {
    app.dock?.setIcon(icon)
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Set app name for development
  if (is.dev) {
    app.setName('Hector Studio')
  }
  
  app.setAboutPanelOptions({
    applicationName: 'Hector Studio',
    applicationVersion: '0.1.0',
    version: '0.1.0',
    iconPath: is.dev ? join(app.getAppPath(), 'resources/icon.png') : undefined,
  })

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  registerIPCHandlers()

  // Create system tray (Docker Desktop pattern)
  createTray()
  
  // Register tray callbacks with Hector manager
  registerTrayCallbacks({
    onStartHector: async () => {
      try {
        if (!isHectorInstalled()) {
          const result = await dialog.showMessageBox({
            type: 'question',
            buttons: ['Download', 'Cancel'],
            defaultId: 0,
            title: 'Hector Not Installed',
            message: 'Hector is not installed. Would you like to download it?'
          })
          
          if (result.response === 0) {
            console.log('[main] Downloading Hector...')
            await downloadHector()
            console.log('[main] Download complete, starting Hector...')
            await startHector()
          }
        } else {
          await startHector()
        }
      } catch (err) {
        console.error('[main] Failed to start Hector:', err)
        dialog.showErrorBox('Failed to Start Hector', String(err))
      }
    },
    onStopHector: async () => {
      try {
        await stopHector()
      } catch (err) {
        console.error('[main] Failed to stop Hector:', err)
      }
    },
    onOpenStudio: () => {
      createWindow()
    },
    onOpenPreferences: () => {
      // TODO: Open preferences window/modal
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

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// When all windows are closed, keep the app running in the tray.
// Only quit when explicitly requested via tray menu or Cmd+Q.
// This follows the Docker Desktop pattern.
app.on('window-all-closed', () => {
  // Don't quit - keep running in system tray
  // On macOS, hide dock icon when no windows are open
  if (process.platform === 'darwin') {
    app.dock?.hide()
  }
})

// Clean up on quit
app.on('before-quit', async () => {
  // Stop Hector if running
  if (getHectorStatus() === 'running') {
    console.log('[main] Stopping Hector before quit...')
    await stopHector()
  }
  destroyTray()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
