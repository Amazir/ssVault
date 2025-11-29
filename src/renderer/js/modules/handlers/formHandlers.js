import { typeMeta } from '../utils.js';
import { loadData, loadCounts } from '../dataLoader.js';

// Setup form submit handler
export function setupFormHandlers() {
    document.getElementById('addSubmit').addEventListener('click', async () => {
        const entityType = document.getElementById('addType').value;
        const editId = document.getElementById('editId').value;
        const name = document.getElementById('addName').value;

        let payload;
        let response;

        if (entityType === 'password') {
            const label = name;
            const group = document.getElementById('addGroup').value || null;
            const address = document.getElementById('addAddress').value || null;
            const username = document.getElementById('addUsername').value || null;
            const pwd = document.getElementById('addValue').value;

            if (!label || !pwd) {
                alert('Label and Password are required.');
                return;
            }

            if (editId) {
                payload = { id: Number(editId), label, group, address, username, password: pwd };
                response = await window.api.updatePassword(payload);
            } else {
                payload = { type: 'password', label, group, address, username, password: pwd };
                response = await window.api.addItem(payload);
            }
        } else if (entityType === 'file') {
            response = await window.api.addFileToVault();
        } else {
            const value = document.getElementById('addValue').value;
            if (!name || !value) {
                alert('Please fill all required fields.');
                return;
            }
            payload = { type: entityType, name, value };
            response = await window.api.addItem(payload);
        }

        if (response && response.success) {
            bootstrap.Modal.getInstance(document.getElementById('addModal')).hide();
            const tabId = Object.keys(typeMeta).find(k => typeMeta[k].singular === entityType) || 'passwords';
            await loadData(tabId);
            await loadCounts();
        } else {
            alert((response && response.error) || 'Operation failed');
        }
    });
}
