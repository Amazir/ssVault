let ElectronStore;
try {
    ElectronStore = require('electron-store').default;
} catch (err) {
    console.error('electron-store error:', err);
    ElectronStore = null;
}

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

class VaultManager {
    constructor() {
        
        this.store = new ElectronStore({
            name: 'app-vaults-v2',
            encryptionKey: this.getOrCreateEncryptionKey()
        });
    }

    getOrCreateEncryptionKey() {
        const keyPath = path.join(app.getPath('userData'), '.vault-manager-key');
        
        
        if (fs.existsSync(keyPath)) {
            try {
                const keyData = fs.readFileSync(keyPath);
                
                
                if (safeStorage.isEncryptionAvailable()) {
                    try {
                        
                        return safeStorage.decryptString(keyData);
                    } catch (decryptErr) {
                        
                        const plainKey = keyData.toString('utf8');
                        try {
                            const encryptedKey = safeStorage.encryptString(plainKey);
                            fs.writeFileSync(keyPath, encryptedKey);
                            console.log('Migrated encryption key to safeStorage format');
                            return plainKey;
                        } catch (migrateErr) {
                            
                            console.error('Key migration failed, regenerating:', migrateErr);
                            fs.unlinkSync(keyPath);
                        }
                    }
                } else {
                    
                    return keyData.toString('utf8');
                }
            } catch (err) {
                console.error('Error reading encryption key, deleting corrupted file:', err);
                try {
                    fs.unlinkSync(keyPath);
                } catch (_) {}
            }
        }
        
        
        const newKey = crypto.randomBytes(32).toString('hex');
        
        
        if (safeStorage.isEncryptionAvailable()) {
            try {
                const encryptedKey = safeStorage.encryptString(newKey);
                fs.writeFileSync(keyPath, encryptedKey);
                console.log('Created new encryption key with safeStorage');
            } catch (err) {
                console.error('Failed to save encrypted key, falling back to plain:', err);
                fs.writeFileSync(keyPath, newKey, 'utf8');
            }
        } else {
            console.warn('safeStorage not available, using unencrypted key storage');
            fs.writeFileSync(keyPath, newKey, 'utf8');
        }
        
        return newKey;
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