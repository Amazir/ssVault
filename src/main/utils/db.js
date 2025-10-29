const sqlite3 = require('@journeyapps/sqlcipher').verbose();

let currentDB;

function openVaultDB(vaultPath, key) {
    currentDB = new sqlite3.Database(vaultPath, (err) => {
        if (err) console.error('DB open error:', err);
    });
    currentDB.run(`PRAGMA key = '${key}'`, (err) => {
        if (err) console.error('Error setting key:', err);
    });

    // Validate that the key is correct and the database is readable before doing anything else
    currentDB.all(`PRAGMA cipher_integrity_check`, (err, rows) => {
        if (err) {
            console.error('Key verification/cipher_integrity_check error:', err);
            // Close immediately to avoid writing with wrong key
            try { currentDB.close(); } catch (_) {}
            currentDB = undefined;
            throw new Error('Invalid password or corrupted vault');
        }

        // rows can be undefined, empty, or an array of objects depending on driver
        const isOkFromRows = Array.isArray(rows) && rows.some(row => {
            return row && Object.values(row).some(v => typeof v === 'string' && v.toLowerCase() === 'ok');
        });

        if (isOkFromRows) {
            console.log('DB opened successfully for:', vaultPath);
            return;
        }

        // Fallback: try to read schema and auth row to confirm correct key
        currentDB.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='auth'`, (smErr, smRow) => {
            if (smErr) {
                console.error('sqlite_master read error (fallback):', smErr, 'cipher_integrity_check result:', rows);
                try { currentDB.close(); } catch (_) {}
                currentDB = undefined;
                throw new Error('Invalid password or corrupted vault');
            }
            if (!smRow) {
                console.error('Auth table does not exist (fallback). cipher_integrity_check result:', rows);
                try { currentDB.close(); } catch (_) {}
                currentDB = undefined;
                throw new Error('Invalid password or corrupted vault');
            }
            // Try read the hash row
            currentDB.get(`SELECT master_hash FROM auth WHERE id = 1`, (authErr, authRow) => {
                if (authErr) {
                    console.error('Auth table read error (fallback):', authErr, 'cipher_integrity_check result:', rows);
                    try { currentDB.close(); } catch (_) {}
                    currentDB = undefined;
                    throw new Error('Invalid password or corrupted vault');
                }
                if (!authRow) {
                    console.error('No record in auth (fallback). cipher_integrity_check result:', rows);
                    try { currentDB.close(); } catch (_) {}
                    currentDB = undefined;
                    throw new Error('Invalid password or corrupted vault');
                }
                // If we were able to read a row, the key is correct even if cipher_integrity_check was atypical
                console.log('DB opened successfully (fallback) for:', vaultPath);
            });
        });
    });

    return currentDB;
}

function getCurrentDB() {
    return currentDB;
}

function closeCurrentDB() {
    return new Promise((resolve) => {
        if (currentDB) {
            currentDB.close((err) => {
                if (err) console.error('DB close error:', err);
                currentDB = undefined;
                resolve();
            });
        } else {
            resolve();
        }
    });
}

module.exports = { openVaultDB, getCurrentDB, closeCurrentDB };