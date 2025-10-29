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
        <button class="btn btn-sm btn-success openBtn" data-path="${v.path}">Open</button>
        <button class="btn btn-sm btn-danger removeBtn" data-path="${v.path}">Remove</button>
      </td>`;
        list.appendChild(tr);
    });
}

// Create new vault form
document.getElementById('createSubmit').addEventListener('click', async () => {
    
    // Get name and password values from HTML
    const name = document.getElementById('vaultName').value;
    const password = document.getElementById('vaultPassword').value;
    
    // Check if name and password are provided
    if (name && password) {
        
        // Try to create vault (init authentication)
        const response = await window.api.createVault({ name, password });
        
        // If password matches the vault, if not throw error
        if (response.success) {
            bootstrap.Modal.getInstance(document.getElementById('createModal')).hide();
            loadVaults();
        } else
            alert(response.error);
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
        
        // Get vault path
        const path = e.target.dataset.path;
        
        // Create and show modal from Bootstrap
        const openModal = new bootstrap.Modal(document.getElementById('openModal'));
        openModal.show();

        // Create hidden input with vault path
        let pathInput = document.getElementById('openPath');
        if (!pathInput) {
            pathInput = document.createElement('input');
            pathInput.type = 'hidden';
            pathInput.id = 'openPath';
            document.getElementById('openForm').appendChild(pathInput);
        }
        pathInput.value = path;

        // Get submit button from html and init handler for submit
        const submitBtn = document.getElementById('openSubmit');
        const submitHandler = async () => {
            
            // Get vaults password and path
            const password = document.getElementById('openPassword').value;
            const path = document.getElementById('openPath').value;
            
            // If user provided password
            if (password) {
                
                // Authenticate 
                const response = await window.api.openVault({ vaultPath: path, password });
                
                // If auth is successfull then open dashboard, else throw the error
                if (response.success)
                    window.api.loadDashboard();
                else 
                    alert(response.error);
            }
            
            // Hide vault opener modal
            openModal.hide();
            
            // Clean up event listener
            submitBtn.removeEventListener('click', submitHandler); 
        };
        submitBtn.addEventListener('click', submitHandler);
    } else if (e.target.classList.contains('removeBtn')) {
        // TODO: Handling removing vaults
    }
});

loadVaults();