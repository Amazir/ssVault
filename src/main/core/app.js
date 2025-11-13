const { BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1270,
        height: 720,
        show: false, // show after ready-to-show to avoid initial UI freeze
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
    // Tip: uncomment to debug startup performance
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
    return mainWindow;
}

/*

TODO: ogarnac grupy do haseł, ogarnac sortowanie, ogarnac wielkosc GUI pierwszego okna, ogarnac kod czytelnosc
 */

module.exports = { createWindow };