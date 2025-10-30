const { app, BrowserWindow } = require('electron');
const path = require('path');
const { createWindow } = require('./core/app');
const { registerVaultIpcHandlers } = require('./ipc/vaultIpc');

// Import and create new VaultManager
const VaultManager = require('./utils/vaultManager');
global.vaultMgr = new VaultManager();

let isQuitting = false;

app.whenReady().then(() => {
    // 1) Create lightweight splash window ASAP
    const splash = new BrowserWindow({
        width: 420,
        height: 260,
        frame: false,
        resizable: false,
        movable: true,
        show: true,
        alwaysOnTop: true,
        transparent: false,
        backgroundColor: '#1e1e1e',
        webPreferences: { sandbox: true }
    });
    splash.loadFile(path.join(__dirname, '../renderer/pages/splash.html'));

    // 2) Prepare main window but do not show yet (created with show:false in createWindow)
    const mainWindow = createWindow();

    // 3) Hook ready-to-show to swap windows
    const showMain = () => {
        try { if (!mainWindow.isDestroyed()) mainWindow.show(); } catch (_) {}
        try { if (!splash.isDestroyed()) splash.close(); } catch (_) {}
    };
    // Prefer ready-to-show, fallback to did-finish-load
    mainWindow.once('ready-to-show', showMain);
    mainWindow.webContents.once('did-finish-load', showMain);

    // Register IPC event handlers with a reference to the main window
    registerVaultIpcHandlers(mainWindow);
});

// Ensure vault is properly sealed (re-encrypted) before exiting the app
app.on('before-quit', async (event) => {
    if (isQuitting) return; // allow the second quit to proceed

    const { getCurrentSessionHandler, clearSession } = require('./utils/session');
    const handler = getCurrentSessionHandler();
    if (handler) {
        // Prevent immediate quit; we will re-trigger after persisting
        event.preventDefault();
        try {
            // Persist current temp DB back into the vault file with a timeout guard
            const sealPromise = handler.closeVault();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Sealing timeout')), 10000));
            await Promise.race([sealPromise, timeoutPromise]);
        } catch (err) {
            console.error('Error while sealing vault on quit:', err);
        } finally {
            try {
                const { closeCurrentDB } = require('./utils/db');
                await closeCurrentDB();
            } catch (_) {}
            try { clearSession(); } catch (_) {}
            isQuitting = true;
            app.quit();
        }
    }
});

// Handle windows close as app exit 
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// Fallback: close DB if nothing else handled it
app.on('will-quit', () => {
    const { closeCurrentDB } = require('./utils/db');
    closeCurrentDB();
});