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

    function openAddModal(entityType) {
        const modal = new bootstrap.Modal(document.getElementById('addModal'));
        document.getElementById('addTitle').textContent = `Add new ${entityType}`;
        document.getElementById('addType').value = entityType;
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

    // Plus buttons in headers
    document.querySelectorAll('.add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const entityType = e.currentTarget.dataset.type; // password | file | gpg
            openAddModal(entityType);
        });
    });

    // Submit modal
    document.getElementById('addSubmit').addEventListener('click', async () => {
        const entityType = document.getElementById('addType').value; // password | file | gpg
        const name = document.getElementById('addName').value;
        // Build payload depending on type
        let payload;
        if (entityType === 'password') {
            const label = name; // treat main input as Label
            const group = document.getElementById('addGroup').value || null;
            const address = document.getElementById('addAddress').value || null;
            const username = document.getElementById('addUsername').value || null;
            const pwd = document.getElementById('addValue').value;
            if (!label || !pwd) { alert('Label and Password are required.'); return; }
            payload = { type: 'password', label, group, address, username, password: pwd };
        } else {
            const value = document.getElementById('addValue').value;
            if (!name || !value) { alert('Please fill all required fields.'); return; }
            payload = { type: entityType, name, value };
        }
        const response = await window.api.addItem(payload);  // IPC do backend
        if (response && response.success) {
            bootstrap.Modal.getInstance(document.getElementById('addModal')).hide();
            // After adding, reload current tab based on entityType -> tab id
            const tabId = Object.keys(typeMeta).find(k => typeMeta[k].singular === entityType) || 'passwords';
            loadData(tabId);
        } else {
            alert((response && response.error) || 'Operation failed');
        }
    });

    async function loadData(tabId) {
        const body = document.getElementById(`${tabId}-body`);
        const data = await window.api.getData(tabId); // expects: passwords | files | gpg
        if (!data || data.length === 0) {
            const meta = typeMeta[tabId];
            const colspan = tabId === 'passwords' ? 5 : 2;
            body.innerHTML = `
                <tr>
                    <td colspan="${colspan}" class="text-center">
                        <div class="alert alert-light text-muted mb-0" role="alert" style="border: 1px dashed #ced4da;">
                            <div class="fw-semibold">${meta.emptyTitle}</div>
                            <small>${meta.emptyDesc}</small>
                        </div>
                    </td>
                </tr>`;
        } else {
            body.innerHTML = '';
            if (tabId === 'passwords') {
                data.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${item.label || ''}</td>
                        <td>${item.group_name || ''}</td>
                        <td>${item.address || ''}</td>
                        <td>${item.username || ''}</td>
                        <td>${item.password || ''}</td>`;
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