// Aktywuj Bootstrap tabs (bez jQuery, pure JS)
const tabs = document.querySelectorAll('.nav-link');
tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        e.preventDefault();
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        document.querySelector(tab.getAttribute('href')).classList.add('active');
    });
});

// Tu dodasz IPC calls, np. window.api.getPasswords() później