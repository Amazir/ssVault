let ElectronStore;
try {
    ElectronStore = require('electron-store').default;
} catch (err) {
    console.error('electron-store error:', err);
    ElectronStore = null;
}

class VaultManager {
    constructor() {
        this.store = new ElectronStore({
            name: 'app-vaults',
            encryptionKey: 'your-secret-key'
        });
    }

    getVaults() {
        return this.store.get('vaults', []);
    }

    addVault(name, path) {
        const vaults = this.getVaults();
        vaults.push({ name, path });
        this.store.set('vaults', vaults);
    }

    removeVault(path) {
        let vaults = this.getVaults();
        vaults = vaults.filter(v => v.path !== path);
        this.store.set('vaults', vaults);
    }
}

module.exports = VaultManager;