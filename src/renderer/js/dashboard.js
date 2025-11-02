// Custom tab handling supports dropdown items acting as tabs
function setupTabs() {
    const tabLinks = document.querySelectorAll('#dashboardTabs .nav-link[href^="#"]');
    tabLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('href');
            // Activate visual state in tabs (leave dropdown toggle as active always)
            document.querySelectorAll('#dashboardTabs .nav-link').forEach(l => l.classList.remove('active'));
            // Keep the dropdown toggle marked active
            const ddToggle = document.getElementById('passwordsDropdown');
            if (ddToggle) ddToggle.classList.add('active');
            link.classList.add('active');
            // Show tab content
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            const pane = document.querySelector(target);
            if (pane) pane.classList.add('active');
            // Load data for shown tab
            const tabId = target.slice(1);
            if (['passwords','files','gpg','groups'].includes(tabId)) {
                loadData(tabId);
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Small helpers to keep code terse
    const qs = (sel, root = document) => root.querySelector(sel);
    const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const byId = (id) => document.getElementById(id);
    const getTemplate = (id) => byId(id).content.firstElementChild;

    // Setup our custom tabs (supports dropdown)
    setupTabs();

    // Map tab ids to singular entity types and messages
    const typeMeta = {
        passwords: { singular: 'password', emptyTitle: 'No passwords yet', emptyDesc: 'Use the button below to add your first password.' },
        files: { singular: 'file', emptyTitle: 'No files yet', emptyDesc: 'Use the button below to add your first file.' },
        gpg: { singular: 'gpg', emptyTitle: 'No GPG keys yet', emptyDesc: 'Use the button below to add your first GPG key.' },
        groups: { singular: 'group', emptyTitle: 'No groups yet', emptyDesc: 'Use the button below to add your first group.' }
    };

    const passwordItems = new Map();

    async function loadVaultName() {
        try {
            const name = await window.api.getVaultName();
            const el = byId('vaultName');
            if (el) el.textContent = name || '';
        } catch (_) {}
    }

    async function loadCounts() {
        try {
            const c = await window.api.getCounts();
            byId('countPasswords').textContent = c.passwords ?? 0;
            byId('countFiles').textContent = c.files ?? 0;
            byId('countGpg').textContent = c.gpg ?? 0;
        } catch (_) {
            byId('countPasswords').textContent = '0';
            byId('countFiles').textContent = '0';
            byId('countGpg').textContent = '0';
        }
    }

    function openAddModal(entityType) {
        const modal = new bootstrap.Modal(document.getElementById('addModal'));
        document.getElementById('addTitle').textContent = `Add new ${entityType}`;
        document.getElementById('addType').value = entityType;
        document.getElementById('editId').value = '';
        // reset common inputs
        document.getElementById('addName').value = '';
        const extra = document.getElementById('addExtra');
        extra.innerHTML = '';
        if (entityType === 'password') {
            // Adjust main label to "Label" for passwords
            document.querySelector("label[for='addName']").textContent = 'Label';
            extra.innerHTML = `
                <div class="mb-3">
                    <label for="addGroup" class="form-label">Group</label>
                    <input type="text" class="form-control" id="addGroup" placeholder="e.g. Banking">
                </div>
                <div class="mb-3">
                    <label for="addAddress" class="form-label">Address</label>
                    <input type="text" class="form-control" id="addAddress" placeholder="https://... or App name">
                </div>
                <div class="mb-3">
                    <label for="addUsername" class="form-label">Username/E-Mail</label>
                    <input type="text" class="form-control" id="addUsername">
                </div>
                <div class="mb-3">
                    <label for="addValue" class="form-label">Password</label>
                    <input type="password" class="form-control" id="addValue" required>
                </div>`;
        } else if (entityType === 'file') {
            document.querySelector("label[for='addName']").textContent = 'Name';
            extra.innerHTML = '<label for="addValue" class="form-label">File path</label><input type="file" class="form-control" id="addValue" required>';
        } else if (entityType === 'gpg') {
            document.querySelector("label[for='addName']").textContent = 'Name';
            extra.innerHTML = '<label for="addValue" class="form-label">Key</label><input type="text" class="form-control" id="addValue" required>';
        }
        modal.show();
    }

    function openEditPasswordModal(item) {
        const modal = new bootstrap.Modal(document.getElementById('addModal'));
        document.getElementById('addTitle').textContent = 'Edit password';
        document.getElementById('addType').value = 'password';
        document.getElementById('editId').value = item.id;
        document.querySelector("label[for='addName']").textContent = 'Label';
        document.getElementById('addName').value = item.label || '';
        const extra = document.getElementById('addExtra');
        extra.innerHTML = `
            <div class="mb-3">
                <label for="addGroup" class="form-label">Group</label>
                <input type="text" class="form-control" id="addGroup" placeholder="e.g. Banking" value="${item.group_name || ''}">
            </div>
            <div class="mb-3">
                <label for="addAddress" class="form-label">Address</label>
                <input type="text" class="form-control" id="addAddress" placeholder="https://... or App name" value="${item.address || ''}">
            </div>
            <div class="mb-3">
                <label for="addUsername" class="form-label">Username/E-Mail</label>
                <input type="text" class="form-control" id="addUsername" value="${item.username || ''}">
            </div>
            <div class="mb-3">
                <label for="addValue" class="form-label">Password</label>
                <input type="password" class="form-control" id="addValue" value="${item.password || ''}" required>
            </div>`;
        modal.show();
    }

    // Plus buttons in headers
    document.querySelectorAll('.add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const entityType = e.currentTarget.dataset.type; // password | file | gpg
            openAddModal(entityType);
        });
    });

    // Actions in passwords table (edit/delete)
    document.getElementById('passwords-body').addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-password');
        const delBtn = e.target.closest('.delete-password');
        if (editBtn) {
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

    // Submit modal
    document.getElementById('addSubmit').addEventListener('click', async () => {
        const entityType = document.getElementById('addType').value; // password | file | gpg
        const editId = document.getElementById('editId').value;
        const name = document.getElementById('addName').value;
        // Build payload depending on type
        let payload;
        let response;
        if (entityType === 'password') {
            const label = name; // treat main input as Label
            const group = document.getElementById('addGroup').value || null;
            const address = document.getElementById('addAddress').value || null;
            const username = document.getElementById('addUsername').value || null;
            const pwd = document.getElementById('addValue').value;
            if (!label || !pwd) { alert('Label and Password are required.'); return; }
            if (editId) {
                payload = { id: Number(editId), label, group, address, username, password: pwd };
                response = await window.api.updatePassword(payload);
            } else {
                payload = { type: 'password', label, group, address, username, password: pwd };
                response = await window.api.addItem(payload);
            }
        } else {
            const value = document.getElementById('addValue').value;
            if (!name || !value) { alert('Please fill all required fields.'); return; }
            payload = { type: entityType, name, value };
            response = await window.api.addItem(payload);
        }
        if (response && response.success) {
            bootstrap.Modal.getInstance(document.getElementById('addModal')).hide();
            // After adding/updating, reload current tab based on entityType -> tab id
            const tabId = Object.keys(typeMeta).find(k => typeMeta[k].singular === entityType) || 'passwords';
            await loadData(tabId);
            await loadCounts();
        } else {
            alert((response && response.error) || 'Operation failed');
        }
    });

    function renderEmptyState(tabId, body) {
        const meta = typeMeta[tabId];
        const colspan = tabId === 'passwords' ? 6 : 2;
        body.innerHTML = `
            <tr>
                <td colspan="${colspan}" class="text-center">
                    <div class="alert alert-light text-muted mb-0" role="alert" style="border: 1px dashed #ced4da;">
                        <div class="fw-semibold">${meta.emptyTitle}</div>
                        <small>${meta.emptyDesc}</small>
                    </div>
                </td>
            </tr>`;
    }

    async function loadData(tabId) {
        const body = document.getElementById(`${tabId}-body`);
        if (tabId === 'groups') {
            const groups = await window.api.getGroups();
            if (!groups || groups.length === 0) {
                // Custom empty state for groups
                body.innerHTML = `
                    <tr>
                        <td colspan="2" class="text-center">
                            <div class="alert alert-light text-muted mb-0" role="alert" style="border: 1px dashed #ced4da;">
                                <div class="fw-semibold">No groups yet</div>
                                <small>Use the button below to add your first group.</small>
                            </div>
                        </td>
                    </tr>`;
            } else {
                body.innerHTML = '';
                groups.forEach(g => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${g.name}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-danger delete-group" data-id="${g.id}"><i class="bi bi-trash"></i></button>
                        </td>`;
                    body.appendChild(tr);
                });
            }
            return;
        }

        const data = await window.api.getData(tabId); // expects: passwords | files | gpg
        if (!data || data.length === 0) {
            renderEmptyState(tabId, body);
        } else {
            body.innerHTML = '';
            if (tabId === 'passwords') {
                passwordItems.clear();
                const rowTpl = getTemplate('password-row-template');
                data.forEach(item => {
                    passwordItems.set(item.id, item);
                    const tr = rowTpl.cloneNode(true);
                    qs('.cell-label', tr).textContent = item.label || '';
                    qs('.cell-group', tr).textContent = item.group_name || '';
                    qs('.cell-address', tr).textContent = item.address || '';
                    qs('.cell-username', tr).textContent = item.username || '';
                    qs('.cell-password', tr).textContent = item.password || '';
                    qs('.edit-password', tr).dataset.id = item.id;
                    qs('.delete-password', tr).dataset.id = item.id;
                    body.appendChild(tr);
                });
            } else {
                data.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td>${item.name}</td><td>${item.value}</td>`;
                    body.appendChild(tr);
                });
            }
        }
    }

    // Groups actions
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

    // Initial load
    loadVaultName();
    loadCounts();
    loadData('passwords');
});