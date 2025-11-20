const sqlite3 = require('@journeyapps/sqlcipher').verbose();

let currentDB;

function escapeForSqlite(str) {
    return String(str).replace(/'/g, "''");
}

async function openVaultDB(vaultPath, key) {
    return new Promise((resolve, reject) => {
        currentDB = new sqlite3.Database(vaultPath, (err) => {
            if (err) {
                console.error('DB open error:', err);
                return reject(err);
            }
        });
        const safeKey = escapeForSqlite(key);
        currentDB.run(`PRAGMA key = '${safeKey}'`, (err) => {
            if (err) {
                console.error('Error setting key:', err);
                try { currentDB.close(); } catch (_) {}
                currentDB = undefined;
                return reject(err);
            }

            currentDB.get(`PRAGMA journal_mode = DELETE`, (jmErr) => {
                if (jmErr) console.warn('PRAGMA journal_mode set error:', jmErr);
                currentDB.run(`PRAGMA synchronous = FULL`, (syncErr) => {
                    if (syncErr) console.warn('PRAGMA synchronous set error:', syncErr);

                    currentDB.all(`PRAGMA cipher_integrity_check`, (icErr, rows) => {
                        if (icErr) {
                            console.error('Key verification/cipher_integrity_check error:', icErr);
                            try { currentDB.close(); } catch (_) {}
                            currentDB = undefined;
                            return reject(new Error('Invalid password or corrupted vault'));
                        }

                        const isOkFromRows = Array.isArray(rows) && rows.some(row => {
                            return row && Object.values(row).some(v => typeof v === 'string' && String(v).toLowerCase() === 'ok');
                        });

                        if (isOkFromRows) {
                            console.log('DB opened successfully for:', vaultPath);
                            return resolve(currentDB);
                        }

                        currentDB.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='auth'`, (smErr, smRow) => {
                            if (smErr) {
                                console.error('sqlite_master read error (fallback):', smErr, 'cipher_integrity_check result:', rows);
                                try { currentDB.close(); } catch (_) {}
                                currentDB = undefined;
                                return reject(new Error('Invalid password or corrupted vault'));
                            }
                            if (!smRow) {
                                console.error('Auth table does not exist (fallback). cipher_integrity_check result:', rows);
                                try { currentDB.close(); } catch (_) {}
                                currentDB = undefined;
                                return reject(new Error('Invalid password or corrupted vault'));
                            }
                            currentDB.get(`SELECT master_hash FROM auth WHERE id = 1`, (authErr, authRow) => {
                                if (authErr) {
                                    console.error('Auth table read error (fallback):', authErr, 'cipher_integrity_check result:', rows);
                                    try { currentDB.close(); } catch (_) {}
                                    currentDB = undefined;
                                    return reject(new Error('Invalid password or corrupted vault'));
                                }
                                if (!authRow) {
                                    console.error('No record in auth (fallback). cipher_integrity_check result:', rows);
                                    try { currentDB.close(); } catch (_) {}
                                    currentDB = undefined;
                                    return reject(new Error('Invalid password or corrupted vault'));
                                }
                                console.log('DB opened successfully (fallback) for:', vaultPath);
                                return resolve(currentDB);
                            });
                        });
                    });
                });
            });
        });
    });
}

function getCurrentDB() {
    return currentDB;
}

function closeCurrentDB() {
    return new Promise((resolve) => {
        if (currentDB) {
            currentDB.run('PRAGMA wal_checkpoint(TRUNCATE)', (chkErr) => {
                if (chkErr) console.warn('WAL checkpoint error (will still attempt close):', chkErr);
                currentDB.close((err) => {
                    if (err) console.error('DB close error:', err);
                    currentDB = undefined;
                    resolve();
                });
            });
        } else {
            resolve();
        }
    });
}

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

async function ensureBaseTables(db = getCurrentDB()) {
    await run(db, "CREATE TABLE IF NOT EXISTS passwords (id INTEGER PRIMARY KEY, name TEXT, password TEXT)");
    await run(db, "CREATE TABLE IF NOT EXISTS files (id INTEGER PRIMARY KEY, name TEXT, path TEXT)");
    await run(db, "CREATE TABLE IF NOT EXISTS gpg (id INTEGER PRIMARY KEY, name TEXT, type TEXT)");
    await run(db, "CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY, name TEXT UNIQUE)");
}

async function ensurePasswordColumns(db = getCurrentDB()) {
    const cols = await all(db, 'PRAGMA table_info(passwords)');
    const have = (n) => cols.some(c => c.name === n);
    const alters = [];
    if (!have('label')) alters.push('ALTER TABLE passwords ADD COLUMN label TEXT');
    if (!have('group_name')) alters.push('ALTER TABLE passwords ADD COLUMN group_name TEXT');
    if (!have('group_id')) alters.push('ALTER TABLE passwords ADD COLUMN group_id INTEGER');
    if (!have('address')) alters.push('ALTER TABLE passwords ADD COLUMN address TEXT');
    if (!have('username')) alters.push('ALTER TABLE passwords ADD COLUMN username TEXT');
    for (const sql of alters) {
        await run(db, sql);
    }
}

async function ensureGpgColumns(db = getCurrentDB()) {
    const cols = await all(db, 'PRAGMA table_info(gpg)');
    const have = (n) => cols.some(c => c.name === n);
    if (!have('content')) {
        await run(db, 'ALTER TABLE gpg ADD COLUMN content TEXT');
    }
}

async function checkpoint(db = getCurrentDB()) {
    try { await run(db, 'PRAGMA wal_checkpoint(TRUNCATE)'); } catch (_) {}
}

async function optimize(db = getCurrentDB()) {
    try { await run(db, 'PRAGMA optimize'); } catch (_) {}
}

async function ensureGroupByName(name, db = getCurrentDB()) {
    if (!name) return null;
    const found = await get(db, 'SELECT id FROM groups WHERE name = ?', [name]).catch(() => null);
    if (found && found.id) return found.id;
    await run(db, 'INSERT OR IGNORE INTO groups (name) VALUES (?)', [name]).catch(() => {});
    const again = await get(db, 'SELECT id FROM groups WHERE name = ?', [name]).catch(() => null);
    return again ? again.id : null;
}

async function getPasswords(db = getCurrentDB()) {
    await ensureBaseTables(db);
    await ensurePasswordColumns(db);
    return all(db, `SELECT p.id, COALESCE(p.label, p.name) AS label, COALESCE(g.name, p.group_name) AS group_name, p.address, p.username, p.password
                    FROM passwords p
                    LEFT JOIN groups g ON g.id = p.group_id
                    ORDER BY p.id DESC`);
}

async function getFiles(db = getCurrentDB()) {
    await ensureBaseTables(db);
    return all(db, 'SELECT id, name, path AS value FROM files ORDER BY id DESC');
}

async function getGpg(db = getCurrentDB()) {
    await ensureBaseTables(db);
    await ensureGpgColumns(db);
    return all(db, 'SELECT id, name, type AS value, content FROM gpg ORDER BY id DESC');
}

async function getCounts(db = getCurrentDB()) {
    await ensureBaseTables(db);
    const [p, f, g] = await Promise.all([
        get(db, 'SELECT COUNT(*) AS c FROM passwords'),
        get(db, 'SELECT COUNT(*) AS c FROM files'),
        get(db, 'SELECT COUNT(*) AS c FROM gpg'),
    ]);
    return { passwords: (p && p.c) || 0, files: (f && f.c) || 0, gpg: (g && g.c) || 0 };
}

async function addPassword(payload, db = getCurrentDB()) {
    await ensureBaseTables(db);
    await ensurePasswordColumns(db);
    const { label, group, address, username, password } = payload;
    const groupId = group ? await ensureGroupByName(group, db) : null;
    const res = await run(db, 'INSERT INTO passwords (name, label, group_name, group_id, address, username, password) VALUES (?,?,?,?,?,?,?)', [
        label, label, group || null, groupId, address || null, username || null, password
    ]);
    return { id: res && res.lastID };
}

async function updatePassword(payload, db = getCurrentDB()) {
    await ensureBaseTables(db);
    await ensurePasswordColumns(db);
    const fields = [];
    const params = [];
    if (payload.label != null) { fields.push('label = ?'); params.push(payload.label); }
    if (payload.group != null) {
        fields.push('group_name = ?'); params.push(payload.group);
        const groupId = payload.group ? await ensureGroupByName(payload.group, db) : null;
        fields.push('group_id = ?'); params.push(groupId);
    }
    if (payload.address != null) { fields.push('address = ?'); params.push(payload.address); }
    if (payload.username != null) { fields.push('username = ?'); params.push(payload.username); }
    if (payload.password != null) { fields.push('password = ?'); params.push(payload.password); }
    if (payload.label != null) { fields.push('name = ?'); params.push(payload.label); }
    if (fields.length === 0) return { changes: 0 };
    params.push(payload.id);
    const res = await run(db, `UPDATE passwords SET ${fields.join(', ')} WHERE id = ?`, params);
    return { changes: res && res.changes };
}

async function deletePassword(id, db = getCurrentDB()) {
    await ensureBaseTables(db);
    const res = await run(db, 'DELETE FROM passwords WHERE id = ?', [id]);
    return { changes: res && res.changes };
}

async function addFile(payload, db = getCurrentDB()) {
    await ensureBaseTables(db);
    const res = await run(db, 'INSERT INTO files (name, path) VALUES (?,?)', [payload.name, payload.value]);
    return { id: res && res.lastID };
}

async function addGpg(payload, db = getCurrentDB()) {
    await ensureBaseTables(db);
    await ensureGpgColumns(db);
    const type = payload.type || 'key';
    const content = payload.content || payload.value || '';
    const res = await run(db, 'INSERT INTO gpg (name, type, content) VALUES (?,?,?)', [payload.name, type, content]);
    return { id: res && res.lastID };
}

async function getGroups(db = getCurrentDB()) {
    await ensureBaseTables(db);
    return all(db, 'SELECT id, name FROM groups ORDER BY name ASC');
}

async function addGroup(name, db = getCurrentDB()) {
    await ensureBaseTables(db);
    const res = await run(db, 'INSERT OR IGNORE INTO groups (name) VALUES (?)', [name]);
    return { id: res && res.lastID };
}

async function deleteGroup(id, db = getCurrentDB()) {
    await ensureBaseTables(db);
    const res = await run(db, 'DELETE FROM groups WHERE id = ?', [id]);
    return { changes: res && res.changes };
}

async function deleteGpg(id, db = getCurrentDB()) {
    await ensureBaseTables(db);
    const res = await run(db, 'DELETE FROM gpg WHERE id = ?', [id]);
    return { changes: res && res.changes };
}

async function getGpgById(id, db = getCurrentDB()) {
    await ensureBaseTables(db);
    await ensureGpgColumns(db);
    return get(db, 'SELECT * FROM gpg WHERE id = ?', [id]);
}

module.exports = { openVaultDB, getCurrentDB, closeCurrentDB, run, get, all, ensureBaseTables, ensurePasswordColumns, ensureGpgColumns, checkpoint, optimize, ensureGroupByName, getPasswords, getFiles, getGpg, getCounts, addPassword, updatePassword, deletePassword, addFile, addGpg, deleteGpg, getGpgById, getGroups, addGroup, deleteGroup };