const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { dialog } = require('electron');

/**
 * File Manager for handling encrypted file storage in vault
 */
class FileManager {
    constructor(tempDir) {
        this.tempDir = tempDir;
        this.filesDir = path.join(tempDir, 'files');
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
     * Store file in vault with encryption-ready structure
     */
    async storeFileInVault(sourceFilePath, originalName, shouldMove = false) {
        try {
            // Generate stored filename
            const storedFilename = this.generateStoredFilename(originalName);
            const destPath = path.join(this.filesDir, storedFilename);

            // Get file stats
            const stats = fs.statSync(sourceFilePath);
            const fileSize = stats.size;
            const fileHash = this.calculateFileHash(sourceFilePath);

            // Copy or move file to vault
            if (shouldMove) {
                fs.renameSync(sourceFilePath, destPath);
            } else {
                fs.copyFileSync(sourceFilePath, destPath);
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

    /**
     * Retrieve file from vault
     */
    getFileFromVault(storedFilename) {
        const filePath = path.join(this.filesDir, storedFilename);
        if (!fs.existsSync(filePath)) {
            throw new Error('File not found in vault');
        }
        return filePath;
    }

    /**
     * Export file from vault to chosen location
     */
    async exportFileFromVault(storedFilename, originalName) {
        const result = await dialog.showSaveDialog({
            title: 'Export file from vault',
            defaultPath: originalName
        });

        if (result.canceled || !result.filePath) {
            return null;
        }

        const sourceFile = this.getFileFromVault(storedFilename);
        fs.copyFileSync(sourceFile, result.filePath);
        
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
     * Verify file integrity
     */
    verifyFileIntegrity(storedFilename, expectedHash) {
        const filePath = this.getFileFromVault(storedFilename);
        const actualHash = crypto.createHash('sha256')
            .update(fs.readFileSync(filePath))
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