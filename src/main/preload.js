const { contextBridge, ipcRenderer } = require('electron');

/*
	Preload is using contextBridge to pass data from Electron backend core to frontend GUI.
*/

contextBridge.exposeInMainWorld('api', {
    getVaults: () => ipcRenderer.invoke('get-vaults'),
    createVault: (data) => ipcRenderer.invoke('create-vault', data),
    importVault: () => ipcRenderer.invoke('import-vault'),
    openVault: (data) => ipcRenderer.invoke('open-vault', data),
    loadDashboard: () => ipcRenderer.send('load-dashboard'),
    removeVault: (path) => ipcRenderer.invoke('remove-vault', path),
    // Dashboard IPC
    getData: (tabId) => ipcRenderer.invoke('get-data', tabId),
    addItem: (payload) => ipcRenderer.invoke('add-item', payload),
    updatePassword: (payload) => ipcRenderer.invoke('update-password', payload),
    deletePassword: (id) => ipcRenderer.invoke('delete-password', id),
    manualSave: () => ipcRenderer.invoke('manual-save')
});