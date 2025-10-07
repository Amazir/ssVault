document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const masterPassword = document.getElementById('masterPassword').value;
    const isFirstTime = document.getElementById('isFirstTime').checked;
    const response = await window.api.login({ masterPassword, isFirstTime });
    if (response.success) {
        window.api.loadDashboard(); // Przejdź do dashboard
    } else {
        document.getElementById('error').textContent = response.error || 'Błąd logowania';
    }
});