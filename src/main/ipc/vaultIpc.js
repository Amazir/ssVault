const { ipcMain, dialog } = require('electron');
const VaultHandler = require('../handlers/vaultHandler');
const { openVaultDB, closeCurrentDB } = require('../utils/db');
const { setMasterPasswordForVault, validateMasterPasswordForVault } = require('../utils/auth');
const { setCurrentSession, getCurrentSessionHandler, clearSession } = require('../utils/session');

function registerVaultIpcHandlers() {
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
        const { filePaths } = await dialog.showOpenDialog({ filters: [{ name: 'Vaults', extensions: ['vault.db'] }] });
        if (!filePaths || !filePaths[0]) return { error: 'Anulowano' };
        const filePath = filePaths[0];
        const name = path.basename(filePath, '.vault.db');
        global.vaultMgr.addVault(name, filePath);  // Poprawione z addVault
        return { success: true };
    });

    ipcMain.handle('open-vault', async (event, { path, password }) => {
        try {
            const handler = new VaultHandler(path, password);
            await handler.openVault();
            const isValid = await validateMasterPasswordForVault(password);
            if (!isValid) {
                handler.cleanTempDir();
                return { error: 'Nieprawidłowe hasło' };
            }
            setCurrentSession(path, password, handler);
            await openVaultDB();  // Jeśli potrzeba
            return { success: true };
        } catch (err) {
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
        mainWindow.loadFile(path.join(__dirname, '../../renderer/pages/dashboard.html'));
    });
}

module.exports = { registerVaultIpcHandlers };