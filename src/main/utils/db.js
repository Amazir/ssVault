const sqlite3 = require('@journeyapps/sqlcipher').verbose();

let currentDB;

function openVaultDB(vaultPath, key) {
    currentDB = new sqlite3.Database(vaultPath, (err) => {
        if (err) console.error('Błąd otwarcia DB:', err);
    });
    currentDB.run(`PRAGMA key = '${key}'`, (err) => {
        if (err) console.error('Błąd ustawienia klucza:', err);
    });

    // Validate that the key is correct and the database is readable before doing anything else
    currentDB.all(`PRAGMA cipher_integrity_check`, (err, rows) => {
        if (err) {
            console.error('Błąd weryfikacji klucza/cipher_integrity_check:', err);
            // Close immediately to avoid writing with wrong key
            try { currentDB.close(); } catch (_) {}
            currentDB = undefined;
            throw new Error('Nieprawidłowe hasło lub uszkodzony sejf');
        }

        // rows can be undefined, empty, or an array of objects depending on driver
        const isOkFromRows = Array.isArray(rows) && rows.some(row => {
            return row && Object.values(row).some(v => typeof v === 'string' && v.toLowerCase() === 'ok');
        });

        if (isOkFromRows) {
            console.log('DB otwarty poprawnie dla:', vaultPath);
            return;
        }

        // Fallback: try to read schema and auth row to confirm correct key
        currentDB.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='auth'`, (smErr, smRow) => {
            if (smErr) {
                console.error('Błąd odczytu sqlite_master (fallback):', smErr, 'Wynik cipher_integrity_check:', rows);
                try { currentDB.close(); } catch (_) {}
                currentDB = undefined;
                throw new Error('Nieprawidłowe hasło lub uszkodzony sejf');
            }
            if (!smRow) {
                console.error('Tabela auth nie istnieje (fallback). Wynik cipher_integrity_check:', rows);
                try { currentDB.close(); } catch (_) {}
                currentDB = undefined;
                throw new Error('Nieprawidłowe hasło lub uszkodzony sejf');
            }
            // Try read the hash row
            currentDB.get(`SELECT master_hash FROM auth WHERE id = 1`, (authErr, authRow) => {
                if (authErr) {
                    console.error('Błąd odczytu tabeli auth (fallback):', authErr, 'Wynik cipher_integrity_check:', rows);
                    try { currentDB.close(); } catch (_) {}
                    currentDB = undefined;
                    throw new Error('Nieprawidłowe hasło lub uszkodzony sejf');
                }
                if (!authRow) {
                    console.error('Brak rekordu w auth (fallback). Wynik cipher_integrity_check:', rows);
                    try { currentDB.close(); } catch (_) {}
                    currentDB = undefined;
                    throw new Error('Nieprawidłowe hasło lub uszkodzony sejf');
                }
                // If we were able to read a row, the key is correct even if cipher_integrity_check was atypical
                console.log('DB otwarty poprawnie (fallback) dla:', vaultPath);
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
                if (err) console.error('Błąd zamknięcia DB:', err);
                currentDB = undefined;
                resolve();
            });
        } else {
            resolve();
        }
    });
}

module.exports = { openVaultDB, getCurrentDB, closeCurrentDB };