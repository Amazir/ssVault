import { loadCounts, loadData } from '../dataLoader.js';
import { openAddModal, openGenerateGpgModal } from '../modals.js';

// Setup tabs navigation
export function setupTabs() {
    const tabLinks = document.querySelectorAll('#dashboardTabs .nav-link[href^="#"]');
    tabLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('href');

            if (!target || target === '#') return;

            document.querySelectorAll('#dashboardTabs .nav-link').forEach(l => l.classList.remove('active'));

            // Handle dropdown toggle active state
            const ddToggle = document.getElementById('passwordsDropdown');
            if (target === '#passwords' || target === '#groups') {
                if (ddToggle) ddToggle.classList.add('active');
            }
            link.classList.add('active');

            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            const pane = document.querySelector(target);
            if (pane) pane.classList.add('active');

            const tabId = target.slice(1);
            if (['passwords','files','gpg','groups'].includes(tabId)) {
                loadData(tabId);
            }
        });
    });
}

// Setup quick action buttons
export function setupQuickActions() {
    document.querySelectorAll('.quick-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.currentTarget.dataset.tab;
            if (tab === 'passwords') {
                document.querySelector('a[href="#passwords"]').click();
                setTimeout(() => openAddModal('password'), 100);
            } else if (tab === 'files') {
                document.querySelector('a[href="#files"]').click();
                setTimeout(async () => {
                    const res = await window.api.addFileToVault();
                    if (res && res.success) {
                        await loadData('files');
                        await loadCounts();
                    }
                }, 100);
            } else if (tab === 'gpg') {
                document.querySelector('a[href="#gpg"]').click();
                setTimeout(() => openGenerateGpgModal(), 100);
            }
        });
    });
}

// Setup add buttons for each tab
export function setupAddButtons() {
    document.querySelectorAll('.add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const entityType = e.currentTarget.dataset.type;
            openAddModal(entityType);
        });
    });
}
