const { ipcMain, dialog } = require('electron');
const path = require('path');
const VaultHandler = require('../handlers/vaultHandler');
const { openVaultDB, closeCurrentDB, getCurrentDB } = require('../utils/db');
const { setMasterPasswordForVault, validateMasterPasswordForVault } = require('../utils/auth');
const { setCurrentSession, getCurrentSessionHandler, clearSession, getCurrentVaultPath } = require('../utils/session');
const dbx = require('../utils/dbAccess');

function registerVaultIpcHandlers(mainWindow) {
    // Use centralized DB helpers from utils/dbAccess
    async function flushAndSeal() {
        const db = getCurrentDB();
        if (db) {
            try { await dbx.checkpoint(db); } catch (_) {}
            try { await dbx.optimize(db); } catch (_) {}
        }
        const handler = getCurrentSessionHandler();
        if (handler) {
            await handler.sealVault();
        }
    }

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

    ipcMain.handle('manual-save', async () => {
        try {
            const db = getCurrentDB();
            if (db) {
                try { await dbx.checkpoint(db); } catch (_) {}
            }
            const handler = getCurrentSessionHandler();
            if (!handler) return { success: false, error: 'No open vault.' };
            await handler.sealVault();
            return { success: true };
        } catch (err) {
            console.error('manual-save error:', err);
            return { success: false, error: err.message };
        }
    });

    async function ensureGroupByName(db, name) {
        if (!name) return null;
        const row = await new Promise((resolve) => {
            db.get('SELECT id FROM groups WHERE name = ?', [name], (err, r) => resolve(r || null));
        });
        if (row) return row.id;
        const newId = await new Promise((resolve) => {
            db.run('INSERT OR IGNORE INTO groups (name) VALUES (?)', [name], function(err) {
                if (err) return resolve(null);
                resolve(this && this.lastID);
            });
        });
        const row2 = await new Promise((resolve) => {
            db.get('SELECT id FROM groups WHERE name = ?', [name], (err, r) => resolve(r || null));
        });
        return row2 ? row2.id : newId;
    }

    ipcMain.handle('get-data', async (event, tabId) => {
        const db = getCurrentDB();
        if (!db) return [];
        try {
            if (tabId === 'passwords') return await dbx.getPasswords(db);
            if (tabId === 'files') return await dbx.getFiles(db);
            if (tabId === 'gpg') return await dbx.getGpg(db);
            return [];
        } catch (err) {
            console.error('get-data error:', err);
            return [];
        }
    });

    ipcMain.handle('add-item', async (event, payload) => {
        const db = getCurrentDB();
        if (!db) return { success: false, error: 'No open vault/database.' };
        if (!payload || !payload.type) return { success: false, error: 'Missing required fields.' };
        try {
            let res;
            if (payload.type === 'password') {
                const { label, password } = payload;
                if (!label || !password) return { success: false, error: 'Label and Password are required.' };
                res = await dbx.addPassword(payload, db);
            } else if (payload.type === 'file') {
                if (!payload.name || !payload.value) return { success: false, error: 'Missing required fields.' };
                res = await dbx.addFile(payload, db);
            } else if (payload.type === 'gpg') {
                if (!payload.name || !payload.value) return { success: false, error: 'Missing required fields.' };
                res = await dbx.addGpg(payload, db);
            } else {
                return { success: false, error: 'Unsupported type.' };
            }
            try { await flushAndSeal(); } catch (e) { console.error('Auto-save (seal) after add-item failed:', e); }
            return { success: true, id: res && res.id };
        } catch (err) {
            console.error('add-item error:', err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('update-password', async (event, payload) => {
        const db = getCurrentDB();
        if (!db) return { success: false, error: 'No open vault/database.' };
        if (!payload || typeof payload.id !== 'number') return { success: false, error: 'Missing id.' };
        try {
            const res = await dbx.updatePassword(payload, db);
            if (!res || typeof res.changes !== 'number') {
                return { success: false, error: 'No fields to update.' };
            }
            try { await flushAndSeal(); } catch (e) { console.error('Auto-save (seal) after update-password failed:', e); }
            return { success: true, changes: res.changes };
        } catch (err) {
            console.error('update-password error:', err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('delete-password', async (event, id) => {
        const db = getCurrentDB();
        if (!db) return { success: false, error: 'No open vault/database.' };
        if (typeof id !== 'number') return { success: false, error: 'Invalid id.' };
        try {
            const res = await dbx.deletePassword(id, db);
            try { await flushAndSeal(); } catch (e) { console.error('Auto-save (seal) after delete-password failed:', e); }
            return { success: true, changes: res && res.changes };
        } catch (err) {
            console.error('delete-password error:', err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('get-counts', async () => {
        const db = getCurrentDB();
        if (!db) return { passwords: 0, files: 0, gpg: 0 };
        try {
            return await dbx.getCounts(db);
        } catch (err) {
            console.error('get-counts error:', err);
            return { passwords: 0, files: 0, gpg: 0 };
        }
    });

    ipcMain.handle('get-groups', async () => {
        const db = getCurrentDB();
        if (!db) return [];
        try {
            return await dbx.getGroups(db);
        } catch (err) {
            console.error('get-groups error:', err);
            return [];
        }
    });

    ipcMain.handle('add-group', async (event, name) => {
        const db = getCurrentDB();
        if (!db) return { success: false, error: 'No open vault/database.' };
        if (!name) return { success: false, error: 'Name required.' };
        try {
            const res = await dbx.addGroup(name, db);
            try { await flushAndSeal(); } catch (e) { console.error('seal after add-group', e); }
            return { success: true, id: res && res.id };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('delete-group', async (event, id) => {
        const db = getCurrentDB();
        if (!db) return { success: false, error: 'No open vault/database.' };
        if (typeof id !== 'number') return { success: false, error: 'Invalid id.' };
        try {
            const res = await dbx.deleteGroup(id, db);
            try { await flushAndSeal(); } catch (e) { console.error('seal after delete-group', e); }
            return { success: true, changes: res && res.changes };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('get-vault-name', async () => {
        try {
            const p = getCurrentVaultPath();
            if (!p) return '';
            return path.basename(p, '.vault');
        } catch (_) { return ''; }
    });
}

module.exports = { registerVaultIpcHandlers };
