import { byId } from './utils.js';

let passwordGeneratorTargetInputId = null;

export function generatePassword(length, includeUpper, includeLower, includeNumbers, includeSymbols) {
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

export function calculatePasswordStrength(password) {
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

export function openPasswordGeneratorModal(targetInputId) {
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

export function regeneratePasswordInModal() {
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

export function setupPasswordGeneratorListeners() {
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
            bootstrap.Modal.getInstance(document.getElementById('passwordGeneratorModal'))?.hide();
        }
    });
}

export function getPasswordGeneratorTargetInputId() {
    return passwordGeneratorTargetInputId;
}
