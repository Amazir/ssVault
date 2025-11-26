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

    /**
     * Calculate file hash for integrity checking
     */
    calculateFileHash(filePath) {
        const fileBuffer = fs.readFileSync(filePath);
        return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    }

    /**
     * Generate unique filename for storage
     */
    generateStoredFilename(originalName) {
        const ext = path.extname(originalName);
        const timestamp = Date.now();
        const random = crypto.randomBytes(8).toString('hex');
        return `${timestamp}_${random}${ext}`;
    }

    /**
     * Show file picker with copy/move dialog
     */
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
        
        // Show copy/move dialog
        const choice = await dialog.showMessageBox({
            type: 'question',
            title: 'File Operation',
            message: `How would you like to add "${originalName}" to the vault?`,
            detail: 'Choose whether to copy the file (keep original) or move it (remove from current location)',
            buttons: ['Cancel', 'Copy (Keep Original)', 'Move (Delete Original)'],
            defaultId: 1,
            cancelId: 0
        });

        if (choice.response === 0) { // Cancel
            return null;
        }

        const shouldMove = choice.response === 2;
        
        return {
            sourceFilePath,
            originalName,
            shouldMove
        };
    }

    /**
     * Store file in vault with GPG encryption
     */
    async storeFileInVault(sourceFilePath, originalName, shouldMove = false) {
        try {
            // Generate stored filename with .gpg extension
            const storedFilename = this.generateStoredFilename(originalName) + '.gpg';
            const destPath = path.join(this.filesDir, storedFilename);

            // Read source file
            const fileBuffer = fs.readFileSync(sourceFilePath);
            const fileSize = fileBuffer.length;
            const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

            // Encrypt file with GPG using vault password
            const encryptedData = await this.encryptFile(fileBuffer);
            
            // Write encrypted file
            fs.writeFileSync(destPath, encryptedData);

            // Delete original if move operation
            if (shouldMove) {
                fs.unlinkSync(sourceFilePath);
            }

            return {
                originalName,
                storedFilename,
                size: fileSize, // Original size before encryption
                hash: fileHash, // Hash of original file for integrity
                addedDate: new Date().toISOString()
            };
        } catch (error) {
            throw new Error(`Failed to store file: ${error.message}`);
        }
    }

    /**
     * Encrypt file data using OpenPGP with GPG public key (asymmetric encryption)
     */
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
            encryptionKeys: publicKey, // Asymmetric encryption with public key
            format: 'binary',
            config: {
                aeadProtect: false,
                preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256
            }
        });
        
        return Buffer.from(encrypted);
    }

    /**
     * Decrypt file data using OpenPGP with GPG private key (asymmetric decryption)
     */
    async decryptFile(encryptedBuffer) {
        if (!this.vaultPrivateKey) {
            throw new Error('No vault private key set for FileManager');
        }
        
        if (!this.password) {
            throw new Error('No password set for FileManager');
        }

        // Decrypt the private key with vault password
        const privateKey = await openpgp.decryptKey({
            privateKey: await openpgp.readPrivateKey({ armoredKey: this.vaultPrivateKey }),
            passphrase: this.password
        });

        const message = await openpgp.readMessage({ binaryMessage: encryptedBuffer });
        const { data: decrypted } = await openpgp.decrypt({
            message,
            decryptionKeys: privateKey, // Asymmetric decryption with private key
            format: 'binary'
        });
        
        return Buffer.from(decrypted);
    }

    /**
     * Retrieve and decrypt file from vault
     */
    async getFileFromVault(storedFilename) {
        const filePath = path.join(this.filesDir, storedFilename);
        if (!fs.existsSync(filePath)) {
            throw new Error('File not found in vault');
        }
        
        // Read encrypted file
        const encryptedBuffer = fs.readFileSync(filePath);
        
        // Decrypt file
        const decryptedBuffer = await this.decryptFile(encryptedBuffer);
        
        return decryptedBuffer;
    }

    /**
     * Export file from vault to chosen location (decrypted)
     */
    async exportFileFromVault(storedFilename, originalName) {
        const result = await dialog.showSaveDialog({
            title: 'Export file from vault',
            defaultPath: originalName
        });

        if (result.canceled || !result.filePath) {
            return null;
        }

        // Get decrypted file data
        const decryptedBuffer = await this.getFileFromVault(storedFilename);
        
        // Write decrypted file to chosen location
        fs.writeFileSync(result.filePath, decryptedBuffer);
        
        return result.filePath;
    }

    /**
     * Delete file from vault
     */
    deleteFileFromVault(storedFilename) {
        const filePath = path.join(this.filesDir, storedFilename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    /**
     * Verify file integrity (hash of decrypted content)
     */
    async verifyFileIntegrity(storedFilename, expectedHash) {
        const decryptedBuffer = await this.getFileFromVault(storedFilename);
        const actualHash = crypto.createHash('sha256')
            .update(decryptedBuffer)
            .digest('hex');
        return actualHash === expectedHash;
    }

    /**
     * Get all files in vault directory (for archiving)
     */
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