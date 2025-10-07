const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const saltRounds = 10;
const hashFile = path.join(__dirname, '../../../secure-hash.txt'); // Lokalny plik z hashem (bezpieczny, lokalny)

async function setMasterPassword(password) {
    const hash = await bcrypt.hash(password, saltRounds);
    fs.writeFileSync(hashFile, hash);
}

async function validateMasterPassword(password) {
    if (!fs.existsSync(hashFile)) return false;
    const hash = fs.readFileSync(hashFile, 'utf-8');
    return await bcrypt.compare(password, hash);
}

module.exports = { setMasterPassword, validateMasterPassword };