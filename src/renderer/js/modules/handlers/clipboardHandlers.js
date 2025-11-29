import { byId } from '../utils.js';

let clipboardKeys = [];

// Update clipboard buttons based on selected key type
function updateClipboardButtons() {
    const select = byId('clipboardKeySelect');
    const selectedOption = select.options[select.selectedIndex];
    const keyType = selectedOption?.dataset?.type || '';

    byId('clipboardEncryptBtn').disabled = keyType !== 'public';
    byId('clipboardDecryptBtn').disabled = keyType !== 'private';
}

// Setup clipboard modal handlers
export function setupClipboardHandlers() {
    const openClipboardBtn = byId('openClipboardBtn');
    if (openClipboardBtn) {
        openClipboardBtn.addEventListener('click', async () => {
            const modal = new bootstrap.Modal(byId('clipboardModal'));

            const select = byId('clipboardKeySelect');
            select.innerHTML = '<option value="">-- Select a key --</option>';
            try {
                clipboardKeys = await window.api.getData('gpg') || [];
                if (clipboardKeys.length > 0) {
                    clipboardKeys.forEach(k => {
                        const opt = document.createElement('option');
                        opt.value = k.id;
                        const typeLabel = k.value === 'private' ? '[Private]' : k.value === 'public' ? '[Public]' : '';
                        opt.textContent = `${k.name} ${typeLabel}`;
                        opt.dataset.type = k.value;
                        select.appendChild(opt);
                    });
                }
            } catch (err) {
                console.error('Failed to load GPG keys for clipboard:', err);
            }

            byId('clipboardInput').value = '';
            byId('clipboardOutput').value = '';

            updateClipboardButtons();
            modal.show();
        });
    }

    // Key select change
    const clipboardKeySelect = byId('clipboardKeySelect');
    if (clipboardKeySelect) {
        clipboardKeySelect.addEventListener('change', updateClipboardButtons);
    }

    // Encrypt button
    const clipboardEncryptBtn = byId('clipboardEncryptBtn');
    if (clipboardEncryptBtn) {
        clipboardEncryptBtn.addEventListener('click', async () => {
            const text = byId('clipboardInput').value;
            const keyId = Number(byId('clipboardKeySelect').value);

            if (!text) {
                alert('Please enter text to encrypt.');
                return;
            }
            if (!keyId) {
                alert('Please select a public key.');
                return;
            }

            clipboardEncryptBtn.disabled = true;
            clipboardEncryptBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Encrypting...';

            try {
                const res = await window.api.gpgEncrypt({ text, keyId });
                if (res && res.success) {
                    byId('clipboardOutput').value = res.result;
                } else {
                    alert((res && res.error) || 'Encryption failed.');
                }
            } catch (err) {
                alert('Error: ' + (err.message || err));
            } finally {
                clipboardEncryptBtn.innerHTML = '<i class="bi bi-lock"></i> Encrypt';
                updateClipboardButtons();
            }
        });
    }

    // Decrypt button
    const clipboardDecryptBtn = byId('clipboardDecryptBtn');
    if (clipboardDecryptBtn) {
        clipboardDecryptBtn.addEventListener('click', async () => {
            const text = byId('clipboardInput').value;
            const keyId = Number(byId('clipboardKeySelect').value);

            if (!text) {
                alert('Please enter encrypted text to decrypt.');
                return;
            }
            if (!keyId) {
                alert('Please select a private key.');
                return;
            }

            clipboardDecryptBtn.disabled = true;
            clipboardDecryptBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Decrypting...';

            try {
                const res = await window.api.gpgDecrypt({ text, keyId });
                if (res && res.success) {
                    byId('clipboardOutput').value = res.result;
                } else {
                    alert((res && res.error) || 'Decryption failed.');
                }
            } catch (err) {
                alert('Error: ' + (err.message || err));
            } finally {
                clipboardDecryptBtn.innerHTML = '<i class="bi bi-unlock"></i> Decrypt';
                updateClipboardButtons();
            }
        });
    }

    // Copy button
    const clipboardCopyBtn = byId('clipboardCopyBtn');
    if (clipboardCopyBtn) {
        clipboardCopyBtn.addEventListener('click', () => {
            const output = byId('clipboardOutput').value;
            if (output) {
                navigator.clipboard.writeText(output).then(() => {
                    alert('Copied to clipboard!');
                }).catch(err => {
                    alert('Failed to copy: ' + err);
                });
            } else {
                alert('Nothing to copy.');
            }
        });
    }

    // Clear button
    const clipboardClearBtn = byId('clipboardClearBtn');
    if (clipboardClearBtn) {
        clipboardClearBtn.addEventListener('click', () => {
            byId('clipboardInput').value = '';
            byId('clipboardOutput').value = '';
        });
    }
}
