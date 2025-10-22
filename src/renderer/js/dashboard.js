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
document.addEventListener('DOMContentLoaded', () => {
    const tabs = new bootstrap.Tab(document.querySelector('#dashboardTabs a:first-child'));  // Init tabs

    // Load data on tab show
    document.querySelectorAll('.nav-link').forEach(tab => {
        tab.addEventListener('shown.bs.tab', (e) => {
            const type = e.target.getAttribute('href').slice(1);  // passwords/files/gpg
            loadData(type);
        });
    });

    // Plusik - open modal
    document.querySelectorAll('.add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.target.dataset.type;
            const modal = new bootstrap.Modal(document.getElementById('addModal'));
            document.getElementById('addTitle').textContent = `Dodaj nowy ${type}`;
            document.getElementById('addType').value = type;
            const extra = document.getElementById('addExtra');
            extra.innerHTML = '';
            if (type === 'password') {
                extra.innerHTML = '<label for="addValue" class="form-label">Hasło</label><input type="password" class="form-control" id="addValue" required>';
            } else if (type === 'file') {
                extra.innerHTML = '<label for="addValue" class="form-label">Ścieżka pliku</label><input type="file" class="form-control" id="addValue" required>';
            } else if (type === 'gpg') {
                extra.innerHTML = '<label for="addValue" class="form-label">Klucz</label><input type="text" class="form-control" id="addValue" required>';
            }
            modal.show();
        });
    });

    // Submit modal
    document.getElementById('addSubmit').addEventListener('click', async () => {
        const type = document.getElementById('addType').value;
        const name = document.getElementById('addName').value;
        const value = document.getElementById('addValue').value;
        if (name && value) {
            const response = await window.api.addItem({ type, name, value });  // IPC do backend
            if (response.success) {
                bootstrap.Modal.getInstance(document.getElementById('addModal')).hide();
                loadData(type);
            } else {
                alert(response.error);
            }
        }
    });

    async function loadData(type) {
        const body = document.getElementById(`${type}-body`);
        const data = await window.api.getData(type);  // IPC do backend, np. getPasswords
        if (data.length === 0) {
            body.innerHTML = '<tr><td colspan="3" class="text-center">Nie masz dodanych ' + type + '.<br><button class="btn btn-primary mt-2 add-btn" data-type="' + type + '">Dodaj nowy</button></td></tr>';
        } else {
            body.innerHTML = '';
            data.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${item.name}</td><td>${item.value}</td><td></td>`;
                body.appendChild(tr);
            });
        }
    }

    // Init first tab
    loadData('passwords');
});