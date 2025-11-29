import { byId } from './utils.js';
import { loadGroupsIntoSelect } from './dataLoader.js';
import { openPasswordGeneratorModal } from './passwordGenerator.js';

// Open add/edit modal for different entity types
export function openAddModal(entityType) {
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
                <input type="text" class="form-control" id="addAddress" placeholder="https://example.com">
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
        setupPasswordFieldListeners();
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

// Open edit password modal
export function openEditPasswordModal(item) {
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
            <input type="text" class="form-control" id="addAddress" placeholder="https://example.com" value="${item.address || ''}">
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
    setupPasswordFieldListeners();
    modal.show();
}

// Setup password field toggle and generator listeners
function setupPasswordFieldListeners() {
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
}

// Open GPG generate modal
export function openGenerateGpgModal() {
    const modal = new bootstrap.Modal(byId('generateGpgModal'));
    byId('gpgKeyName').value = '';
    byId('gpgUserName').value = '';
    byId('gpgEmail').value = '';
    byId('gpgExpiration').value = '0';
    modal.show();
}
