import { passwordItems, loadData, loadCounts } from '../dataLoader.js';
import { openEditPasswordModal } from '../modals.js';

// Setup password event handlers
export function setupPasswordEventHandlers() {
    document.getElementById('passwords-body').addEventListener('click', async (e) => {
        const toggleBtn = e.target.closest('.toggle-password-visibility');
        const copyBtn = e.target.closest('.copy-password');
        const editBtn = e.target.closest('.edit-password');
        const delBtn = e.target.closest('.delete-password');

        if (toggleBtn) {
            const cell = toggleBtn.closest('.cell-password');
            const hiddenSpan = cell.querySelector('.password-hidden');
            const visibleSpan = cell.querySelector('.password-visible');
            const icon = toggleBtn.querySelector('i');

            if (hiddenSpan.style.display === 'none') {
                hiddenSpan.style.display = '';
                visibleSpan.style.display = 'none';
                icon.className = 'bi bi-eye';
            } else {
                hiddenSpan.style.display = 'none';
                visibleSpan.style.display = '';
                icon.className = 'bi bi-eye-slash';
            }
        } else if (copyBtn) {
            const password = copyBtn.dataset.password;
            if (password) {
                navigator.clipboard.writeText(password).then(() => {
                    alert('Password copied to clipboard!');
                }).catch(err => {
                    alert('Failed to copy: ' + err);
                });
            }
        } else if (editBtn) {
            const id = Number(editBtn.dataset.id);
            const item = passwordItems.get(id);
            if (item) openEditPasswordModal(item);
        } else if (delBtn) {
            const id = Number(delBtn.dataset.id);
            if (Number.isFinite(id)) {
                if (confirm('Delete this password?')) {
                    const res = await window.api.deletePassword(id);
                    if (res && res.success) {
                        await loadData('passwords');
                        await loadCounts();
                    } else {
                        alert((res && res.error) || 'Delete failed');
                    }
                }
            }
        }
    });
}
