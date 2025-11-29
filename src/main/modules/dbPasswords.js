const { getCurrentDB, run, get, all, ensureBaseTables } = require('../utils/db');

/**
 * Password Management Module
 * Handles all password-related database operations
 */

async function ensurePasswordColumns(db = getCurrentDB()) {
    const cols = await all(db, 'PRAGMA table_info(passwords)');
    const have = (n) => cols.some(c => c.name === n);
    const alters = [];
    
    if (!have('label')) alters.push('ALTER TABLE passwords ADD COLUMN label TEXT');
    if (!have('group_id')) alters.push('ALTER TABLE passwords ADD COLUMN group_id INTEGER DEFAULT 1');
    if (!have('address')) alters.push('ALTER TABLE passwords ADD COLUMN address TEXT');
    if (!have('username')) alters.push('ALTER TABLE passwords ADD COLUMN username TEXT');
    
    for (const sql of alters) {
        await run(db, sql);
    }
}

async function getPasswords(db = getCurrentDB()) {
    await ensureBaseTables(db);
    await ensurePasswordColumns(db);
    
    return all(db, `
        SELECT 
            p.id,
            COALESCE(p.label, p.name) AS label,
            COALESCE(g.name, 'Default') AS group_name,
            p.address,
            p.username,
            p.password
        FROM passwords p
        LEFT JOIN groups g ON g.id = p.group_id
        ORDER BY p.id DESC
    `);
}

async function addPassword(payload, db = getCurrentDB()) {
    await ensureBaseTables(db);
    await ensurePasswordColumns(db);
    
    const { label, group, address, username, password } = payload;
    
    // Get or create group
    const { ensureGroupByName } = require('./dbGroups');
    const groupId = group ? await ensureGroupByName(group, db) : 1;
    
    const res = await run(db, 
        'INSERT INTO passwords (name, label, group_id, address, username, password) VALUES (?,?,?,?,?,?)', 
        [label, label, groupId, address || null, username || null, password]
    );
    
    return { id: res && res.lastID };
}

async function updatePassword(payload, db = getCurrentDB()) {
    await ensureBaseTables(db);
    await ensurePasswordColumns(db);
    
    const fields = [];
    const params = [];
    
    if (payload.label != null) {
        fields.push('label = ?', 'name = ?');
        params.push(payload.label, payload.label);
    }
    
    if (payload.group != null) {
        const { ensureGroupByName } = require('./dbGroups');
        const groupId = payload.group ? await ensureGroupByName(payload.group, db) : 1;
        fields.push('group_id = ?');
        params.push(groupId);
    }
    
    if (payload.address != null) {
        fields.push('address = ?');
        params.push(payload.address);
    }
    
    if (payload.username != null) {
        fields.push('username = ?');
        params.push(payload.username);
    }
    
    if (payload.password != null) {
        fields.push('password = ?');
        params.push(payload.password);
    }
    
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

async function getPasswordsCount(db = getCurrentDB()) {
    await ensureBaseTables(db);
    const result = await get(db, 'SELECT COUNT(*) AS c FROM passwords');
    return (result && result.c) || 0;
}

module.exports = {
    ensurePasswordColumns,
    getPasswords,
    addPassword,
    updatePassword,
    deletePassword,
    getPasswordsCount
};