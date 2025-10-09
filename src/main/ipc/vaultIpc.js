const { ipcMain, dialog } = require('electron');
const path = require('path');
const VaultHandler = require('../handlers/vaultHandler');
const { openVaultDB, closeCurrentDB } = require('../utils/db');
const { setMasterPasswordForVault, validateMasterPasswordForVault } = require('../utils/auth');
const { setCurrentSession, getCurrentSessionHandler, clearSession } = require('../utils/session');

function registerVaultIpcHandlers(mainWindow) {
    ipcMain.handle('get-vaults', () => {
        try {
            return global.vaultMgr.getVaults();
        } catch (err) {
            console.error('Błąd get-vaults:', err);
            return [];
        }
    });

    ipcMain.handle('create-vault', async (event, { name, password }) => {
        try {
            const { filePath } = await dialog.showSaveDialog({ defaultPath: `${name}.vault` });
            if (!filePath) return { error: 'Anulowano' };
            const handler = new VaultHandler(filePath, password);
            await handler.createVault();
            global.vaultMgr.addVault(name, filePath);
            return { success: true };
        } catch (err) {
            console.error('Błąd create-vault:', err);
            return { error: 'Błąd tworzenia sejfu: ' + err.message };
        }
    });

    ipcMain.handle('import-vault', async () => {
        const { filePaths } = await dialog.showOpenDialog({ filters: [{ name: 'Vaults', extensions: ['vault'] }] });
        if (!filePaths || !filePaths[0]) return { error: 'Anulowano' };
        const filePath = filePaths[0];
        const name = path.basename(filePath, '.vault');
        global.vaultMgr.addVault(name, filePath);
        return { success: true };
    });

    ipcMain.handle('open-vault', async (event, { vaultPath, password }) => {
        try {
            const handler = new VaultHandler(vaultPath, password);

            await handler.openVault();

            const dbPath = path.join(handler.tempDir, 'metadata.db');
            openVaultDB(dbPath, password);

            const isValid = await validateMasterPasswordForVault(password);
            if (!isValid) {
                handler.cleanTempDir();
                return { error: 'Nieprawidłowe hasło' };
            }

            setCurrentSession(vaultPath, password, handler);
            return { success: true };
        } catch (err) {
            console.error('Błąd open-vault:', err);
            return { error: err.message };
        }
    });

    ipcMain.handle('close-vault', async () => {
        const handler = getCurrentSessionHandler();
        if (handler) {
            await handler.closeVault();
            clearSession();
            closeCurrentDB();
        }
    });

    ipcMain.on('load-dashboard', () => {
        if (mainWindow) {
            mainWindow.loadFile(path.join(__dirname, '../../renderer/pages/dashboard.html'));
        }
    });
}

module.exports = { registerVaultIpcHandlers };
