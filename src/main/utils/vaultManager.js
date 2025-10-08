let ElectronStore;
try {
    ElectronStore = require('electron-store').default;  // Dodaj .default dla ESM
} catch (err) {
    console.error('Błąd electron-store:', err);
    ElectronStore = null;  // Fallback
}

class VaultManager {
    constructor() {
        this.store = new ElectronStore({
            name: 'app-vaults',  // Zmienione na bardziej specyficzne
            encryptionKey: 'your-secret-key'  // Dodaj własny klucz dla bezpieczeństwa config
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