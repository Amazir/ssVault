const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    login: (data) => ipcRenderer.invoke('login', data),
    loadDashboard: () => ipcRenderer.send('load-dashboard'),
});