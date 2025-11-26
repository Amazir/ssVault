function mapFileTypeFromName(filename = '') {
    const lower = filename.toLowerCase();

    if (/\.(png|jpe?g|gif|webp|bmp|tiff?|svg|heic|heif|ico)$/.test(lower)) return 'Image';
    if (/\.(mp4|m4v|mkv|mov|avi|wmv|flv|webm|mpeg|mpg|3gp)$/.test(lower)) return 'Video';
    if (/\.(mp3|wav|flac|aac|ogg|m4a|wma|opus)$/.test(lower)) return 'Audio';
    if (/\.(zip|rar|7z|tar|gz|bz2|xz|tgz|iso|dmg)$/.test(lower)) return 'Archive';
    if (/\.(txt|md|rtf|log)$/.test(lower)) return 'Text';
    if (/\.(pdf)$/.test(lower)) return 'PDF';
    if (/\.(docx?|odt|rtf)$/.test(lower)) return 'Document';
    if (/\.(xlsx?|ods|csv|tsv)$/.test(lower)) return 'Spreadsheet';
    if (/\.(pptx?|odp)$/.test(lower)) return 'Presentation';
    if (/\.(js|ts|jsx|tsx|java|c|cpp|cs|go|rs|py|php|rb|swift|kt|sql|html|css|json|yml|yaml|xml|ini|cfg|env)$/.test(lower)) return 'Code/Config';
    if (/\.(db|sqlite|sqlite3|bak|bin|dat)$/.test(lower)) return 'Data';
    return 'Other';
}

