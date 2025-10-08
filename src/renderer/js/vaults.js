async function loadVaults() {
    if (!window.api || typeof window.api.getVaults !== 'function') {
        console.error('API getVaults not available');
        return;
    }
    const vaults = await window.api.getVaults();
    const list = document.getElementById('vaultList');
    list.innerHTML = '';
    vaults.forEach(v => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td>${v.name}</td>
      <td>${v.path}</td>
      <td>
        <button class="btn btn-sm btn-success openBtn" data-path="${v.path}">Otwórz</button>
        <button class="btn btn-sm btn-danger removeBtn" data-path="${v.path}">Usuń</button>
      </td>`;
        list.appendChild(tr);
    });
}

// Create - użyj modal zamiast prompt
document.getElementById('createSubmit').addEventListener('click', async () => {
    const name = document.getElementById('vaultName').value;
    const password = document.getElementById('vaultPassword').value;
    if (name && password) {
        const response = await window.api.createVault({ name, password });
        if (response.success) {
            bootstrap.Modal.getInstance(document.getElementById('createModal')).hide();
            loadVaults();
        } else {
            alert(response.error);
        }
    }
});

// Import
document.getElementById('importBtn').addEventListener('click', async () => {
    const response = await window.api.importVault();
    if (response.success) loadVaults();
});

// Open i remove (jak wcześniej)
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('openBtn')) {
        const path = e.target.dataset.path;
        const password = prompt('Master password dla sejfu:');  // Tu nadal prompt - zmień na modal jeśli chcesz
        if (password) {
            const response = await window.api.openVault({ path, password });
            if (response.success) window.api.loadDashboard();
            else alert(response.error);
        }
    } else if (e.target.classList.contains('removeBtn')) {
        const path = e.target.dataset.path;
        if (confirm('Usunąć z listy?')) {
            await window.api.removeVault(path);
            loadVaults();
        }
    }
});

loadVaults();