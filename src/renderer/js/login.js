document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const masterPassword = document.getElementById('masterPassword').value;
    const isFirstTime = document.getElementById('isFirstTime').checked;
    const response = await window.api.login({ masterPassword, isFirstTime });
    if (response.success) {
        window.api.loadDashboard();
    } else {
        document.getElementById('error').textContent = response.error || 'Login error';
    }
});