document.addEventListener('DOMContentLoaded', () => {
    const qs = (sel, root = document) => root.querySelector(sel);
    const byId = (id) => document.getElementById(id);
    const getTemplate = (id) => byId(id).content.firstElementChild;

    const typeMeta = {
        passwords: { singular: 'password', emptyTitle: 'No passwords yet', emptyDesc: 'Use the button below to add your first password.' },
        files: { singular: 'file', emptyTitle: 'No files yet', emptyDesc: 'Use the button below to add your first file.' },
        gpg: { singular: 'gpg', emptyTitle: 'No GPG keys yet', emptyDesc: 'Use the button below to add your first GPG key.' },
        groups: { singular: 'group', emptyTitle: 'No groups yet', emptyDesc: 'Use the button below to add your first group.' }
    };

    const passwordItems = new Map();

    function sortByKey(data, key, dir = 'asc') {
        const factor = dir === 'asc' ? 1 : -1;
        return [...data].sort((a, b) => {
            let va = a[key];
            let vb = b[key];

            if (typeof va === 'number' && typeof vb === 'number') {
                return (va - vb) * factor;
            }

            va = (va ?? '').toString().toLowerCase();
            vb = (vb ?? '').toString().toLowerCase();
            if (va < vb) return -1 * factor;
            if (va > vb) return 1 * factor;
            return 0;
        });
    }

    const sortState = {
        passwords: { key: 'label', dir: 'asc' },
        files: { key: 'name', dir: 'asc' },
        gpg: { key: 'name', dir: 'asc' },
        groups: { key: 'name', dir: 'asc' }
    };

    function renderEmptyState(tabId, body) {
        const meta = typeMeta[tabId];
        const colspan =
            tabId === 'passwords'
                ? 6
                : tabId === 'files'
                    ? 5
                    : tabId === 'gpg'
                        ? 4
                        : 2;
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

    async function loadData(tabId, keepSort = true) {
        const body = document.getElementById(`${tabId}-body`);
        if (tabId === 'groups') {
            const groups = await window.api.getGroups();
            if (!groups || groups.length === 0) {
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

        if (tabId === 'files') {
            rows = rows.map(f => {
                const displayName = f.name || f.original_name || f.stored_filename || '';
                const type = f.type || mapFileTypeFromName(displayName);
                const size = f.size || 0;
                const added = f.added_date || '';
                return {
                    ...f,
                    _displayName: displayName,
                    _type: type,
                    _size: size,
                    _added: added
                };
            });

            const state = sortState.files;
            if (keepSort && state.key) {
                const keyMap = {
                    name: '_displayName',
                    type: '_type',
                    size: '_size',
                    added: '_added',
                    added_date: '_added'
                };
                const sortKey = keyMap[state.key] || '_displayName';
                rows = sortByKey(rows, sortKey, state.dir);
            }
        } else if (tabId === 'passwords') {
            const state = sortState.passwords;
            if (keepSort && state.key) {
                rows = sortByKey(rows, state.key, state.dir);
            }
        } else if (tabId === 'gpg') {
            const state = sortState.gpg;
            if (keepSort && state.key) {
                rows = sortByKey(rows, state.key, state.dir);
            }
        } else if (tabId === 'groups') {
            const state = sortState.groups;
            if (keepSort && state.key) {
                rows = sortByKey(rows, state.key, state.dir);
            }
        }

        // Render
        body.innerHTML = '';

        if (tabId === 'passwords') {
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
        } else if (tabId === 'files') {
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
        } else if (tabId === 'gpg') {
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
        } else if (tabId === 'groups') {
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
    }

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
    async function loadGroupsIntoSelect(selectedGroup = '') {
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

    function generatePassword(length, includeUpper, includeLower, includeNumbers, includeSymbols) {
        const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lower = 'abcdefghijklmnopqrstuvwxyz';
        const numbers = '0123456789';
        const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
        
        let charset = '';
        if (includeUpper) charset += upper;
        if (includeLower) charset += lower;
        if (includeNumbers) charset += numbers;
        if (includeSymbols) charset += symbols;
        
        if (!charset) return '';
        
        let password = '';
        const array = new Uint32Array(length);
        crypto.getRandomValues(array);
        for (let i = 0; i < length; i++) {
            password += charset[array[i] % charset.length];
        }
        return password;
    }

    function calculatePasswordStrength(password) {
        let score = 0;
        if (!password) return { score: 0, text: 'No password', color: '#dc3545' };
        
        if (password.length >= 8) score += 20;
        if (password.length >= 12) score += 20;
        if (password.length >= 16) score += 10;
        if (/[a-z]/.test(password)) score += 10;
        if (/[A-Z]/.test(password)) score += 10;
        if (/[0-9]/.test(password)) score += 10;
        if (/[^a-zA-Z0-9]/.test(password)) score += 20;
        
        if (score <= 30) return { score: 30, text: 'Weak', color: '#dc3545' };
        if (score <= 60) return { score: 60, text: 'Medium', color: '#ffc107' };
        if (score <= 80) return { score: 80, text: 'Strong', color: '#28a745' };
        return { score: 100, text: 'Very Strong', color: '#28a745' };
    }

    let passwordGeneratorTargetInputId = null;

    function openPasswordGeneratorModal(targetInputId) {
        passwordGeneratorTargetInputId = targetInputId;
        const modal = new bootstrap.Modal(document.getElementById('passwordGeneratorModal'));
        const length = 16;
        byId('passwordLength').value = length;
        byId('passwordLengthValue').textContent = length;
        byId('includeUppercase').checked = true;
        byId('includeLowercase').checked = true;
        byId('includeNumbers').checked = true;
        byId('includeSymbols').checked = true;
        regeneratePasswordInModal();
        modal.show();
    }

    function regeneratePasswordInModal() {
        const length = parseInt(byId('passwordLength').value, 10);
        const includeUpper = byId('includeUppercase').checked;
        const includeLower = byId('includeLowercase').checked;
        const includeNumbers = byId('includeNumbers').checked;
        const includeSymbols = byId('includeSymbols').checked;
        
        const password = generatePassword(length, includeUpper, includeLower, includeNumbers, includeSymbols);
        byId('generatedPassword').value = password;
        
        const strength = calculatePasswordStrength(password);
        const bar = byId('passwordStrengthBar');
        bar.style.width = strength.score + '%';
        bar.style.backgroundColor = strength.color;
        bar.textContent = strength.text;
        byId('passwordStrengthText').textContent = strength.text;
    }


    function openAddModal(entityType) {
        const modal = new bootstrap.Modal(document.getElementById('addModal'));
        document.getElementById('addTitle').textContent = `Add new ${entityType}`;
        document.getElementById('addType').value = entityType;
        document.getElementById('editId').value = '';
        document.getElementById('addName').value = '';
        const extra = document.getElementById('addExtra');
        extra.innerHTML = '';

        if (entityType === 'password') {
            document.querySelector("label[for='addName']").textContent = 'Label';
            extra.innerHTML = `
                <div class="mb-3">
                    <label for="addGroup" class="form-label">Group</label>
                    <select class="form-select" id="addGroup">
                        <option value="">Default</option>
                    </select>
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
                    <div class="input-group">
                        <input type="password" class="form-control" id="addValue" required>
                        <button class="btn btn-outline-secondary" type="button" id="togglePasswordVisibility">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-outline-primary" type="button" id="generatePasswordBtn">Generate</button>
                    </div>
                </div>`;
            loadGroupsIntoSelect();
            setTimeout(() => {
                const toggleBtn = document.getElementById('togglePasswordVisibility');
                if (toggleBtn) {
                    toggleBtn.addEventListener('click', () => {
                        const pwdInput = document.getElementById('addValue');
                        const icon = toggleBtn.querySelector('i');
                        if (pwdInput.type === 'password') {
                            pwdInput.type = 'text';
                            icon.className = 'bi bi-eye-slash';
                        } else {
                            pwdInput.type = 'password';
                            icon.className = 'bi bi-eye';
                        }
                    });
                }
                const genBtn = document.getElementById('generatePasswordBtn');
                if (genBtn) {
                    genBtn.addEventListener('click', () => openPasswordGeneratorModal('addValue'));
                }
            }, 0);
        } else if (entityType === 'file') {
            document.querySelector("label[for='addName']").textContent = 'File name (optional)';
            extra.innerHTML = `
                <div class="alert alert-info">
                    <small><strong>Note:</strong> Click "Add" to select a file. You'll be asked whether to copy or move the file to the vault.</small>
                </div>`;
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
                <select class="form-select" id="addGroup">
                    <option value="">Default</option>
                </select>
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
                <div class="input-group">
                    <input type="password" class="form-control" id="addValue" value="${item.password || ''}" required>
                    <button class="btn btn-outline-secondary" type="button" id="togglePasswordVisibility">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-outline-primary" type="button" id="generatePasswordBtn">Generate</button>
                </div>
            </div>`;
        loadGroupsIntoSelect(item.group_name);
        setTimeout(() => {
            const toggleBtn = document.getElementById('togglePasswordVisibility');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    const pwdInput = document.getElementById('addValue');
                    const icon = toggleBtn.querySelector('i');
                    if (pwdInput.type === 'password') {
                        pwdInput.type = 'text';
                        icon.className = 'bi bi-eye-slash';
                    } else {
                        pwdInput.type = 'password';
                        icon.className = 'bi bi-eye';
                    }
                });
            }
            const genBtn = document.getElementById('generatePasswordBtn');
            if (genBtn) {
                genBtn.addEventListener('click', () => openPasswordGeneratorModal('addValue'));
            }
        }, 0);
        modal.show();
    }

    function setupTabs() {
        const tabLinks = document.querySelectorAll('#dashboardTabs .nav-link[href^="#"]');
        tabLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = link.getAttribute('href');

                if (!target || target === '#') return;

                document.querySelectorAll('#dashboardTabs .nav-link').forEach(l => l.classList.remove('active'));

                // Don't highlight dropdown toggle when inside dropdown is selected
                const ddToggle = document.getElementById('passwordsDropdown');
                if (target === '#passwords' || target === '#groups') {
                    if (ddToggle) ddToggle.classList.add('active');
                }
                link.classList.add('active');

                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                const pane = document.querySelector(target);
                if (pane) pane.classList.add('active');

                const tabId = target.slice(1);
                if (['passwords','files','gpg','groups'].includes(tabId)) {
                    loadData(tabId);
                }
            });
        });
    }

    setupTabs();

    document.querySelectorAll('.quick-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.currentTarget.dataset.tab;
            if (tab === 'passwords') {
                document.querySelector('a[href="#passwords"]').click();
                setTimeout(() => openAddModal('password'), 100);
            } else if (tab === 'files') {
                document.querySelector('a[href="#files"]').click();
                setTimeout(async () => {
                    const res = await window.api.addFileToVault();
                    if (res && res.success) {
                        await loadData('files');
                        await loadCounts();
                    }
                }, 100);
            } else if (tab === 'gpg') {
                // Switch to GPG tab and open generate modal
                document.querySelector('a[href="#gpg"]').click();
                setTimeout(() => {
                    const modal = new bootstrap.Modal(byId('generateGpgModal'));
                    byId('gpgKeyName').value = '';
                    byId('gpgUserName').value = '';
                    byId('gpgEmail').value = '';
                    byId('gpgExpiration').value = '0';
                    modal.show();
                }, 100);
            }
        });
    });

    document.querySelectorAll('.add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const entityType = e.currentTarget.dataset.type; // password | file | gpg
            openAddModal(entityType);
        });
    });

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

    document.getElementById('addSubmit').addEventListener('click', async () => {
        const entityType = document.getElementById('addType').value; // password | file | gpg
        const editId = document.getElementById('editId').value;
        const name = document.getElementById('addName').value;

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
        } else if (entityType === 'file') {
            response = await window.api.addFileToVault();
        } else {
            const value = document.getElementById('addValue').value;
            if (!name || !value) { alert('Please fill all required fields.'); return; }
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

    // GPG Keys - Generate new key pair
    const generateGpgBtn = byId('generateGpgBtn');
    if (generateGpgBtn) {
        generateGpgBtn.addEventListener('click', () => {
            const modal = new bootstrap.Modal(byId('generateGpgModal'));
            byId('gpgKeyName').value = '';
            byId('gpgUserName').value = '';
            byId('gpgEmail').value = '';
            byId('gpgExpiration').value = '0';
            modal.show();
        });
    }

    // GPG Keys - Generate submit
    const generateGpgSubmit = byId('generateGpgSubmit');
    if (generateGpgSubmit) {
        generateGpgSubmit.addEventListener('click', async () => {
            const keyName = byId('gpgKeyName').value.trim();
            const userName = byId('gpgUserName').value.trim();
            const email = byId('gpgEmail').value.trim();
            const expirationDays = parseInt(byId('gpgExpiration').value, 10) || 0;

            if (!keyName) {
                alert('Please enter a key pair name.');
                return;
            }
            if (!userName) {
                alert('Please enter your name.');
                return;
            }

            generateGpgSubmit.disabled = true;
            generateGpgSubmit.textContent = 'Generating...';

            try {
                const res = await window.api.generateGpgKeypair({
                    name: keyName,
                    userName,
                    email: email || undefined,
                    expirationDays
                });
                if (res && res.success) {
                    bootstrap.Modal.getInstance(byId('generateGpgModal')).hide();
                    await loadData('gpg');
                    await loadCounts();
                    alert('GPG key pair generated successfully!');
                } else {
                    alert((res && res.error) || 'Failed to generate key pair.');
                }
            } catch (err) {
                alert('Error: ' + (err.message || err));
            } finally {
                generateGpgSubmit.disabled = false;
                generateGpgSubmit.textContent = 'Generate';
            }
        });
    }

    // GPG Keys - Delete key and Export key
    byId('gpg-body').addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.delete-gpg');
        const exportBtn = e.target.closest('.export-gpg');
        if (deleteBtn) {
            const id = Number(deleteBtn.dataset.id);
            if (Number.isFinite(id)) {
                if (confirm('Delete this GPG key? This action cannot be undone.')) {
                    const res = await window.api.deleteGpgKey(id);
                    if (res && res.success) {
                        await loadData('gpg');
                        await loadCounts();
                    } else {
                        alert((res && res.error) || 'Delete failed');
                    }
                }
            }
        } else if (exportBtn) {
            const id = Number(exportBtn.dataset.id);
            if (Number.isFinite(id)) {
                const res = await window.api.exportGpgKey(id);
                if (res && res.success) {
                    alert(`Key exported to: ${res.exportPath}`);
                } else {
                    alert((res && res.error) || 'Export failed');
                }
            }
        }
    });

    // GPG Keys - Import key from file
    const importGpgBtn = byId('importGpgBtn');
    if (importGpgBtn) {
        importGpgBtn.addEventListener('click', async () => {
            const res = await window.api.importGpgKeyFromFile();
            if (res && res.success) {
                await loadData('gpg');
                await loadCounts();
                alert('GPG key imported successfully!');
            } else if (res && res.error && res.error !== 'No file selected.') {
                alert((res && res.error) || 'Import failed');
            }
        });
    }

    // Clipboard modal
    let clipboardKeys = [];
    const openClipboardBtn = byId('openClipboardBtn');
    if (openClipboardBtn) {
        openClipboardBtn.addEventListener('click', async () => {
            const modal = new bootstrap.Modal(byId('clipboardModal'));
            // Load GPG keys for select
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
            // Clear fields
            byId('clipboardInput').value = '';
            byId('clipboardOutput').value = '';
            // Update button states
            updateClipboardButtons();
            modal.show();
        });
    }

    // Update clipboard buttons based on selected key type
    function updateClipboardButtons() {
        const select = byId('clipboardKeySelect');
        const selectedOption = select.options[select.selectedIndex];
        const keyType = selectedOption?.dataset?.type || '';
        
        byId('clipboardEncryptBtn').disabled = keyType !== 'public';
        byId('clipboardDecryptBtn').disabled = keyType !== 'private';
    }

    // Key select change handler
    const clipboardKeySelect = byId('clipboardKeySelect');
    if (clipboardKeySelect) {
        clipboardKeySelect.addEventListener('change', updateClipboardButtons);
    }

    // Clipboard - Encrypt
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

    // Clipboard - Decrypt
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

    // Clipboard - Copy output
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

    // Clipboard - Clear
    const clipboardClearBtn = byId('clipboardClearBtn');
    if (clipboardClearBtn) {
        clipboardClearBtn.addEventListener('click', () => {
            byId('clipboardInput').value = '';
            byId('clipboardOutput').value = '';
        });
    }

    document.querySelectorAll('th[data-sort-key]').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
            const key = th.getAttribute('data-sort-key');
            const activePane = document.querySelector('.tab-pane.active');
            if (!activePane) return;
            const tabId = activePane.id;

            const state = sortState[tabId];
            if (!state) return;

            const nextDir =
                state.key === key
                    ? (state.dir === 'asc' ? 'desc' : 'asc')
                    : 'asc';

            sortState[tabId] = { key, dir: nextDir };
            loadData(tabId, true);
        });
    });

    byId('passwordLength')?.addEventListener('input', (e) => {
        byId('passwordLengthValue').textContent = e.target.value;
        regeneratePasswordInModal();
    });

    byId('includeUppercase')?.addEventListener('change', regeneratePasswordInModal);
    byId('includeLowercase')?.addEventListener('change', regeneratePasswordInModal);
    byId('includeNumbers')?.addEventListener('change', regeneratePasswordInModal);
    byId('includeSymbols')?.addEventListener('change', regeneratePasswordInModal);

    byId('regeneratePassword')?.addEventListener('click', regeneratePasswordInModal);

    byId('copyGeneratedPassword')?.addEventListener('click', () => {
        const pwd = byId('generatedPassword').value;
        if (pwd) {
            navigator.clipboard.writeText(pwd).then(() => {
                alert('Password copied to clipboard!');
            }).catch(err => {
                alert('Failed to copy: ' + err);
            });
        }
    });

    byId('useGeneratedPassword')?.addEventListener('click', () => {
        const pwd = byId('generatedPassword').value;
        if (pwd && passwordGeneratorTargetInputId) {
            const targetInput = document.getElementById(passwordGeneratorTargetInputId);
            if (targetInput) {
                targetInput.value = pwd;
            }
        }
        bootstrap.Modal.getInstance(document.getElementById('passwordGeneratorModal'))?.hide();
    });

    loadVaultName();
    loadCounts();
    loadData('passwords');
    loadData('files');
});
