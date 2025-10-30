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

            // This opens the DB and sets currentDB internally
            await handler.openVault();

            // Validate master password against the just-opened DB
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

    // Manual save (seal vault without closing)
    ipcMain.handle('manual-save', async () => {
        try {
            const db = getCurrentDB();
            if (db) {
                await new Promise((res) => db.run('PRAGMA wal_checkpoint(TRUNCATE)', () => res()));
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

    // Dashboard data handlers
    ipcMain.handle('get-data', async (event, tabId) => {
        const db = getCurrentDB();
        if (!db) return [];

        // Ensure base tables lazily
        await new Promise((res) => db.run("CREATE TABLE IF NOT EXISTS passwords (id INTEGER PRIMARY KEY, name TEXT, password TEXT)", () => res()));
        await new Promise((res) => db.run("CREATE TABLE IF NOT EXISTS files (id INTEGER PRIMARY KEY, name TEXT, path TEXT)", () => res()));
        await new Promise((res) => db.run("CREATE TABLE IF NOT EXISTS gpg (id INTEGER PRIMARY KEY, name TEXT, type TEXT)", () => res()));

        // Ensure extended columns for passwords
        if (tabId === 'passwords') {
            const existingCols = await new Promise((resolve) => {
                db.all("PRAGMA table_info(passwords)", (err, rows) => resolve(rows || []));
            });
            const have = (name) => existingCols.some(c => c.name === name);
            const alters = [];
            if (!have('label')) alters.push("ALTER TABLE passwords ADD COLUMN label TEXT");
            if (!have('group_name')) alters.push("ALTER TABLE passwords ADD COLUMN group_name TEXT");
            if (!have('address')) alters.push("ALTER TABLE passwords ADD COLUMN address TEXT");
            if (!have('username')) alters.push("ALTER TABLE passwords ADD COLUMN username TEXT");
            for (const sql of alters) {
                await new Promise((res) => db.run(sql, () => res()));
            }
        }

        if (tabId === 'passwords') {
            return new Promise((resolve) => {
                db.all(
                    "SELECT id, COALESCE(label, name) AS label, group_name, address, username, password FROM passwords ORDER BY id DESC",
                    (err, rows) => {
                        if (err) {
                            console.error('get-data passwords error:', err);
                            return resolve([]);
                        }
                        resolve(rows || []);
                    }
                );
            });
        }

        const tableMap = { files: { table: 'files', select: 'id, name, path AS value' }, gpg: { table: 'gpg', select: 'id, name, type AS value' } };
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

    ipcMain.handle('add-item', async (event, payload) => {
        const db = getCurrentDB();
        if (!db) return { success: false, error: 'No open vault/database.' };
        if (!payload || !payload.type) return { success: false, error: 'Missing required fields.' };

        // Ensure base tables lazily
        await new Promise((res) => db.run("CREATE TABLE IF NOT EXISTS passwords (id INTEGER PRIMARY KEY, name TEXT, password TEXT)", () => res()));
        await new Promise((res) => db.run("CREATE TABLE IF NOT EXISTS files (id INTEGER PRIMARY KEY, name TEXT, path TEXT)", () => res()));
        await new Promise((res) => db.run("CREATE TABLE IF NOT EXISTS gpg (id INTEGER PRIMARY KEY, name TEXT, type TEXT)", () => res()));

        let stmt = null;
        let params = [];
        if (payload.type === 'password') {
            // Ensure extended columns exist
            const existingCols = await new Promise((resolve) => db.all("PRAGMA table_info(passwords)", (err, rows) => resolve(rows || [])));
            const have = (name) => existingCols.some(c => c.name === name);
            const alters = [];
            if (!have('label')) alters.push("ALTER TABLE passwords ADD COLUMN label TEXT");
            if (!have('group_name')) alters.push("ALTER TABLE passwords ADD COLUMN group_name TEXT");
            if (!have('address')) alters.push("ALTER TABLE passwords ADD COLUMN address TEXT");
            if (!have('username')) alters.push("ALTER TABLE passwords ADD COLUMN username TEXT");
            for (const sql of alters) {
                await new Promise((res) => db.run(sql, () => res()));
            }
            const { label, group, address, username, password } = payload;
            if (!label || !password) return { success: false, error: 'Label and Password are required.' };
            // Keep legacy 'name' in sync by storing label there too
            stmt = "INSERT INTO passwords (name, label, group_name, address, username, password) VALUES (?, ?, ?, ?, ?, ?)";
            params = [label, label, group || null, address || null, username || null, password];
        } else if (payload.type === 'file') {
            if (!payload.name || !payload.value) return { success: false, error: 'Missing required fields.' };
            stmt = 'INSERT INTO files (name, path) VALUES (?, ?)';
            params = [payload.name, payload.value];
        } else if (payload.type === 'gpg') {
            if (!payload.name || !payload.value) return { success: false, error: 'Missing required fields.' };
            stmt = 'INSERT INTO gpg (name, type) VALUES (?, ?)';
            params = [payload.name, payload.value];
        } else {
            return { success: false, error: 'Unsupported type.' };
        }

        return new Promise((resolve) => {
            db.run(stmt, params, async function(err) {
                if (err) {
                    console.error('add-item error:', err);
                    return resolve({ success: false, error: err.message });
                }
                // Flush and auto-seal
                db.run('PRAGMA wal_checkpoint(TRUNCATE)', async () => {
                    db.run('PRAGMA optimize', async () => {
                        try {
                            const handler = getCurrentSessionHandler();
                            if (handler) {
                                await handler.sealVault();
                            }
                        } catch (sealErr) {
                            console.error('Auto-save (seal) after add-item failed:', sealErr);
                        }
                        resolve({ success: true, id: this && this.lastID });
                    });
                });
            });
        });
    });
}

module.exports = { registerVaultIpcHandlers };
