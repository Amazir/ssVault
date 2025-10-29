const { ipcMain, dialog } = require('electron');
const path = require('path');
const VaultHandler = require('../handlers/vaultHandler');
const { openVaultDB, closeCurrentDB, getCurrentDB } = require('../utils/db');
const { setMasterPasswordForVault, validateMasterPasswordForVault } = require('../utils/auth');
const { setCurrentSession, getCurrentSessionHandler, clearSession } = require('../utils/session');

function registerVaultIpcHandlers(mainWindow) {
    ipcMain.handle('get-vaults', () => {
        try {
            return global.vaultMgr.getVaults();
        } catch (err) {
            console.error('get-vaults error:', err);
            return [];
        }
    });

    ipcMain.handle('create-vault', async (event, { name, password }) => {
        try {
            const { filePath } = await dialog.showSaveDialog({ defaultPath: `${name}.vault` });
            if (!filePath) return { error: 'Cancelled' };
            const handler = new VaultHandler(filePath, password);
            await handler.createVault();
            global.vaultMgr.addVault(name, filePath);
            return { success: true };
        } catch (err) {
            console.error('create-vault error:', err);
            return { error: 'Vault creation error: ' + err.message };
        }
    });

    ipcMain.handle('import-vault', async () => {
        const { filePaths } = await dialog.showOpenDialog({ filters: [{ name: 'Vaults', extensions: ['vault'] }] });
        if (!filePaths || !filePaths[0]) return { error: 'Cancelled' };
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
                return { error: 'Invalid password' };
            }

            setCurrentSession(vaultPath, password, handler);
            return { success: true };
        } catch (err) {
            console.error('open-vault error:', err);
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

    // Dashboard data handlers
    ipcMain.handle('get-data', async (event, tabId) => {
        const db = getCurrentDB();
        if (!db) return [];

        // Ensure base tables lazily
        await new Promise((res) => db.run("CREATE TABLE IF NOT EXISTS passwords (id INTEGER PRIMARY KEY, name TEXT, password TEXT)", () => res()));
        await new Promise((res) => db.run("CREATE TABLE IF NOT EXISTS files (id INTEGER PRIMARY KEY, name TEXT, path TEXT)", () => res()));
        await new Promise((res) => db.run("CREATE TABLE IF NOT EXISTS gpg (id INTEGER PRIMARY KEY, name TEXT, type TEXT)", () => res()));

        const tableMap = { passwords: { table: 'passwords', select: 'id, name, password AS value' }, files: { table: 'files', select: 'id, name, path AS value' }, gpg: { table: 'gpg', select: 'id, name, type AS value' } };
        const meta = tableMap[tabId];
        if (!meta) return [];

        return new Promise((resolve) => {
            db.all(`SELECT ${meta.select} FROM ${meta.table} ORDER BY id DESC`, (err, rows) => {
                if (err) {
                    console.error('get-data error:', err);
                    return resolve([]);
                }
                resolve(rows || []);
            });
        });
    });

    ipcMain.handle('add-item', async (event, { type, name, value }) => {
        const db = getCurrentDB();
        if (!db) return { success: false, error: 'No open vault/database.' };
        if (!type || !name || !value) return { success: false, error: 'Missing required fields.' };

        // Ensure base tables lazily
        await new Promise((res) => db.run("CREATE TABLE IF NOT EXISTS passwords (id INTEGER PRIMARY KEY, name TEXT, password TEXT)", () => res()));
        await new Promise((res) => db.run("CREATE TABLE IF NOT EXISTS files (id INTEGER PRIMARY KEY, name TEXT, path TEXT)", () => res()));
        await new Promise((res) => db.run("CREATE TABLE IF NOT EXISTS gpg (id INTEGER PRIMARY KEY, name TEXT, type TEXT)", () => res()));

        const insertSQLByType = {
            password: { sql: 'INSERT INTO passwords (name, password) VALUES (?, ?)', params: [name, value] },
            file: { sql: 'INSERT INTO files (name, path) VALUES (?, ?)', params: [name, value] },
            gpg: { sql: 'INSERT INTO gpg (name, type) VALUES (?, ?)', params: [name, value] }
        };
        const payload = insertSQLByType[type];
        if (!payload) return { success: false, error: 'Unsupported type.' };

        return new Promise((resolve) => {
            db.run(payload.sql, payload.params, function(err) {
                if (err) {
                    console.error('add-item error:', err);
                    return resolve({ success: false, error: err.message });
                }
                resolve({ success: true, id: this && this.lastID });
            });
        });
    });
}

module.exports = { registerVaultIpcHandlers };
