const AdmZip = require('adm-zip');
const openpgp = require('openpgp');
const fs = require('fs');
const os = require('os');
const bcrypt = require('bcrypt');
const path = require('path');
const sqlite3 = require('@journeyapps/sqlcipher').verbose();
const { openVaultDB, closeCurrentDB } = require('../utils/db');

const saltRounds = 10;

function escapeForSqlite(str) {
    return String(str).replace(/'/g, "''");
}

class VaultHandler {
    constructor(vaultPath, password) {
        this.vaultPath = vaultPath;
        this.password = password;
        this.tempDir = path.join(os.tmpdir(), 'ssVault-temp');
        this.cleanTempDir();
        if (!fs.existsSync(this.tempDir)) fs.mkdirSync(this.tempDir, { recursive: true });
    }

    async sealVault() {
        const dbPath = path.join(this.tempDir, 'metadata.db');
        if (!fs.existsSync(dbPath)) {
            throw new Error('metadata.db not found during sealVault');
        }
        const zip = new AdmZip();
        zip.addLocalFile(dbPath);
        const zipBuffer = zip.toBuffer();
        const encryptedZip = await this.encryptWithGPG(zipBuffer);
        fs.writeFileSync(this.vaultPath, encryptedZip);
        return true;
    }

    cleanTempDir() {
        if (fs.existsSync(this.tempDir)) {
            try {
                fs.rmSync(this.tempDir, { recursive: true, force: true });
            } catch (err) {
                if (err.code === 'EBUSY') {
                    console.log('EBUSY - waiting 2000ms');
                    setTimeout(() => fs.rmSync(this.tempDir, { recursive: true, force: true }), 2000);
                } else {
                    console.error('Temp cleanup error:', err);
                }
            }
        }
    }

    async createVault() {
        try {
            const dbPath = await this.createEmptyDB();
            if (!fs.existsSync(dbPath)) throw new Error('DB not created');
            console.log('DB exists:', dbPath);
            const zip = new AdmZip();
            zip.addLocalFile(dbPath);
            const zipBuffer = zip.toBuffer();
            const encryptedZip = await this.encryptWithGPG(zipBuffer);
            fs.writeFileSync(this.vaultPath, encryptedZip);
            console.log('Vault created:', this.vaultPath);
        } catch (err) {
            console.error('createVault error:', err);
            throw err;
        } finally {
            this.cleanTempDir();
        }
    }

    createEmptyDB() {
        const dbPath = path.join(this.tempDir, 'metadata.db');
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath, (err) => {
                if (err) return reject(err);
            });
            const safeKey = escapeForSqlite(this.password);
            db.run(`PRAGMA key = '${safeKey}'`, (err) => {
                if (err) return reject(err);
                console.log('Key set');
                db.get('PRAGMA journal_mode = DELETE', (jmErr) => {
                    if (jmErr) console.warn('PRAGMA journal_mode set error:', jmErr);
                    db.run('PRAGMA synchronous = FULL', (syncErr) => {
                        if (syncErr) return reject(syncErr);
                        console.log('Synchronous FULL');
                        db.run('CREATE TABLE IF NOT EXISTS auth (id INTEGER PRIMARY KEY, master_hash TEXT)', (err) => {
                            if (err) return reject(err);
                            console.log('Table auth created');
                            const hash = bcrypt.hashSync(this.password, saltRounds);
                            db.run('INSERT OR REPLACE INTO auth (id, master_hash) VALUES (1, ?)', [hash], (err) => {
                                if (err) return reject(err);
                                console.log('Hash inserted');
                                db.run('CREATE TABLE IF NOT EXISTS passwords (id INTEGER PRIMARY KEY, name TEXT, password TEXT)', (err) => {
                                    if (err) return reject(err);
                                    console.log('Table passwords created');
                                    db.run('PRAGMA wal_checkpoint(TRUNCATE)', (chkErr) => {
                                        if (chkErr) console.warn('Checkpoint error:', chkErr);
                                        console.log('Checkpoint done');
                                        db.close((closeErr) => {
                                            if (closeErr) {
                                                console.error('DB close error:', closeErr);
                                                return reject(closeErr);
                                            }
                                            console.log('DB closed:', dbPath);
                                            resolve(dbPath);
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    }

    async openVault() {
        try {
            const encryptedData = fs.readFileSync(this.vaultPath); // Buffer
            const decryptedZipBuffer = await this.decryptWithGPG(encryptedData);

            const zip = new AdmZip(decryptedZipBuffer);
            zip.extractAllTo(this.tempDir, true);
            console.log('ZIP extracted to temp');

            const dbPath = path.join(this.tempDir, 'metadata.db');
            if (!fs.existsSync(dbPath)) throw new Error('metadata.db not found in vault');

            await openVaultDB(dbPath, this.password);
            console.log('DB opened from vault');
        } catch (err) {
            console.error('openVault error:', err);
            this.cleanTempDir();
            throw err;
        }
    }

    async closeVault() {
        await closeCurrentDB();

        // Only include the SQLite file to avoid temp artifacts
        const dbPath = path.join(this.tempDir, 'metadata.db');
        if (!fs.existsSync(dbPath)) {
            throw new Error('metadata.db not found during closeVault');
        }

        const beforeSize = fs.existsSync(this.vaultPath) ? fs.statSync(this.vaultPath).size : 0;

        const zip = new AdmZip();
        zip.addLocalFile(dbPath);
        const zipBuffer = zip.toBuffer();

        const encryptedZip = await this.encryptWithGPG(zipBuffer);
        fs.writeFileSync(this.vaultPath, encryptedZip); // write binary

        const afterSize = fs.statSync(this.vaultPath).size;
        console.log(`Vault sealed. Size: ${beforeSize} -> ${afterSize} bytes`);

        this.cleanTempDir();
    }

    async encryptWithGPG(dataBuffer) {
        const message = await openpgp.createMessage({ binary: dataBuffer });
        const encrypted = await openpgp.encrypt({
            message,
            passwords: [this.password],
            format: 'binary', // binary
        });
        return Buffer.from(encrypted); // return Buffer
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