const AdmZip = require('adm-zip');
const openpgp = require('openpgp');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sqlite3 = require('@journeyapps/sqlcipher').verbose();
const { setMasterPasswordForVault } = require('../utils/auth');  // Dodaj to
const { openVaultDB, closeCurrentDB } = require('../utils/db');

class VaultHandler {
    constructor(vaultPath, password) {
        this.vaultPath = vaultPath;
        this.password = password;
        this.tempDir = path.join(os.tmpdir(), 'ssVault-temp');
        this.cleanTempDir();
        if (!fs.existsSync(this.tempDir)) fs.mkdirSync(this.tempDir);
    }

    cleanTempDir() {
        if (fs.existsSync(this.tempDir)) {
            try {
                fs.rmSync(this.tempDir, { recursive: true, force: true });
            } catch (err) {
                if (err.code === 'EBUSY') {
                    console.log('EBUSY - czekam 1000ms');
                    setTimeout(() => fs.rmSync(this.tempDir, { recursive: true, force: true }), 1000);
                } else {
                    console.error('Błąd czyszczenia temp:', err);
                }
            }
        }
    }

    async openVault() {
        try {
            const encryptedData = fs.readFileSync(this.vaultPath, 'utf-8');  // Dodaj 'utf-8' dla armored text
            const decryptedZipBuffer = await this.decryptWithGPG(encryptedData);
            const zip = new AdmZip(Buffer.from(decryptedZipBuffer, 'binary'));  // Konwertuj do Buffer dla ZIP
            zip.extractAllTo(this.tempDir, true);
            console.log('ZIP wyekstrahowany do temp');
            const dbPath = path.join(this.tempDir, 'metadata.db');
            if (!fs.existsSync(dbPath)) throw new Error('metadata.db not found in vault');
            openVaultDB(dbPath, this.password);
            console.log('DB otwarty z sejfu');
        } catch (err) {
            console.error('Błąd openVault:', err);
            this.cleanTempDir();
            throw err;
        }
    }
    async createVault() {
        try {
            const dbPath = this.createEmptyDB();  // Teraz z key i hash
            if (!fs.existsSync(dbPath)) throw new Error('DB not created');
            console.log('DB istnieje:', dbPath);
            const zip = new AdmZip();
            zip.addLocalFile(dbPath);
            const zipBuffer = zip.toBuffer();
            const encryptedZip = await this.encryptWithGPG(zipBuffer);
            fs.writeFileSync(this.vaultPath, encryptedZip);
            console.log('Sejf utworzony:', this.vaultPath);
        } catch (err) {
            console.error('Błąd createVault:', err);
            throw err;
        } finally {
            this.cleanTempDir();
        }
    }

    createEmptyDB() {
        const dbPath = path.join(this.tempDir, 'metadata.db');
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) throw err;
        });
        db.run(`PRAGMA key = '${this.password}'`, (err) => {
            if (err) throw err;
            console.log('Key set');
            db.serialize(() => {
                db.run('CREATE TABLE IF NOT EXISTS auth (id INTEGER PRIMARY KEY, master_hash TEXT)', (err) => {
                    if (err) throw err;
                    console.log('Table auth created');
                });
                db.run('CREATE TABLE IF NOT EXISTS passwords (id INTEGER PRIMARY KEY, name TEXT, password TEXT)', (err) => {
                    if (err) throw err;
                    console.log('Table passwords created');
                });
            });
            // INSERT hash po CREATE
            setMasterPasswordForVault(this.password).then(() => {
                console.log('Hash inserted');
            }).catch(err => console.error('Błąd set hash:', err));
        });
        db.close((err) => {
            if (err) console.error('Błąd zamknięcia DB:', err);
            else console.log('DB zamknięty:', dbPath);
        });
        return dbPath;
    }

    async closeVault() {
        // Zapisz zmiany do ZIP, szyfruj GPG, zapisz .vault
        closeCurrentDB();
        const zip = new AdmZip();
        zip.addLocalFolder(this.tempDir);
        const zipBuffer = zip.toBuffer();
        const encryptedZip = await this.encryptWithGPG(zipBuffer);
        fs.writeFileSync(this.vaultPath, encryptedZip);
        fs.rmSync(this.tempDir, { recursive: true });  // Czyszczenie temp
    }

    async encryptWithGPG(data) {
        const message = await openpgp.createMessage({ binary: data });
        return await openpgp.encrypt({ message, passwords: [this.password], format: 'armored' });  // Dodaj format: 'armored' dla text
    }

    async decryptWithGPG(encrypted) {
        const message = await openpgp.readMessage({ armoredMessage: encrypted });
        const decrypted = await openpgp.decrypt({ message, passwords: [this.password] });
        return Buffer.from(decrypted.data, 'binary');
    }
}

module.exports = VaultHandler;