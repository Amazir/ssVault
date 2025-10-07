const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const { initDB, setDBKey } = require('./utils/db');
const auth = require('./utils/auth');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, '../main/preload.js'),
            nodeIntegration: false,
            contextIsolation: true, 
        },
        icon: path.join(__dirname, '../../assets/icon.png'), 
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/pages/login.html')); // Start z login.html
    initDB();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

ipcMain.handle('login', async (event, { masterPassword, isFirstTime }) => {
    if (isFirstTime) {
        // Ustaw nowe master password (np. przy pierwszej instalacji)
        await auth.setMasterPassword(masterPassword);
        setDBKey(masterPassword); // Odszyfruj/szyfruj DB
        return { success: true };
    } else {
        const isValid = await auth.validateMasterPassword(masterPassword);
        if (isValid) {
            setDBKey(masterPassword);
            return { success: true };
        }
        return { success: false, error: 'Nieprawidłowe hasło' };
    }
});

ipcMain.on('load-dashboard', () => {
    mainWindow.loadFile(path.join(__dirname, '../renderer/pages/dashboard.html'));
});