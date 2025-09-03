const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'), // Ścieżka do preload.js
            nodeIntegration: false, // Bezpieczeństwo
            contextIsolation: true, // Bezpieczeństwo
        },
        icon: path.join(__dirname, '../../assets/icon.png'), // Ikona aplikacji
    });

    win.loadFile(path.join(__dirname, '../renderer/index.html')); // Ścieżka do index.html
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