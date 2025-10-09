const { app } = require('electron');
const { createWindow } = require('./core/app');
const { registerVaultIpcHandlers } = require('./ipc/vaultIpc');

const VaultManager = require('./utils/vaultManager');
global.vaultMgr = new VaultManager();

app.whenReady().then(() => {
    const mainWindow = createWindow();

    registerVaultIpcHandlers(mainWindow);
    registerVaultIpcHandlers();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    const { closeCurrentDB } = require('./utils/db');
    closeCurrentDB();
});