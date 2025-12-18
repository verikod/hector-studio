import { autoUpdater } from 'electron-updater'
import { ipcMain, BrowserWindow } from 'electron'

// Configure autoUpdater
autoUpdater.autoDownload = false // We want to prompt the user or handle flow explicitly
autoUpdater.autoInstallOnAppQuit = true

// Helper to broadcast status to all windows
function broadcastStatus(status: string, data?: any) {
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('app:update-status', { status, data })
    })
}

export function initializeUpdater() {
    console.log('[updater] Initializing auto-updater...')

    // Prevent errors in dev mode
    if (process.env.ELECTRON_RENDERER_URL) {
        console.log('[updater] Running in dev mode, auto-updater disabled (mocking enabled)')
        // Mock handlers for dev testing
        setupIpcHandlers(true)
        return
    }

    // Event Listeners
    autoUpdater.on('checking-for-update', () => {
        console.log('[updater] Checking for update...')
        broadcastStatus('checking')
    })

    autoUpdater.on('update-available', (info) => {
        console.log('[updater] Update available:', info)
        broadcastStatus('available', info)
    })

    autoUpdater.on('update-not-available', (info) => {
        console.log('[updater] Update not available:', info)
        broadcastStatus('not-available', info)
    })

    autoUpdater.on('error', (err) => {
        console.error('[updater] Error in auto-updater:', err)
        broadcastStatus('error', err.message)
    })

    autoUpdater.on('download-progress', (progressObj) => {
        // console.log(`[updater] Download progress: ${progressObj.percent}%`)
        broadcastStatus('downloading', progressObj)
    })

    autoUpdater.on('update-downloaded', (info) => {
        console.log('[updater] Update downloaded:', info)
        broadcastStatus('downloaded', info)
    })

    setupIpcHandlers(false)

    // Initial check on startup (delayed slightly to ensure window is ready)
    setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify().catch(err => {
            console.error('[updater] Failed initial check:', err)
        })
    }, 3000)
}

function setupIpcHandlers(isDev: boolean) {
    ipcMain.handle('app:check-update', async () => {
        if (isDev) {
            console.log('[updater] Mock check-update (dev mode)')
            return { status: 'dev-mode' }
        }
        return autoUpdater.checkForUpdates()
    })

    ipcMain.handle('app:start-download', async () => {
        if (isDev) return
        return autoUpdater.downloadUpdate()
    })

    ipcMain.handle('app:install-update', async () => {
        if (isDev) {
            console.log('[updater] Mock install-update (dev mode)')
            return
        }
        autoUpdater.quitAndInstall()
    })
}
