const { app } = require('electron');
const { createWindow } = require('./core/app');
const { registerVaultIpcHandlers } = require('./ipc/vaultIpc');

// Import and create new VaultManager
const VaultManager = require('./utils/vaultManager');
global.vaultMgr = new VaultManager();

app.whenReady().then(() => {
    // Create window
    const mainWindow = createWindow();

	// Register IPC event handlers
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