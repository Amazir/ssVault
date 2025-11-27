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
        <button class="btn btn-sm btn-success openBtn" data-path="${v.path}">Open</button>
        <button class="btn btn-sm btn-danger removeBtn" data-path="${v.path}">Remove</button>
      </td>`;
        list.appendChild(tr);
    });
}

document.getElementById('createSubmit').addEventListener('click', async () => {
    
    const name = document.getElementById('vaultName').value;
    const password = document.getElementById('vaultPassword').value;
    
    if (name && password) {
        
        const response = await window.api.createVault({ name, password });
        
        if (response.success) {
            bootstrap.Modal.getInstance(document.getElementById('createModal')).hide();
            loadVaults();
        } else
            alert(response.error);
    }
});


document.getElementById('importBtn').addEventListener('click', async () => {
    const response = await window.api.importVault();
    if (response.success) loadVaults();
});

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('openBtn')) {
        
        const path = e.target.dataset.path;
        
        const openModal = new bootstrap.Modal(document.getElementById('openModal'));
        openModal.show();

        let pathInput = document.getElementById('openPath');
        if (!pathInput) {
            pathInput = document.createElement('input');
            pathInput.type = 'hidden';
            pathInput.id = 'openPath';
            document.getElementById('openForm').appendChild(pathInput);
        }
        pathInput.value = path;

        const form = document.getElementById('openForm');
        const formHandler = (e) => {
            e.preventDefault();
            submitHandler();
        };
        form.addEventListener('submit', formHandler);

        const submitBtn = document.getElementById('openSubmit');
        const submitHandler = async () => {
            
            const password = document.getElementById('openPassword').value;
            const path = document.getElementById('openPath').value;
            
            if (password) {
                
                const response = await window.api.openVault({ vaultPath: path, password });
                
                if (response.success)
                    window.api.loadDashboard();
                else 
                    alert(response.error);
            }
            
            openModal.hide();
            
            submitBtn.removeEventListener('click', submitHandler);
            form.removeEventListener('submit', formHandler);
        };
        submitBtn.addEventListener('click', submitHandler);
    } else if (e.target.classList.contains('removeBtn')) {
    }
});

loadVaults();
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

function regeneratePasswordInModal() {
    const length = parseInt(document.getElementById('passwordLength').value, 10);
    const includeUpper = document.getElementById('includeUppercase').checked;
    const includeLower = document.getElementById('includeLowercase').checked;
    const includeNumbers = document.getElementById('includeNumbers').checked;
    const includeSymbols = document.getElementById('includeSymbols').checked;
    
    const password = generatePassword(length, includeUpper, includeLower, includeNumbers, includeSymbols);
    document.getElementById('generatedPassword').value = password;
    
    const strength = calculatePasswordStrength(password);
    const bar = document.getElementById('passwordStrengthBar');
    bar.style.width = strength.score + '%';
    bar.style.backgroundColor = strength.color;
    bar.textContent = strength.text;
    document.getElementById('passwordStrengthText').textContent = strength.text;
}

document.addEventListener('DOMContentLoaded', () => {
    const toggleVaultPasswordBtn = document.getElementById('toggleVaultPassword');
    if (toggleVaultPasswordBtn) {
        toggleVaultPasswordBtn.addEventListener('click', () => {
            const pwdInput = document.getElementById('vaultPassword');
            const icon = toggleVaultPasswordBtn.querySelector('i');
            if (pwdInput.type === 'password') {
                pwdInput.type = 'text';
                icon.className = 'bi bi-eye-slash';
            } else {
                pwdInput.type = 'password';
                icon.className = 'bi bi-eye';
            }
        });
    }

    const toggleOpenPasswordBtn = document.getElementById('toggleOpenPassword');
    if (toggleOpenPasswordBtn) {
        toggleOpenPasswordBtn.addEventListener('click', () => {
            const pwdInput = document.getElementById('openPassword');
            const icon = toggleOpenPasswordBtn.querySelector('i');
            if (pwdInput.type === 'password') {
                pwdInput.type = 'text';
                icon.className = 'bi bi-eye-slash';
            } else {
                pwdInput.type = 'password';
                icon.className = 'bi bi-eye';
            }
        });
    }

    const generateVaultPasswordBtn = document.getElementById('generateVaultPassword');
    if (generateVaultPasswordBtn) {
        generateVaultPasswordBtn.addEventListener('click', () => {
            const modalEl = document.getElementById('passwordGeneratorModal');
            if (!modalEl) {
                console.error('Password generator modal not found');
                return;
            }
            const modal = new bootstrap.Modal(modalEl);
            const length = 16;
            document.getElementById('passwordLength').value = length;
            document.getElementById('passwordLengthValue').textContent = length;
            document.getElementById('includeUppercase').checked = true;
            document.getElementById('includeLowercase').checked = true;
            document.getElementById('includeNumbers').checked = true;
            document.getElementById('includeSymbols').checked = true;
            regeneratePasswordInModal();
            modal.show();
        });
    }

    document.getElementById('passwordLength')?.addEventListener('input', (e) => {
        document.getElementById('passwordLengthValue').textContent = e.target.value;
        regeneratePasswordInModal();
    });

    document.getElementById('includeUppercase')?.addEventListener('change', regeneratePasswordInModal);
    document.getElementById('includeLowercase')?.addEventListener('change', regeneratePasswordInModal);
    document.getElementById('includeNumbers')?.addEventListener('change', regeneratePasswordInModal);
    document.getElementById('includeSymbols')?.addEventListener('change', regeneratePasswordInModal);

    document.getElementById('regeneratePassword')?.addEventListener('click', regeneratePasswordInModal);

    document.getElementById('copyGeneratedPassword')?.addEventListener('click', () => {
        const pwd = document.getElementById('generatedPassword').value;
        if (pwd) {
            navigator.clipboard.writeText(pwd).then(() => {
                alert('Password copied to clipboard!');
            }).catch(err => {
                alert('Failed to copy: ' + err);
            });
        }
    });

    document.getElementById('useGeneratedPassword')?.addEventListener('click', () => {
        const pwd = document.getElementById('generatedPassword').value;
        if (pwd) {
            const targetInput = document.getElementById('vaultPassword');
            if (targetInput) {
                targetInput.value = pwd;
            }
        }
        bootstrap.Modal.getInstance(document.getElementById('passwordGeneratorModal'))?.hide();
    });
});
