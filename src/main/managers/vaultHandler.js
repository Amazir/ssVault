const AdmZip = require('adm-zip');
const openpgp = require('openpgp');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('@journeyapps/sqlcipher').verbose();

const { openVaultDB, closeCurrentDB } = require('../utils/db');

class VaultHandler {
    constructor(vaultPath, password) {
        this.vaultPath = vaultPath;
        this.password = password;
        this.tempDir = path.join(__dirname, '../../../temp-vault');
        this.cleanTempDir();  // Czyszczenie na start
        if (!fs.existsSync(this.tempDir)) fs.mkdirSync(this.tempDir);
    }

    cleanTempDir() {
        if (fs.existsSync(this.tempDir)) {
            fs.rmSync(this.tempDir, { recursive: true, force: true });
        }
    }

    async createVault() {
        try {
            const dbPath = this.createEmptyDB();  // Twórz DB
            if (!fs.existsSync(dbPath)) throw new Error('DB not created');
            const zip = new AdmZip();
            zip.addLocalFile(dbPath);  // Dodaj DB
            const zipBuffer = zip.toBuffer();
            const encryptedZip = await this.encryptWithGPG(zipBuffer);
            fs.writeFileSync(this.vaultPath, encryptedZip);
            console.log('Sejf utworzony:', this.vaultPath);
        } catch (err) {
            console.error('Błąd createVault:', err);
            throw err;  // Przekaż do IPC
        } finally {
            this.cleanTempDir();  // Czyszczenie po
        }
    }

    async openVault() {
        // Odczytaj, deszyfruj GPG, ekstraktuj ZIP do temp
        const encryptedData = fs.readFileSync(this.vaultPath);
        const decryptedZip = await this.decryptWithGPG(encryptedData);
        const zip = new AdmZip(decryptedZip);
        zip.extractAllTo(this.tempDir, true);
        // Otwórz DB z temp
        const dbPath = path.join(this.tempDir, 'metadata.db');
        openVaultDB(dbPath, this.password);
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

    createEmptyDB() {
        const dbPath = path.join(this.tempDir, 'metadata.db');
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) console.error('Błąd tworzenia DB:', err);
        });
        db.close();
        console.log('Pusty DB utworzony:', dbPath);  // Debug
        return dbPath;
    }
}

module.exports = VaultHandler;