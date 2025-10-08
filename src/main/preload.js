const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getVaults: () => ipcRenderer.invoke('get-vaults'),
    createVault: (data) => ipcRenderer.invoke('create-vault', data),
    importVault: () => ipcRenderer.invoke('import-vault'),
    openVault: (data) => ipcRenderer.invoke('open-vault', data),
    loadDashboard: () => ipcRenderer.send('load-dashboard'),
    removeVault: (path) => ipcRenderer.invoke('remove-vault', path)
});