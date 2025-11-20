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
    manualSave: () => ipcRenderer.invoke('manual-save'),
    // New dashboard helpers
    getCounts: () => ipcRenderer.invoke('get-counts'),
    getVaultName: () => ipcRenderer.invoke('get-vault-name'),
    getGroups: () => ipcRenderer.invoke('get-groups'),
    addGroup: (name) => ipcRenderer.invoke('add-group', name),
    deleteGroup: (id) => ipcRenderer.invoke('delete-group', id),
    // File operations
    addFileToVault: () => ipcRenderer.invoke('add-file-to-vault'),
    exportFileFromVault: (fileId) => ipcRenderer.invoke('export-file-from-vault', fileId),
    deleteFileFromVault: (fileId) => ipcRenderer.invoke('delete-file-from-vault', fileId),
    getFilesData: () => ipcRenderer.invoke('get-files-data'),
    getFilesCount: () => ipcRenderer.invoke('get-files-count'),
    // GPG operations
    generateGpgKeypair: (payload) => ipcRenderer.invoke('generate-gpg-keypair', payload),
    importGpgKeyFromFile: () => ipcRenderer.invoke('import-gpg-key-from-file'),
    deleteGpgKey: (id) => ipcRenderer.invoke('delete-gpg-key', id)
});