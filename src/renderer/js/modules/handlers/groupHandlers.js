import { loadData } from '../dataLoader.js';

// Setup group event handlers
export function setupGroupEventHandlers() {
    // Add group button
    document.getElementById('addGroupBtn').addEventListener('click', async () => {
        const name = prompt('Group name');
        if (!name) return;
        const res = await window.api.addGroup(name.trim());
        if (res && res.success) {
            await loadData('groups');
        } else {
            alert((res && res.error) || 'Add group failed');
        }
    });

    // Delete group
    document.getElementById('groups-body').addEventListener('click', async (e) => {
        const btn = e.target.closest('.delete-group');
        if (!btn) return;
        const id = Number(btn.dataset.id);
        if (!Number.isFinite(id)) return;
        if (!confirm('Delete this group?')) return;
        const res = await window.api.deleteGroup(id);
        if (res && res.success) {
            await loadData('groups');
        } else {
            alert((res && res.error) || 'Delete group failed');
        }
    });
}
