import { byId } from '../utils.js';
import { loadCounts, loadData } from '../dataLoader.js';
import { openGenerateGpgModal } from '../modals.js';

// Setup GPG event handlers
export function setupGpgEventHandlers() {
    // Generate GPG button
    const generateGpgBtn = byId('generateGpgBtn');
    if (generateGpgBtn) {
        generateGpgBtn.addEventListener('click', openGenerateGpgModal);
    }

    // Generate GPG submit
    const generateGpgSubmit = byId('generateGpgSubmit');
    if (generateGpgSubmit) {
        generateGpgSubmit.addEventListener('click', async () => {
            const keyName = byId('gpgKeyName').value.trim();
            const userName = byId('gpgUserName').value.trim();
            const email = byId('gpgEmail').value.trim();
            const expirationDays = parseInt(byId('gpgExpiration').value, 10) || 0;

            if (!keyName) {
                alert('Please enter a key pair name.');
                return;
            }
            if (!userName) {
                alert('Please enter your name.');
                return;
            }

            generateGpgSubmit.disabled = true;
            generateGpgSubmit.textContent = 'Generating...';

            try {
                const res = await window.api.generateGpgKeypair({
                    name: keyName,
                    userName,
                    email: email || undefined,
                    expirationDays
                });
                if (res && res.success) {
                    bootstrap.Modal.getInstance(byId('generateGpgModal')).hide();
                    await loadData('gpg');
                    await loadCounts();
                    alert('GPG key pair generated successfully!');
                } else {
                    alert((res && res.error) || 'Failed to generate key pair.');
                }
            } catch (err) {
                alert('Error: ' + (err.message || err));
            } finally {
                generateGpgSubmit.disabled = false;
                generateGpgSubmit.textContent = 'Generate';
            }
        });
    }

    // GPG table actions (delete, export)
    byId('gpg-body').addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.delete-gpg');
        const exportBtn = e.target.closest('.export-gpg');

        if (deleteBtn) {
            const id = Number(deleteBtn.dataset.id);
            if (Number.isFinite(id)) {
                if (confirm('Delete this GPG key? This action cannot be undone.')) {
                    const res = await window.api.deleteGpgKey(id);
                    if (res && res.success) {
                        await loadData('gpg');
                        await loadCounts();
                    } else {
                        alert((res && res.error) || 'Delete failed');
                    }
                }
            }
        } else if (exportBtn) {
            const id = Number(exportBtn.dataset.id);
            if (Number.isFinite(id)) {
                const res = await window.api.exportGpgKey(id);
                if (res && res.success) {
                    alert(`Key exported to: ${res.exportPath}`);
                } else {
                    alert((res && res.error) || 'Export failed');
                }
            }
        }
    });

    // Import GPG button
    const importGpgBtn = byId('importGpgBtn');
    if (importGpgBtn) {
        importGpgBtn.addEventListener('click', async () => {
            const res = await window.api.importGpgKeyFromFile();
            if (res && res.success) {
                await loadData('gpg');
                await loadCounts();
                alert('GPG key imported successfully!');
            } else if (res && res.error && res.error !== 'No file selected.') {
                alert((res && res.error) || 'Import failed');
            }
        });
    }
}
