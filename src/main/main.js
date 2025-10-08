const { app, BrowserWindow, ipcMain, dialog } = require('electron');  // Dodaj dialog do wyboru plików
const path = require('path');
const VaultManager = require('./utils/vaultManager');
const { openVaultDB, closeCurrentDB } = require('./utils/db');
const { setMasterPasswordForVault, validateMasterPasswordForVault } = require('./utils/auth');

const vaultMgr = new VaultManager();  // Inicjuj
console.log('VaultManager instancja:', vaultMgr);

let mainWindow;

// Creating an Electron window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            sandbox: true
        }
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/pages/vaults.html'));  // Start z listą sejfów
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    closeCurrentDB();
    if (process.platform !== 'darwin') app.quit();
});

// IPC dla sejfów
ipcMain.handle('get-vaults', () => {
    try {
        return vaultMgr.getVaults();
    } catch (err) {
        console.error('Błąd get-vaults:', err);
        return [];  // Fallback pustej listy
    }
});

ipcMain.handle('create-vault', async (event, { name, password }) => {
    try {
        const { filePath } = await dialog.showSaveDialog({ defaultPath: `${name}.vault.db` });
        if (!filePath) return { error: 'Anulowano' };
        openVaultDB(filePath, password);  // Teraz inicjuje tabele
        await setMasterPasswordForVault(password);  // Tylko INSERT
        vaultMgr.addVault(name, filePath);
        closeCurrentDB();
        return { success: true };
    } catch (err) {
        console.error('Błąd tworzenia sejfu:', err);
        closeCurrentDB();
        return { error: 'Błąd tworzenia: ' + err.message };
    }
});

ipcMain.handle('import-vault', async () => {
    const { filePaths } = await dialog.showOpenDialog({ filters: [{ name: 'Vaults', extensions: ['vault.db'] }] });
    if (!filePaths || !filePaths[0]) return { error: 'Anulowano' };
    const path = filePaths[0];
    const name = path.basename(path, '.vault.db');
    addVault(name, path);
    return { success: true };
});

ipcMain.handle('open-vault', async (event, { path, password }) => {
    try {
        openVaultDB(path, password);
        const isValid = await validateMasterPasswordForVault(password);
        if (!isValid) {
            closeCurrentDB();
            return { error: 'Nieprawidłowe hasło' };
        }
        return { success: true };
    } catch (err) {
        closeCurrentDB();
        return { error: err.message };
    }
});

ipcMain.on('load-dashboard', () => {
    mainWindow.loadFile(path.join(__dirname, '../renderer/pages/dashboard.html'));
});

// IPC dla haseł itd. (jak wcześniej, używaj getCurrentDB())