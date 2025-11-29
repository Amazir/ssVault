const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const VaultHandler = require('../handlers/vaultHandler');
const { openVaultDB, closeCurrentDB, getCurrentDB } = require('../utils/db');
const { setMasterPasswordForVault, validateMasterPasswordForVault } = require('../utils/auth');
const { setCurrentSession, getCurrentSessionHandler, clearSession, getCurrentVaultPath } = require('../utils/session');
const { run, get, all, ensureBaseTables, ensurePasswordColumns, ensureAuthColumns, checkpoint, optimize, ensureGroupByName, getPasswords, getFiles, getGpg, getCounts, addPassword, updatePassword, deletePassword, addFile, addGpg, deleteGpg, getGroups, addGroup, deleteGroup } = require('../utils/db');
const LoginAttemptsManager = require('../modules/loginAttempts');

const { generateGpgKeyPair, readAndValidateArmoredKey, encryptText, decryptText } = require('../utils/gpgUtils');

function registerVaultIpcHandlers(mainWindow) {
    async function flushAndSeal() {
        const db = getCurrentDB();
        if (db) {
            try { await checkpoint(db); } catch (_) {}
            try { await optimize(db); } catch (_) {}
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
        let tempHandler = null;
        try {
            
            tempHandler = new VaultHandler(vaultPath, password);
            await tempHandler.openVault();
            
            const db = getCurrentDB();
            if (!db) {
                if (tempHandler) tempHandler.cleanTempDir();
                return { error: 'Database not accessible' };
            }
            
            
            await ensureAuthColumns(db);
            
            // Initialize login attempts manager with vault path (stores data outside encrypted DB)
            const attemptsManager = new LoginAttemptsManager(vaultPath);
            const lockStatus = await attemptsManager.checkLockout();
            
            if (lockStatus.locked) {
                await closeCurrentDB();
                if (tempHandler) tempHandler.cleanTempDir();
                return {
                    error: `Too many failed attempts. Vault locked for ${lockStatus.remainingSeconds} seconds.`
                };
            }
            
            
            const isValid = await validateMasterPasswordForVault(password);
            
            if (!isValid) {
                
                const result = await attemptsManager.recordFailedAttempt();
                await closeCurrentDB();
                if (tempHandler) tempHandler.cleanTempDir();
                
                if (result.locked) {
                    return {
                        error: `Invalid password. Vault locked for ${result.remainingSeconds} seconds.`
                    };
                }
                
                return {
                    error: `Invalid password. ${result.attemptsRemaining} attempt(s) remaining.`
                };
            }
            
            
            await attemptsManager.resetAttempts();
            
            
            setCurrentSession(vaultPath, password, tempHandler);
            return { success: true };
            
        } catch (err) {
            console.error('open-vault error:', err);
            if (tempHandler) {
                try {
                    await closeCurrentDB();
                    tempHandler.cleanTempDir();
                } catch (_) {}
            }
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
                try { await checkpoint(db); } catch (_) {}
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
            if (tabId === 'passwords') return await getPasswords(db);
            if (tabId === 'files') return await getFiles(db);
            if (tabId === 'gpg') return await getGpg(db);
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
                res = await addPassword(payload, db);
            } else if (payload.type === 'file') {
                if (!payload.name || !payload.value) return { success: false, error: 'Missing required fields.' };
                res = await addFile(payload, db);
            } else if (payload.type === 'gpg') {
                if (!payload.name || !payload.value) return { success: false, error: 'Missing required fields.' };
                res = await addGpg(payload, db);
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
            const res = await updatePassword(payload, db);
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
            const res = await deletePassword(id, db);
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
            return await getCounts(db);
        } catch (err) {
            console.error('get-counts error:', err);
            return { passwords: 0, files: 0, gpg: 0 };
        }
    });

    ipcMain.handle('get-groups', async () => {
        const db = getCurrentDB();
        if (!db) return [];
        try {
            return await getGroups(db);
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
            const res = await addGroup(name, db);
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
            const res = await deleteGroup(id, db);
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
    
    ipcMain.handle('generate-gpg-keypair', async (event, payload) => {
        const db = getCurrentDB();
        if (!db) return { success: false, error: 'No open vault/database.' };
        if (!payload?.name) return { success: false, error: 'Key pair name required.' };
        if (!payload?.userName) return { success: false, error: 'User name required.' };
        try {
            const keys = await generateGpgKeyPair({
                name: payload.userName,
                email: payload.email || undefined
            });
            
            const userIdStr = payload.email
                ? `${payload.userName} <${payload.email}>`
                : payload.userName;
            
            await addGpg({
                name: `${payload.name} (Private)`,
                type: 'private',
                content: keys.privateKeyArmored,
                userId: userIdStr
            }, db);
            
            await addGpg({
                name: `${payload.name} (Public)`,
                type: 'public',
                content: keys.publicKeyArmored,
                userId: userIdStr
            }, db);
            await flushAndSeal();
            return { success: true };
        } catch (err) {
            console.error('generate-gpg-keypair error:', err);
            return { success: false, error: err.message };
        }
    });
    
    ipcMain.handle('import-gpg-key-from-file', async () => {
        const { filePaths } = await dialog.showOpenDialog({
            filters: [
                { name: 'GPG Keys', extensions: ['asc', 'gpg', 'key', 'pub', 'priv'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['openFile']
        });
        if (!filePaths?.[0]) return { success: false, error: 'No file selected.' };
    
        const filePath = filePaths[0];
        let content;
        try {
            content = fs.readFileSync(filePath, 'utf8');
        } catch (err) {
            return { success: false, error: 'Failed to read file.' };
        }
    
        const db = getCurrentDB();
        if (!db) return { success: false, error: 'No open vault/database.' };
    
        try {
            const validated = await readAndValidateArmoredKey(content);
            const name = path.basename(filePath, path.extname(filePath)) || 'Imported Key';
            await addGpg({
                name: `${name} (${validated.type})`,
                type: validated.type,
                content
            }, db);
            await flushAndSeal();
            return { success: true };
        } catch (err) {
            console.error('import-gpg-key-from-file error:', err);
            return { success: false, error: err.message };
        }
    });
    
    ipcMain.handle('delete-gpg-key', async (event, id) => {
        const db = getCurrentDB();
        if (!db) return { success: false, error: 'No open vault/database.' };
        if (typeof id !== 'number') return { success: false, error: 'Invalid id.' };
        try {
            const res = await deleteGpg(id, db);
            await flushAndSeal();
            return { success: true, changes: res && res.changes };
        } catch (err) {
            console.error('delete-gpg-key error:', err);
            return { success: false, error: err.message };
        }
    });
    
    ipcMain.handle('export-gpg-key', async (event, id) => {
        const db = getCurrentDB();
        if (!db) return { success: false, error: 'No open vault/database.' };
        if (typeof id !== 'number') return { success: false, error: 'Invalid id.' };
        try {
            const { getGpgById } = require('../utils/db');
            const key = await getGpgById(id, db);
            if (!key) return { success: false, error: 'Key not found.' };
            
            const extension = key.type === 'private' ? 'priv.asc' : 'pub.asc';
            const defaultName = `${key.name.replace(/[^a-zA-Z0-9]/g, '_')}.${extension}`;
            
            const { filePath } = await dialog.showSaveDialog({
                defaultPath: defaultName,
                filters: [
                    { name: 'GPG Keys', extensions: ['asc', 'gpg', 'key'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });
            
            if (!filePath) return { success: false, error: 'Export cancelled.' };
            
            fs.writeFileSync(filePath, key.content, 'utf8');
            return { success: true, exportPath: filePath };
        } catch (err) {
            console.error('export-gpg-key error:', err);
            return { success: false, error: err.message };
        }
    });
    
    ipcMain.handle('gpg-encrypt', async (event, { text, keyId }) => {
        const db = getCurrentDB();
        if (!db) return { success: false, error: 'No open vault/database.' };
        if (!text) return { success: false, error: 'Text required.' };
        if (!keyId) return { success: false, error: 'Key ID required.' };
        try {
            const { getGpgById } = require('../utils/db');
            const key = await getGpgById(keyId, db);
            if (!key) return { success: false, error: 'Key not found.' };
            if (key.type !== 'public') return { success: false, error: 'Encryption requires a public key.' };
            const encrypted = await encryptText(text, key.content);
            return { success: true, result: encrypted };
        } catch (err) {
            console.error('gpg-encrypt error:', err);
            return { success: false, error: err.message };
        }
    });
    
    ipcMain.handle('gpg-decrypt', async (event, { text, keyId }) => {
        const db = getCurrentDB();
        if (!db) return { success: false, error: 'No open vault/database.' };
        if (!text) return { success: false, error: 'Text required.' };
        if (!keyId) return { success: false, error: 'Key ID required.' };
        try {
            const { getGpgById } = require('../utils/db');
            const key = await getGpgById(keyId, db);
            if (!key) return { success: false, error: 'Key not found.' };
            if (key.type !== 'private') return { success: false, error: 'Decryption requires a private key.' };
            const decrypted = await decryptText(text, key.content);
            return { success: true, result: decrypted };
        } catch (err) {
            console.error('gpg-decrypt error:', err);
            return { success: false, error: err.message };
        }
    });
}

module.exports = { registerVaultIpcHandlers };
