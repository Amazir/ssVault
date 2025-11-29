const AdmZip = require('adm-zip');
const openpgp = require('openpgp');
const fs = require('fs');
const os = require('os');
const bcrypt = require('bcrypt');
const path = require('path');
const sqlite3 = require('@journeyapps/sqlcipher').verbose();
const { openVaultDB, closeCurrentDB } = require('../utils/db');
const FileManager = require('../utils/fileManager');
const { generateGpgKeyPair, encryptPrivateKey, decryptPrivateKey } = require('../utils/gpgUtils');

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
        this.fileManager = null;
        this.vaultPublicKey = null;
        this.vaultPrivateKey = null;
    }

    async sealVault() {
        const dbPath = path.join(this.tempDir, 'metadata.db');
        if (!fs.existsSync(dbPath)) {
            throw new Error('metadata.db not found during sealVault');
        }
        const zip = new AdmZip();
        zip.addLocalFile(dbPath);
        
        const filesDir = path.join(this.tempDir, 'files');
        if (fs.existsSync(filesDir)) {
            const files = this.fileManager.getAllVaultFiles();
            files.forEach(filename => {
                const filePath = path.join(filesDir, filename);
                zip.addLocalFile(filePath, 'files/');
            });
        }
        
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

    
    async generateVaultKeyPair(db) {
        console.log('Generating vault GPG keypair...');
        const keyPair = await generateGpgKeyPair({
            name: 'ssVault Keypair',
            email: 'vault@ssvault.local',
            expirationDays: 0
        });
        
        
        const encryptedPrivateKey = await encryptPrivateKey(
            keyPair.privateKeyArmored,
            this.password
        );
        
        
        await new Promise((resolve, reject) => {
            db.run(`UPDATE auth SET vault_public_key = ?, vault_private_key = ? WHERE id = 1`,
                [keyPair.publicKeyArmored, encryptedPrivateKey],
                (err) => {
                    if (err) return reject(err);
                    console.log('Vault GPG keys stored in database');
                    resolve();
                }
            );
        });
        
        this.vaultPublicKey = keyPair.publicKeyArmored;
        this.vaultPrivateKey = keyPair.privateKeyArmored; 
        
        return keyPair;
    }
    
    async createVault() {
        try {
            const dbPath = await this.createEmptyDB();
            if (!fs.existsSync(dbPath)) throw new Error('DB not created');
            console.log('DB exists:', dbPath);
            
            this.fileManager = new FileManager(this.tempDir, this.vaultPublicKey);
            
            this.fileManager.ensureFilesDirectory();
            
            const zip = new AdmZip();
            zip.addLocalFile(dbPath);
            
            
            const filesDir = path.join(this.tempDir, 'files');
            if (fs.existsSync(filesDir)) {
                zip.addLocalFolder(filesDir, 'files');
            }
            
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
                        
                        db.run('CREATE TABLE IF NOT EXISTS auth (id INTEGER PRIMARY KEY, master_hash TEXT, vault_public_key TEXT, vault_private_key TEXT)', (err) => {
                            if (err) return reject(err);
                            console.log('Table auth created');
                            const hash = bcrypt.hashSync(this.password, saltRounds);
                            db.run('INSERT OR REPLACE INTO auth (id, master_hash) VALUES (1, ?)', [hash], async (err) => {
                                if (err) return reject(err);
                                console.log('Hash inserted');
                                
                                
                                try {
                                    await this.generateVaultKeyPair(db);
                                } catch (keyErr) {
                                    return reject(keyErr);
                                }
                                db.run('CREATE TABLE IF NOT EXISTS passwords (id INTEGER PRIMARY KEY, name TEXT, password TEXT)', (err) => {
                                    if (err) return reject(err);
                                    console.log('Table passwords created');
                                    
                                    
                                    db.run('CREATE TABLE IF NOT EXISTS files (id INTEGER PRIMARY KEY, name TEXT, original_name TEXT, size INTEGER, hash TEXT, stored_filename TEXT, added_date TEXT)', (filesErr) => {
                                        if (filesErr) return reject(filesErr);
                                        console.log('Table files created');
                                        
                                        
                                        db.run('CREATE TABLE IF NOT EXISTS gpg (id INTEGER PRIMARY KEY, name TEXT, type TEXT)', (gpgErr) => {
                                            if (gpgErr) return reject(gpgErr);
                                            console.log('Table gpg created');
                                            
                                            db.run('CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY, name TEXT UNIQUE)', (groupsErr) => {
                                                if (groupsErr) return reject(groupsErr);
                                                console.log('Table groups created');
                                                
                                                
                                                db.run('INSERT OR IGNORE INTO groups (id, name) VALUES (1, ?)', ['Default'], (defaultGroupErr) => {
                                                    if (defaultGroupErr) return reject(defaultGroupErr);
                                                    console.log('Default group created');
                                                    
                                                    
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
                    });
                });
            });
        });
    }

    async openVault() {
        try {
            const encryptedData = fs.readFileSync(this.vaultPath);

            let decryptedZipBuffer;
            try {
                decryptedZipBuffer = await this.decryptWithGPG(encryptedData);
            } catch (decryptErr) {
                this.failedAttempts++;
                const remainingAttempts = this.maxAttempts - this.failedAttempts;

                // Sprawdź czy to błąd hasła
                if (decryptErr.message &&
                    (decryptErr.message.includes('Session key decryption failed') ||
                        decryptErr.message.includes('decrypt') ||
                        decryptErr.message.includes('password'))) {

                    if (remainingAttempts > 0) {
                        throw new Error(`Incorrect password. ${remainingAttempts} attempt(s) remaining.`);
                    } else {
                        // Opcjonalnie: zablokuj vault na jakiś czas
                        throw new Error('Maximum password attempts exceeded. Vault access temporarily blocked.');
                    }
                } else {
                    // Inny błąd (np. uszkodzony plik)
                    throw new Error(`Failed to decrypt vault: ${decryptErr.message}`);
                }
            }

            const zip = new AdmZip(decryptedZipBuffer);
            zip.extractAllTo(this.tempDir, true);
            console.log('ZIP extracted to temp');

            const dbPath = path.join(this.tempDir, 'metadata.db');
            if (!fs.existsSync(dbPath)) {
                throw new Error('Vault is corrupted: metadata.db not found');
            }

            try {
                await openVaultDB(dbPath, this.password);
            } catch (dbErr) {
                this.failedAttempts++;
                const remainingAttempts = this.maxAttempts - this.failedAttempts;

                if (remainingAttempts > 0) {
                    throw new Error(`Incorrect database password. ${remainingAttempts} attempt(s) remaining.`);
                } else {
                    throw new Error('Maximum password attempts exceeded. Vault access temporarily blocked.');
                }
            }

            console.log('DB opened from vault');

            await this.loadVaultKeys();

            this.fileManager = new FileManager(this.tempDir, this.vaultPublicKey, this.vaultPrivateKey, this.password);

            this.failedAttempts = 0;

        } catch (err) {
            console.error('openVault error:', err);
            this.cleanTempDir();
            throw err;
        }
    }

    // ✅ Dodaj metodę do resetu licznika (np. po timeout)
    resetFailedAttempts() {
        this.failedAttempts = 0;
    }

    getFailedAttempts() {
        return this.failedAttempts;
    }
    
    
    async loadVaultKeys() {
        const { get } = require('../utils/db');
        const { getCurrentDB } = require('../utils/db');
        const db = getCurrentDB();
        
        const authRow = await get(db, 'SELECT vault_public_key, vault_private_key FROM auth WHERE id = 1');
        
        if (!authRow || !authRow.vault_public_key || !authRow.vault_private_key) {
            throw new Error('Vault GPG keys not found in database');
        }
        
        this.vaultPublicKey = authRow.vault_public_key;
        
        
        this.vaultPrivateKey = await decryptPrivateKey(
            authRow.vault_private_key,
            this.password
        );
        
        console.log('Vault GPG keys loaded from database');
    }

    async closeVault() {
        await closeCurrentDB();

        const dbPath = path.join(this.tempDir, 'metadata.db');
        if (!fs.existsSync(dbPath)) {
            throw new Error('metadata.db not found during closeVault');
        }

        const beforeSize = fs.existsSync(this.vaultPath) ? fs.statSync(this.vaultPath).size : 0;

        const zip = new AdmZip();
        zip.addLocalFile(dbPath);
        
        const filesDir = path.join(this.tempDir, 'files');
        if (fs.existsSync(filesDir)) {
            const files = this.fileManager.getAllVaultFiles();
            files.forEach(filename => {
                const filePath = path.join(filesDir, filename);
                zip.addLocalFile(filePath, 'files/');
            });
        }
        
        const zipBuffer = zip.toBuffer();
        const encryptedZip = await this.encryptWithGPG(zipBuffer);
        fs.writeFileSync(this.vaultPath, encryptedZip);

        const afterSize = fs.statSync(this.vaultPath).size;
        console.log(`Vault sealed. Size: ${beforeSize} -> ${afterSize} bytes`);

        this.cleanTempDir();
    }

    async encryptWithGPG(dataBuffer) {
        const message = await openpgp.createMessage({ binary: dataBuffer });
        const encrypted = await openpgp.encrypt({
            message,
            passwords: [this.password],
            format: 'binary', 
        });
        return Buffer.from(encrypted); 
    }

    async decryptWithGPG(encryptedBuffer) {
        const message = await openpgp.readMessage({ binaryMessage: encryptedBuffer });
        const { data } = await openpgp.decrypt({
            message,
            passwords: [this.password],
            format: 'binary', 
        });
        return Buffer.from(data);
    }
}

module.exports = VaultHandler;