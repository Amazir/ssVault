const bcrypt = require('bcrypt');
const { getCurrentDB } = require('./db');

const saltRounds = 10;

async function setMasterPasswordForVault(password) {
    const db = getCurrentDB();
    const hash = await bcrypt.hash(password, saltRounds);
    return new Promise((resolve, reject) => {
        db.run('INSERT OR REPLACE INTO auth (id, master_hash) VALUES (1, ?)', [hash], (err) => {
            if (err) {
                console.error('Błąd INSERT auth:', err);  // Debug
                reject(err);
            } else {
                console.log('Hash master zapisany');  // Debug
                resolve();
            }
        });
    });
}

async function validateMasterPasswordForVault(password) {
    const db = getCurrentDB();
    return new Promise((resolve) => {
        db.get('SELECT master_hash FROM auth WHERE id = 1', async (err, row) => {
            if (err) {
                console.error('Błąd SELECT auth:', err);  // Debug
                resolve(false);
            }
            if (!row) resolve(false);
            const match = await bcrypt.compare(password, row.master_hash);
            console.log('Walidacja master:', match);  // Debug
            resolve(match);
        });
    });
}

module.exports = { setMasterPasswordForVault, validateMasterPasswordForVault };