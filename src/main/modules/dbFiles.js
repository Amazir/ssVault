const { getCurrentDB, run, get, all, ensureBaseTables } = require('../utils/db');

/**
 * Files Management Module
 * Handles all file-related database operations
 */

async function ensureFileColumns(db = getCurrentDB()) {
    try {
        const cols = await all(db, 'PRAGMA table_info(files)');
        const have = (n) => cols.some(c => c.name === n);
        const alters = [];
        
        console.log('Current files table columns:', cols.map(c => c.name));
        
        // Check if we need to migrate from old structure
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

function mapFileType(filename = '') {
    const lower = filename.toLowerCase();

    if (/\.(png|jpe?g|gif|webp|bmp|tiff?|svg|heic|heif|ico)$/.test(lower)) return 'Image';
    if (/\.(mp4|m4v|mkv|mov|avi|wmv|flv|webm|mpeg|mpg|3gp)$/.test(lower)) return 'Video';
    if (/\.(mp3|wav|flac|aac|ogg|m4a|wma|opus)$/.test(lower)) return 'Audio';
    if (/\.(zip|rar|7z|tar|gz|bz2|xz|tgz|iso|dmg)$/.test(lower)) return 'Archive';
    if (/\.(txt|md|rtf|log)$/.test(lower)) return 'Text';
    if (/\.(pdf)$/.test(lower)) return 'PDF';
    if (/\.(docx?|odt|rtf)$/.test(lower)) return 'Document';
    if (/\.(xlsx?|ods|csv|tsv)$/.test(lower)) return 'Spreadsheet';
    if (/\.(pptx?|odp)$/.test(lower)) return 'Presentation';
    if (/\.(js|ts|jsx|tsx|java|c|cpp|cs|go|rs|py|php|rb|swift|kt|sql|html|css|json|yml|yaml|xml|ini|cfg|env)$/.test(lower)) {
        return 'Code/Config';
    }
    if (/\.(db|sqlite|sqlite3|bak|bin|dat)$/.test(lower)) return 'Data';

    return 'Other';
}

async function getFiles(db = getCurrentDB()) {
    await ensureBaseTables(db);
    await ensureFileColumns(db);
    
    const cols = await all(db, 'PRAGMA table_info(files)');
    const have = (n) => cols.some(c => c.name === n);
    
    if (have('original_name')) {
        const rows = await all(db, `
            SELECT 
                id,
                COALESCE(name, original_name) as name,
                original_name,
                size,
                hash,
                stored_filename,
                added_date
            FROM files 
            ORDER BY id DESC
        `);
        
        return rows.map(row => ({
            ...row,
            type: mapFileType(row.original_name || row.name || row.stored_filename)
        }));
    } else {
        // Legacy support
        const rows = await all(db, `SELECT id, name, path as stored_filename FROM files ORDER BY id DESC`);
        return rows.map(row => ({
            ...row,
            type: mapFileType(row.name || row.stored_filename)
        }));
    }
}

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

async function deleteFile(id, db = getCurrentDB()) {
    await ensureBaseTables(db);
    const res = await run(db, 'DELETE FROM files WHERE id = ?', [id]);
    return { changes: res && res.changes };
}

async function getFileById(id, db = getCurrentDB()) {
    await ensureBaseTables(db);
    await ensureFileColumns(db);
    return get(db, 'SELECT * FROM files WHERE id = ?', [id]);
}

async function getFileByStoredFilename(storedFilename, db = getCurrentDB()) {
    await ensureBaseTables(db);
    await ensureFileColumns(db);
    return get(db, 'SELECT * FROM files WHERE stored_filename = ?', [storedFilename]);
}

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