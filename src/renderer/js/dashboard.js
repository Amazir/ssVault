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
            extra.innerHTML = '<label for="addValue" class="form-label">Password</label><input type="password" class="form-control" id="addValue" required>';
        } else if (entityType === 'file') {
            extra.innerHTML = '<label for="addValue" class="form-label">File path</label><input type="file" class="form-control" id="addValue" required>';
        } else if (entityType === 'gpg') {
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
        const value = document.getElementById('addValue').value;
        if (name && value) {
            const response = await window.api.addItem({ type: entityType, name, value });  // IPC do backend
            if (response.success) {
                bootstrap.Modal.getInstance(document.getElementById('addModal')).hide();
                // After adding, reload current tab based on entityType -> tab id
                const tabId = Object.keys(typeMeta).find(k => typeMeta[k].singular === entityType) || 'passwords';
                loadData(tabId);
            } else {
                alert(response.error);
            }
        }
    });

    async function loadData(tabId) {
        const body = document.getElementById(`${tabId}-body`);
        const data = await window.api.getData(tabId); // expects: passwords | files | gpg
        if (!data || data.length === 0) {
            const meta = typeMeta[tabId];
            const addLabel = meta.singular === 'gpg' ? 'GPG key' : meta.singular;
            body.innerHTML = `
                <tr>
                    <td colspan="2" class="text-center">
                        <div class="alert alert-light text-muted mb-2" role="alert" style="border: 1px dashed #ced4da;">
                            <div class="fw-semibold">${meta.emptyTitle}</div>
                            <small>${meta.emptyDesc}</small>
                        </div>
                        <button type="button" class="btn btn-outline-primary btn-sm js-add-btn" data-type="${meta.singular}">Add new ${addLabel}</button>
                    </td>
                </tr>`;
            // Bind click for the dynamically inserted button
            const addBtn = body.querySelector('.js-add-btn');
            if (addBtn) {
                addBtn.addEventListener('click', (e) => openAddModal(e.currentTarget.dataset.type));
            }
        } else {
            body.innerHTML = '';
            data.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${item.name}</td><td>${item.value}</td>`;
                body.appendChild(tr);
            });
        }
    }

    // Init first tab
    loadData('passwords');
});