// Get vaults from main process and insert into table
async function loadVaults() {
    if (!window.api || typeof window.api.getVaults !== 'function') {
        console.error('API getVaults not available');
        return;
    }

	// Get vaults from server
    const vaults = await window.api.getVaults();
    
    // Get vault list object from html and clear it
    const list = document.getElementById('vaultList');
    list.innerHTML = '';
    
    // Add table rows with functionality for ever vault user have imported
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

// Create new vault form
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


// Import vault
document.getElementById('importBtn').addEventListener('click', async () => {
    const response = await window.api.importVault();
    if (response.success) loadVaults();
});

// Open vault
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('openBtn')) {
        const path = e.target.dataset.path;
        // Trigger modal
        const openModal = new bootstrap.Modal(document.getElementById('openModal'));
        openModal.show();

        // Dodaj hidden input dla path (jeśli nie ma)
        let pathInput = document.getElementById('openPath');
        if (!pathInput) {
            pathInput = document.createElement('input');
            pathInput.type = 'hidden';
            pathInput.id = 'openPath';
            document.getElementById('openForm').appendChild(pathInput);
        }
        pathInput.value = path;

        // Listener na submit
        const submitBtn = document.getElementById('openSubmit');
        const submitHandler = async () => {
            const password = document.getElementById('openPassword').value;
            const path = document.getElementById('openPath').value;
            if (password) {
                const response = await window.api.openVault({ vaultPath: path, password });
                if (response.success) {
                    window.api.loadDashboard();
                } else {
                    alert(response.error);
                }
            }
            openModal.hide();
            submitBtn.removeEventListener('click', submitHandler);  // Clean up
        };
        submitBtn.addEventListener('click', submitHandler);
    } else if (e.target.classList.contains('removeBtn')) {
        // ... bez zmian
    }
});

loadVaults();