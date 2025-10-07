const sqlite3 = require('@journeyapps/sqlcipher').verbose();
let db;

function initDB() {
    db = new sqlite3.Database('./secure.db', (err) => {
        if (err) console.error(err);
    });
    // Tabele tworzone po setDBKey
}

function setDBKey(key) {
    db.run(`PRAGMA key = '${key}'`);
    db.run(`CREATE TABLE IF NOT EXISTS passwords (id INTEGER PRIMARY KEY, name TEXT, password TEXT)`);
    // Dodaj tabele dla files i gpg keys później
}

module.exports = { initDB, setDBKey };