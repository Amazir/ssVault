const { app, BrowserWindow } = require('electron');
const path = require('path');
const { createWindow } = require('./core/app');
const { registerVaultIpcHandlers } = require('./ipc/vaultIpc');

// Import and create new VaultManager
const VaultManager = require('./utils/vaultManager');
global.vaultMgr = new VaultManager();

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

// Handle windows close as app exit 
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// Handle app exit
app.on('will-quit', () => {
    const { closeCurrentDB } = require('./utils/db');
    closeCurrentDB();
});