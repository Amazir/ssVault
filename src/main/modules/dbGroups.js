const { getCurrentDB, run, get, all, ensureBaseTables } = require('../utils/db');

/**
 * Groups Management Module
 * Handles all group-related database operations
 */

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
    
    if (id === 1 || id === '1') {
        throw new Error('Cannot delete the Default group');
    }
    
    // Move all passwords from this group to Default
    await run(db, 'UPDATE passwords SET group_id = 1 WHERE group_id = ?', [id]);
    const res = await run(db, 'DELETE FROM groups WHERE id = ?', [id]);
    
    return { changes: res && res.changes };
}

async function ensureGroupByName(name, db = getCurrentDB()) {
    if (!name) return null;
    
    const found = await get(db, 'SELECT id FROM groups WHERE name = ?', [name]).catch(() => null);
    if (found && found.id) return found.id;
    
    await run(db, 'INSERT OR IGNORE INTO groups (name) VALUES (?)', [name]).catch(() => {});
    const again = await get(db, 'SELECT id FROM groups WHERE name = ?', [name]).catch(() => null);
    
    return again ? again.id : null;
}

module.exports = {
    getGroups,
    addGroup,
    deleteGroup,
    ensureGroupByName
};