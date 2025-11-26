const { BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1270,
        height: 720,
        show: false,
        backgroundColor: '#1e1e1e',
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, '../preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            sandbox: true
        }
    });

    mainWindow.loadFile(path.join(__dirname, '../../renderer/pages/vaults.html'));
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    return mainWindow;
}

module.exports = { createWindow };