import { byId, typeMeta, sortByKey, mapFileTypeFromName, qs, getTemplate } from './utils.js';

// Sort state for all tabs
export const sortState = {
    passwords: { key: 'label', dir: 'asc' },
    files: { key: 'name', dir: 'asc' },
    gpg: { key: 'name', dir: 'asc' },
    groups: { key: 'name', dir: 'asc' }
};

// Store password items for edit functionality
export const passwordItems = new Map();

// Render empty state
function renderEmptyState(tabId, body) {
    const meta = typeMeta[tabId];
    const colspan = tabId === 'passwords' ? 6 : tabId === 'files' ? 5 : tabId === 'gpg' ? 4 : 2;
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

// Render functions
function renderPasswords(rows, body) {
    passwordItems.clear();
    const rowTpl = getTemplate('password-row-template');
    rows.forEach(item => {
        passwordItems.set(item.id, item);
        const tr = rowTpl.cloneNode(true);
        qs('.cell-label', tr).textContent = item.label || '';
        qs('.cell-group', tr).textContent = item.group_name || '';
        qs('.cell-address', tr).textContent = item.address || '';
        qs('.cell-username', tr).textContent = item.username || '';
        qs('.password-visible', tr).textContent = item.password || '';
        qs('.copy-password', tr).dataset.password = item.password || '';
        qs('.edit-password', tr).dataset.id = item.id;
        qs('.delete-password', tr).dataset.id = item.id;
        body.appendChild(tr);
    });
}

function renderFiles(rows, body) {
    rows.forEach(item => {
        const displayName = item._displayName;
        const type = item._type;
        const sizeKB = item._size ? Math.round(item._size / 1024) : 0;
        const addedDate = item._added ? new Date(item._added).toLocaleDateString() : '';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${displayName}</td>
            <td>${type}</td>
            <td>${sizeKB} KB</td>
            <td>${addedDate}</td>
            <td>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-primary export-file" data-id="${item.id}" title="Export file">
                        <i class="bi bi-download"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-file" data-id="${item.id}" title="Delete file">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>`;
        body.appendChild(tr);
    });
}

function renderGpg(rows, body) {
    rows.forEach(item => {
        const tr = document.createElement('tr');
        const typeDisplay = item.value === 'private' ? 'Private Key' : item.value === 'public' ? 'Public Key' : item.value || 'Key';
        const userId = item.user_id || '-';
        tr.innerHTML = `
            <td>${item.name}</td>
            <td>${userId}</td>
            <td>${typeDisplay}</td>
            <td>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-primary export-gpg" data-id="${item.id}" title="Export key">
                        <i class="bi bi-download"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-gpg" data-id="${item.id}" title="Delete key">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>`;
        body.appendChild(tr);
    });
}

function renderGroups(rows, body) {
    rows.forEach(g => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${g.name}</td>
            <td>
                <button class="btn btn-sm btn-outline-danger delete-group" data-id="${g.id}">
                    <i class="bi bi-trash"></i>
                </button>
            </td>`;
        body.appendChild(tr);
    });
}

// Main load data function
export async function loadData(tabId, keepSort = true) {
    const body = document.getElementById(`${tabId}-body`);

    // Special handling for groups
    if (tabId === 'groups') {
        const groups = await window.api.getGroups();
        if (!groups || groups.length === 0) {
            renderEmptyState(tabId, body);
        } else {
            body.innerHTML = '';
            renderGroups(groups, body);
        }
        return;
    }

    // Load data based on tab type
    let data;
    if (tabId === 'passwords') {
        data = await window.api.getData(tabId);
    } else if (tabId === 'files') {
        data = await window.api.getFilesData();
    } else if (tabId === 'gpg') {
        data = await window.api.getData('gpg');
    } else {
        data = await window.api.getData(tabId);
    }

    if (!data || data.length === 0) {
        renderEmptyState(tabId, body);
        return;
    }

    let rows = [...data];

    // Prepare and sort data
    if (tabId === 'files') {
        rows = rows.map(f => ({
            ...f,
            _displayName: f.name || f.original_name || f.stored_filename || '',
            _type: f.type || mapFileTypeFromName(f.name || f.original_name || ''),
            _size: f.size || 0,
            _added: f.added_date || ''
        }));

        const state = sortState.files;
        if (keepSort && state.key) {
            const keyMap = { name: '_displayName', type: '_type', size: '_size', added: '_added', added_date: '_added' };
            rows = sortByKey(rows, keyMap[state.key] || '_displayName', state.dir);
        }
    } else {
        const state = sortState[tabId];
        if (keepSort && state?.key) {
            rows = sortByKey(rows, state.key, state.dir);
        }
    }

    // Render
    body.innerHTML = '';
    if (tabId === 'passwords') renderPasswords(rows, body);
    else if (tabId === 'files') renderFiles(rows, body);
    else if (tabId === 'gpg') renderGpg(rows, body);
}

// Load vault name
export async function loadVaultName() {
    try {
        const name = await window.api.getVaultName();
        const el = byId('vaultName');
        if (el) el.textContent = name || '';
    } catch (_) {}
}

// Load counts
export async function loadCounts() {
    try {
        const c = await window.api.getCounts();
        const filesCount = await window.api.getFilesCount().catch(() => 0);

        byId('countPasswords').textContent = c.passwords ?? 0;
        byId('countFiles').textContent = filesCount;
        byId('countGpg').textContent = c.gpg ?? 0;
    } catch (_) {
        byId('countPasswords').textContent = '0';
        byId('countFiles').textContent = '0';
        byId('countGpg').textContent = '0';
    }
}

// Load groups into select
export async function loadGroupsIntoSelect(selectedGroup = '') {
    try {
        const groups = await window.api.getGroups();
        const select = document.getElementById('addGroup');
        if (!select) return;
        select.innerHTML = '<option value="">Default</option>';
        if (groups && groups.length > 0) {
            groups.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g.name;
                opt.textContent = g.name;
                if (g.name === selectedGroup) opt.selected = true;
                select.appendChild(opt);
            });
        }
    } catch (err) {
        console.error('Failed to load groups:', err);
    }
}
