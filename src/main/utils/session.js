let currentVaultPath = null;
let currentMasterPass = null;
let currentHandler = null;

function setCurrentSession(path, pass, handler) {
    currentVaultPath = path;
    currentMasterPass = pass;
    currentHandler = handler;
}

function getCurrentSessionHandler() {
    return currentHandler;
}

function clearSession() {
    currentVaultPath = null;
    currentMasterPass = null;
    currentHandler = null;
}

function getCurrentVaultPath() {
    return currentVaultPath;
}

module.exports = { setCurrentSession, getCurrentVaultPath, getCurrentSessionHandler, clearSession };