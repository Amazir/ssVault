const { ipcMain } = require('electron');
const { getCurrentSessionHandler, getCurrentVaultPath } = require('../utils/session');
const { getCurrentDB, ensureBaseTables } = require('../utils/db');
const { getFiles, addFile, deleteFile, getFileById, getFilesCount, ensureFileColumns } = require('../utils/dbFiles');

function registerFileIpcHandlers() {
    console.log('Registering file IPC handlers...');
    
    // File operations
    ipcMain.handle('add-file-to-vault', async () => {
        const handler = getCurrentSessionHandler();
        if (!handler) return { success: false, error: 'No open vault.' };
        
        try {
            const fileManager = handler.fileManager;
            const fileSelection = await fileManager.selectFileForVault();
            
            if (!fileSelection) {
                return { success: false, error: 'No file selected.' };
            }
            
            const { sourceFilePath, originalName, shouldMove } = fileSelection;
            
            // Store the file physically
            const fileData = await fileManager.storeFileInVault(sourceFilePath, originalName, shouldMove);
            
            // Store metadata in database
            const db = getCurrentDB();
            const res = await addFile({
                name: originalName,
                originalName: fileData.originalName,
                size: fileData.size,
                hash: fileData.hash,
                storedFilename: fileData.storedFilename,
                addedDate: fileData.addedDate
            }, db);
            
            // Auto-save vault
            try { 
                if (handler && handler.sealVault) {
                    await handler.sealVault();
                }
            } catch (e) { 
                console.error('Auto-save (seal) after add-file failed:', e); 
            }
            
            return { success: true, id: res && res.id };
        } catch (err) {
            console.error('add-file-to-vault error:', err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('export-file-from-vault', async (event, fileId) => {
        const handler = getCurrentSessionHandler();
        if (!handler) return { success: false, error: 'No open vault.' };
        
        try {
            const db = getCurrentDB();
            const fileRecord = await getFileById(fileId, db);
            
            if (!fileRecord) {
                return { success: false, error: 'File not found.' };
            }
            
            const fileManager = handler.fileManager;
            const exportPath = await fileManager.exportFileFromVault(
                fileRecord.stored_filename,
                fileRecord.original_name
            );
            
            if (!exportPath) {
                return { success: false, error: 'Export cancelled.' };
            }
            
            return { success: true, exportPath };
        } catch (err) {
            console.error('export-file-from-vault error:', err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('delete-file-from-vault', async (event, fileId) => {
        const handler = getCurrentSessionHandler();
        if (!handler) return { success: false, error: 'No open vault.' };
        
        try {
            const db = getCurrentDB();
            const fileRecord = await getFileById(fileId, db);
            
            if (!fileRecord) {
                return { success: false, error: 'File not found.' };
            }
            
            // Delete physical file
            const fileManager = handler.fileManager;
            fileManager.deleteFileFromVault(fileRecord.stored_filename);
            
            // Delete database record
            const res = await deleteFile(fileId, db);
            
            // Auto-save vault
            try { 
                if (handler && handler.sealVault) {
                    await handler.sealVault();
                }
            } catch (e) { 
                console.error('Auto-save (seal) after delete-file failed:', e); 
            }
            
            return { success: true, changes: res && res.changes };
        } catch (err) {
            console.error('delete-file-from-vault error:', err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('get-files-data', async () => {
        const db = getCurrentDB();
        if (!db) return [];
        try {
            return await getFiles(db);
        } catch (err) {
            console.error('get-files-data error:', err);
            return [];
        }
    });

    ipcMain.handle('get-files-count', async () => {
        const db = getCurrentDB();
        if (!db) return 0;
        try {
            return await getFilesCount(db);
        } catch (err) {
            console.error('get-files-count error:', err);
            return 0;
        }
    });
    
    console.log('File IPC handlers registered successfully');
}

module.exports = { registerFileIpcHandlers };