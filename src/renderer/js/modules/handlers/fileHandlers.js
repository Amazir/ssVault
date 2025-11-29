import { loadData, loadCounts } from '../dataLoader.js';

// Setup file event handlers
export function setupFileEventHandlers() {
    document.getElementById('files-body').addEventListener('click', async (e) => {
        const exportBtn = e.target.closest('.export-file');
        const deleteBtn = e.target.closest('.delete-file');

        if (exportBtn) {
            const id = Number(exportBtn.dataset.id);
            if (Number.isFinite(id)) {
                const res = await window.api.exportFileFromVault(id);
                if (res && res.success) {
                    alert(`File exported to: ${res.exportPath}`);
                } else {
                    alert((res && res.error) || 'Export failed');
                }
            }
        } else if (deleteBtn) {
            const id = Number(deleteBtn.dataset.id);
            if (Number.isFinite(id)) {
                if (confirm('Delete this file from vault? This action cannot be undone.')) {
                    const res = await window.api.deleteFileFromVault(id);
                    if (res && res.success) {
                        await loadData('files');
                        await loadCounts();
                    } else {
                        alert((res && res.error) || 'Delete failed');
                    }
                }
            }
        }
    });
}
