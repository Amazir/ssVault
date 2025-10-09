const AdmZip = require('adm-zip');
const openpgp = require('openpgp');
const fs = require('fs');
const os = require('os');
const bcrypt = require('bcrypt');
const path = require('path');
const sqlite3 = require('@journeyapps/sqlcipher').verbose();
const { openVaultDB, closeCurrentDB } = require('../utils/db');

const saltRounds = 10;

class VaultHandler {
    constructor(vaultPath, password) {
        this.vaultPath = vaultPath;
        this.password = password;
        this.tempDir = path.join(os.tmpdir(), 'ssVault-temp');
        this.cleanTempDir();
        if (!fs.existsSync(this.tempDir)) fs.mkdirSync(this.tempDir, { recursive: true });
    }

    cleanTempDir() {
        if (fs.existsSync(this.tempDir)) {
            try {
                fs.rmSync(this.tempDir, { recursive: true, force: true });
            } catch (err) {
                console.error('Błąd czyszczenia temp:', err);
            }
        }
    }

    /** -------------------- Tworzenie nowego sejfu -------------------- */
    async createVault() {
        try {
            const dbPath = this.createEmptyDB();
            if (!fs.existsSync(dbPath)) throw new Error('DB nie została utworzona');

            const zip = new AdmZip();
            zip.addLocalFile(dbPath);
            const zipBuffer = zip.toBuffer();

            const encryptedZip = await this.encryptWithGPG(zipBuffer);
            fs.writeFileSync(this.vaultPath, encryptedZip); // zapisujemy binary

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
        const db = new sqlite3.Database(dbPath);

        db.serialize(() => {
            db.run(`PRAGMA key = '${this.password}'`);
            console.log('Key ustawiony');

            db.run('CREATE TABLE IF NOT EXISTS auth (id INTEGER PRIMARY KEY, master_hash TEXT)');
            const hash = bcrypt.hashSync(this.password, saltRounds);
            db.run('INSERT OR REPLACE INTO auth (id, master_hash) VALUES (1, ?)', [hash]);
            console.log('Hash master inserted');

            db.run('CREATE TABLE IF NOT EXISTS passwords (id INTEGER PRIMARY KEY, name TEXT, password TEXT)');
        });

        db.close(err => {
            if (err) console.error('Błąd zamknięcia DB:', err);
            else console.log('DB zamknięty:', dbPath);
        });

        return dbPath;
    }

    /** -------------------- Otwieranie istniejącego sejfu -------------------- */
    async openVault() {
        try {
            const encryptedData = fs.readFileSync(this.vaultPath); // Buffer
            const decryptedZipBuffer = await this.decryptWithGPG(encryptedData);

            const zip = new AdmZip(decryptedZipBuffer);
            zip.extractAllTo(this.tempDir, true);
            console.log('ZIP wyekstrahowany do temp');

            const dbPath = path.join(this.tempDir, 'metadata.db');
            if (!fs.existsSync(dbPath)) throw new Error('metadata.db nie znaleziony w sejfie');

            openVaultDB(dbPath, this.password);
            console.log('DB otwarty z sejfu');
        } catch (err) {
            console.error('Błąd openVault:', err);
            this.cleanTempDir();
            throw err;
        }
    }

    /** -------------------- Zamknięcie sejfu -------------------- */
    async closeVault() {
        closeCurrentDB();

        const zip = new AdmZip();
        zip.addLocalFolder(this.tempDir);
        const zipBuffer = zip.toBuffer();

        const encryptedZip = await this.encryptWithGPG(zipBuffer);
        fs.writeFileSync(this.vaultPath, encryptedZip); // zapisujemy binary

        this.cleanTempDir();
    }

    /** -------------------- GPG (binary mode) -------------------- */
    async encryptWithGPG(dataBuffer) {
        const message = await openpgp.createMessage({ binary: dataBuffer });
        const encrypted = await openpgp.encrypt({
            message,
            passwords: [this.password],
            format: 'binary', // binary
        });
        return Buffer.from(encrypted); // zwracamy Buffer
    }

    async decryptWithGPG(encryptedBuffer) {
        const message = await openpgp.readMessage({ binaryMessage: encryptedBuffer });
        const { data } = await openpgp.decrypt({
            message,
            passwords: [this.password],
            format: 'binary', // Uint8Array
        });
        return Buffer.from(data);
    }
}

module.exports = VaultHandler;
