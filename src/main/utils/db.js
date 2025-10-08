const sqlite3 = require('@journeyapps/sqlcipher').verbose();

let currentDB;

function openVaultDB(vaultPath, key) {
    currentDB = new sqlite3.Database(vaultPath, (err) => {
        if (err) console.error('Błąd otwarcia DB:', err);
    });
    currentDB.run(`PRAGMA key = '${key}'`, (err) => {
        if (err) console.error('Błąd ustawienia klucza:', err);
    });

    currentDB.serialize(() => {
        currentDB.run(`CREATE TABLE IF NOT EXISTS auth (id INTEGER PRIMARY KEY, master_hash TEXT)`);
        currentDB.run(`CREATE TABLE IF NOT EXISTS passwords (id INTEGER PRIMARY KEY, name TEXT, password TEXT)`);
    });

    console.log('DB otwarty i zainicjowany dla:', vaultPath);  // Debug
    return currentDB;
}

function getCurrentDB() {
    return currentDB;
}

function closeCurrentDB() {
    if (currentDB) {
        currentDB.close((err) => {
            if (err) console.error('Błąd zamknięcia DB:', err);
        });
    }
}

module.exports = { openVaultDB, getCurrentDB, closeCurrentDB };