const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { dialog } = require('electron');
const openpgp = require('openpgp');


class FileManager {
    constructor(tempDir, vaultPublicKey = null, vaultPrivateKey = null, password = null) {
        this.tempDir = tempDir;
        this.filesDir = path.join(tempDir, 'files');
        this.vaultPublicKey = vaultPublicKey;
        this.vaultPrivateKey = vaultPrivateKey;
        this.password = password;
        this.ensureFilesDirectory();
    }

    ensureFilesDirectory() {
        if (!fs.existsSync(this.filesDir)) {
            fs.mkdirSync(this.filesDir, { recursive: true });
        }
    }

    calculateFileHash(filePath) {
        const fileBuffer = fs.readFileSync(filePath);
        return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    }

    generateStoredFilename(originalName) {
        const ext = path.extname(originalName);
        const timestamp = Date.now();
        const random = crypto.randomBytes(8).toString('hex');
        return `${timestamp}_${random}${ext}`;
    }

    async selectFileForVault() {
        const result = await dialog.showOpenDialog({
            title: 'Select file to add to vault',
            properties: ['openFile']
        });

        if (result.canceled || !result.filePaths.length) {
            return null;
        }

        const sourceFilePath = result.filePaths[0];
        const originalName = path.basename(sourceFilePath);
        
        
        const choice = await dialog.showMessageBox({
            type: 'question',
            title: 'File Operation',
            message: `How would you like to add "${originalName}" to the vault?`,
            detail: 'Choose whether to copy the file (keep original) or move it (remove from current location)',
            buttons: ['Cancel', 'Copy (Keep Original)', 'Move (Delete Original)'],
            defaultId: 1,
            cancelId: 0
        });

        if (choice.response === 0) { 
            return null;
        }

        const shouldMove = choice.response === 2;
        
        return {
            sourceFilePath,
            originalName,
            shouldMove
        };
    }

    async storeFileInVault(sourceFilePath, originalName, shouldMove = false) {
        try {
            
            const storedFilename = this.generateStoredFilename(originalName) + '.gpg';
            const destPath = path.join(this.filesDir, storedFilename);

            
            const fileBuffer = fs.readFileSync(sourceFilePath);
            const fileSize = fileBuffer.length;
            const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

            
            const encryptedData = await this.encryptFile(fileBuffer);
            
            
            fs.writeFileSync(destPath, encryptedData);

            
            if (shouldMove) {
                fs.unlinkSync(sourceFilePath);
            }

            return {
                originalName,
                storedFilename,
                size: fileSize, 
                hash: fileHash, 
                addedDate: new Date().toISOString()
            };
        } catch (error) {
            throw new Error(`Failed to store file: ${error.message}`);
        }
    }

    async encryptFile(fileBuffer) {
        if (!this.vaultPublicKey) {
            throw new Error('No vault public key set for FileManager');
        }

        const publicKey = await openpgp.readKey({
            armoredKey: this.vaultPublicKey
        });
        
        const message = await openpgp.createMessage({ binary: fileBuffer });
        const encrypted = await openpgp.encrypt({
            message,
            encryptionKeys: publicKey, 
            format: 'binary',
            config: {
                aeadProtect: false,
                preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256
            }
        });
        
        return Buffer.from(encrypted);
    }

    async decryptFile(encryptedBuffer) {
        if (!this.vaultPrivateKey) {
            throw new Error('No vault private key set for FileManager');
        }
        
        if (!this.password) {
            throw new Error('No password set for FileManager');
        }

        
        const privateKey = await openpgp.decryptKey({
            privateKey: await openpgp.readPrivateKey({ armoredKey: this.vaultPrivateKey }),
            passphrase: this.password
        });

        const message = await openpgp.readMessage({ binaryMessage: encryptedBuffer });
        const { data: decrypted } = await openpgp.decrypt({
            message,
            decryptionKeys: privateKey, 
            format: 'binary'
        });
        
        return Buffer.from(decrypted);
    }

    async getFileFromVault(storedFilename) {
        const filePath = path.join(this.filesDir, storedFilename);
        if (!fs.existsSync(filePath)) {
            throw new Error('File not found in vault');
        }
        
        
        const encryptedBuffer = fs.readFileSync(filePath);
        
        
        const decryptedBuffer = await this.decryptFile(encryptedBuffer);
        
        return decryptedBuffer;
    }

    async exportFileFromVault(storedFilename, originalName) {
        const result = await dialog.showSaveDialog({
            title: 'Export file from vault',
            defaultPath: originalName
        });

        if (result.canceled || !result.filePath) {
            return null;
        }

        
        const decryptedBuffer = await this.getFileFromVault(storedFilename);
        
        
        fs.writeFileSync(result.filePath, decryptedBuffer);
        
        return result.filePath;
    }

    deleteFileFromVault(storedFilename) {
        const filePath = path.join(this.filesDir, storedFilename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    async verifyFileIntegrity(storedFilename, expectedHash) {
        const decryptedBuffer = await this.getFileFromVault(storedFilename);
        const actualHash = crypto.createHash('sha256')
            .update(decryptedBuffer)
            .digest('hex');
        return actualHash === expectedHash;
    }

    getAllVaultFiles() {
        if (!fs.existsSync(this.filesDir)) {
            return [];
        }
        
        return fs.readdirSync(this.filesDir).filter(filename => {
            const filePath = path.join(this.filesDir, filename);
            return fs.statSync(filePath).isFile();
        });
    }
}

module.exports = FileManager;