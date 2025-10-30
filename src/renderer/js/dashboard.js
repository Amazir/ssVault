const tabs = document.querySelectorAll('.nav-link');
tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        e.preventDefault();
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        document.querySelector(tab.getAttribute('href')).classList.add('active');
    });
});

document.addEventListener('DOMContentLoaded', () => {
    // Small helpers to keep code terse
    const qs = (sel, root = document) => root.querySelector(sel);
    const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const byId = (id) => document.getElementById(id);
    const getTemplate = (id) => byId(id).content.firstElementChild;

    // Init tabs (show first)
    new bootstrap.Tab(document.querySelector('#dashboardTabs a:first-child'));

    // Map tab ids to singular entity types and messages
    const typeMeta = {
        passwords: { singular: 'password', emptyTitle: 'No passwords yet', emptyDesc: 'Use the button below to add your first password.' },
        files: { singular: 'file', emptyTitle: 'No files yet', emptyDesc: 'Use the button below to add your first file.' },
        gpg: { singular: 'gpg', emptyTitle: 'No GPG keys yet', emptyDesc: 'Use the button below to add your first GPG key.' }
    };

    // Load data on tab show
    document.querySelectorAll('.nav-link').forEach(tab => {
        tab.addEventListener('shown.bs.tab', (e) => {
            const tabId = e.target.getAttribute('href').slice(1); // passwords | files | gpg
            loadData(tabId);
        });
    });

    const passwordItems = new Map();

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
                        loadData('passwords');
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
            loadData(tabId);
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


    // Init first tab
    loadData('passwords');
});