const AdmZip = require('adm-zip');
const openpgp = require('openpgp');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sqlite3 = require('@journeyapps/sqlcipher').verbose();

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
                console.log('Temp dir wyczyszczony');  // Debug
            } catch (err) {
                if (err.code === 'EBUSY') {
                    console.log('EBUSY - czekam 500ms');  // Opóźnienie dla Windows
                    setTimeout(() => fs.rmSync(this.tempDir, { recursive: true, force: true }), 500);
                } else {
                    console.error('Błąd czyszczenia temp:', err);
                }
            }
        }
    }

    async createVault() {
        try {
            const dbPath = this.createEmptyDB();
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
        try {
            const db = new sqlite3.Database(dbPath, (err) => {
                if (err) throw err;
            });
            db.serialize(() => {
                db.run('CREATE TABLE IF NOT EXISTS auth (id INTEGER PRIMARY KEY, master_hash TEXT)');
                db.run('CREATE TABLE IF NOT EXISTS passwords (id INTEGER PRIMARY KEY, name TEXT, password TEXT)');
                // Dummy insert to force file creation
                db.run('INSERT OR IGNORE INTO auth (id) VALUES (1)');
            });
            db.close((err) => {
                if (err) console.error('Błąd zamknięcia DB:', err);
                else console.log('DB zamknięty:', dbPath);
            });
        } catch (err) {
            console.error('Błąd inicjalizacji DB:', err);
            throw err;
        }
        return dbPath;
    }

    async openVault() {
        try {
            const encryptedData = fs.readFileSync(this.vaultPath);
            const decryptedZipBuffer = await this.decryptWithGPG(encryptedData);
            const zip = new AdmZip(decryptedZipBuffer);
            zip.extractAllTo(this.tempDir, true);
            console.log('ZIP wyekstrahowany do temp');
            const dbPath = path.join(this.tempDir, 'metadata.db');
            if (!fs.existsSync(dbPath)) throw new Error('metadata.db not found in vault');
            openVaultDB(dbPath, this.password);  // Otwórz szyfrowaną DB
            console.log('DB otwarty z sejfu');
        } catch (err) {
            console.error('Błąd openVault:', err);
            this.cleanTempDir();
            throw err;
        }
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
        return await openpgp.encrypt({ message, passwords: [this.password] });
    }

    async decryptWithGPG(encrypted) {
        const message = await openpgp.readMessage({ armoredMessage: encrypted });
        const decrypted = await openpgp.decrypt({ message, passwords: [this.password] });
        return Buffer.from(decrypted.data, 'binary');
    }
}

module.exports = VaultHandler;