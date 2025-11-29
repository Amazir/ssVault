const { getCurrentDB, run, get, all, ensureBaseTables } = require('../utils/db');

/**
 * GPG Keys Management Module
 * Handles all GPG key-related database operations
 */

async function ensureGpgColumns(db = getCurrentDB()) {
    const cols = await all(db, 'PRAGMA table_info(gpg)');
    const have = (n) => cols.some(c => c.name === n);
    
    if (!have('content')) {
        await run(db, 'ALTER TABLE gpg ADD COLUMN content TEXT');
    }
    if (!have('user_id')) {
        await run(db, 'ALTER TABLE gpg ADD COLUMN user_id TEXT');
    }
}

async function getGpgKeys(db = getCurrentDB()) {
    await ensureBaseTables(db);
    await ensureGpgColumns(db);
    
    return all(db, 'SELECT id, name, type AS value, content, user_id FROM gpg ORDER BY id DESC');
}

async function addGpgKey(payload, db = getCurrentDB()) {
    await ensureBaseTables(db);
    await ensureGpgColumns(db);
    
    const type = payload.type || 'key';
    const content = payload.content || payload.value || '';
    const userId = payload.userId || payload.user_id || '';
    
    const res = await run(db, 
        'INSERT INTO gpg (name, type, content, user_id) VALUES (?,?,?,?)', 
        [payload.name, type, content, userId]
    );
    
    return { id: res && res.lastID };
}

async function deleteGpgKey(id, db = getCurrentDB()) {
    await ensureBaseTables(db);
    const res = await run(db, 'DELETE FROM gpg WHERE id = ?', [id]);
    return { changes: res && res.changes };
}

async function getGpgKeyById(id, db = getCurrentDB()) {
    await ensureBaseTables(db);
    await ensureGpgColumns(db);
    return get(db, 'SELECT * FROM gpg WHERE id = ?', [id]);
}

async function getGpgKeysCount(db = getCurrentDB()) {
    await ensureBaseTables(db);
    const result = await get(db, 'SELECT COUNT(*) AS c FROM gpg');
    return (result && result.c) || 0;
}

module.exports = {
    ensureGpgColumns,
    getGpgKeys,
    addGpgKey,
    deleteGpgKey,
    getGpgKeyById,
    getGpgKeysCount
};