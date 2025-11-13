const { getCurrentDB, run, get, all, ensureBaseTables } = require('./db');

/**
 * Ensure the files table has all required columns for enhanced file storage
 */
async function ensureFileColumns(db = getCurrentDB()) {
    try {
        const cols = await all(db, 'PRAGMA table_info(files)');
        const have = (n) => cols.some(c => c.name === n);
        const alters = [];
        
        console.log('Current files table columns:', cols.map(c => c.name));
        
        // Migrate from old structure if needed
        if (have('path') && !have('original_name')) {
            console.log('Migrating files table from old structure...');
        }
        
        if (!have('original_name')) alters.push('ALTER TABLE files ADD COLUMN original_name TEXT');
        if (!have('size')) alters.push('ALTER TABLE files ADD COLUMN size INTEGER');
        if (!have('hash')) alters.push('ALTER TABLE files ADD COLUMN hash TEXT');
        if (!have('stored_filename')) alters.push('ALTER TABLE files ADD COLUMN stored_filename TEXT');
        if (!have('added_date')) alters.push('ALTER TABLE files ADD COLUMN added_date TEXT');
        
        for (const sql of alters) {
            console.log('Adding column:', sql);
            await run(db, sql);
        }
        
        console.log('Files table migration completed');
    } catch (error) {
        console.error('Error ensuring file columns:', error);
        throw error;
    }
}

/**
 * Get all files with enhanced metadata
 */
async function getFiles(db = getCurrentDB()) {
    await ensureBaseTables(db);
    await ensureFileColumns(db);
    
    // Handle both old and new table structure
    const cols = await all(db, 'PRAGMA table_info(files)');
    const have = (n) => cols.some(c => c.name === n);
    
    if (have('original_name')) {
        // New structure
        return all(db, `SELECT id,
                               COALESCE(name, original_name) as name,
                               original_name,
                               size,
                               hash,
                               stored_filename,
                               added_date
                        FROM files ORDER BY id DESC`);
    } else {
        // Fallback for old structure (should not happen after migration)
        return all(db, `SELECT id, name, path as stored_filename FROM files ORDER BY id DESC`);
    }
}

/**
 * Add a file with enhanced metadata
 */
async function addFile(payload, db = getCurrentDB()) {
    await ensureBaseTables(db);
    await ensureFileColumns(db);
    
    console.log('Adding file to database:', payload);
    
    const { name, originalName, size, hash, storedFilename, addedDate } = payload;
    
    try {
        const res = await run(db,
            'INSERT INTO files (name, original_name, size, hash, stored_filename, added_date) VALUES (?,?,?,?,?,?)',
            [name, originalName, size, hash, storedFilename, addedDate]
        );
        console.log('File added to database with ID:', res.lastID);
        return { id: res && res.lastID };
    } catch (error) {
        console.error('Error adding file to database:', error);
        throw error;
    }
}

/**
 * Update file metadata
 */
async function updateFile(id, payload, db = getCurrentDB()) {
    await ensureBaseTables(db);
    await ensureFileColumns(db);
    
    const fields = [];
    const params = [];
    
    if (payload.name != null) { fields.push('name = ?'); params.push(payload.name); }
    if (payload.originalName != null) { fields.push('original_name = ?'); params.push(payload.originalName); }
    if (payload.size != null) { fields.push('size = ?'); params.push(payload.size); }
    if (payload.hash != null) { fields.push('hash = ?'); params.push(payload.hash); }
    if (payload.storedFilename != null) { fields.push('stored_filename = ?'); params.push(payload.storedFilename); }
    
    if (fields.length === 0) return { changes: 0 };
    
    params.push(id);
    const res = await run(db, `UPDATE files SET ${fields.join(', ')} WHERE id = ?`, params);
    return { changes: res && res.changes };
}

/**
 * Delete a file record from database
 */
async function deleteFile(id, db = getCurrentDB()) {
    await ensureBaseTables(db);
    const res = await run(db, 'DELETE FROM files WHERE id = ?', [id]);
    return { changes: res && res.changes };
}

/**
 * Get file by ID
 */
async function getFileById(id, db = getCurrentDB()) {
    await ensureBaseTables(db);
    await ensureFileColumns(db);
    return get(db, 'SELECT * FROM files WHERE id = ?', [id]);
}

/**
 * Get file by stored filename
 */
async function getFileByStoredFilename(storedFilename, db = getCurrentDB()) {
    await ensureBaseTables(db);
    await ensureFileColumns(db);
    return get(db, 'SELECT * FROM files WHERE stored_filename = ?', [storedFilename]);
}

/**
 * Get files count
 */
async function getFilesCount(db = getCurrentDB()) {
    await ensureBaseTables(db);
    const result = await get(db, 'SELECT COUNT(*) AS c FROM files');
    return (result && result.c) || 0;
}

module.exports = {
    ensureFileColumns,
    getFiles,
    addFile,
    updateFile,
    deleteFile,
    getFileById,
    getFileByStoredFilename,
    getFilesCount
};