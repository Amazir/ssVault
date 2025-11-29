import { sortState, loadData } from '../dataLoader.js';

// Setup table sorting handlers
export function setupSortHandlers() {
    document.querySelectorAll('th[data-sort-key]').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
            const key = th.getAttribute('data-sort-key');
            const activePane = document.querySelector('.tab-pane.active');
            if (!activePane) return;

            const tabId = activePane.id;
            const state = sortState[tabId];
            if (!state) return;

            const nextDir = state.key === key ? (state.dir === 'asc' ? 'desc' : 'asc') : 'asc';
            sortState[tabId] = { key, dir: nextDir };
            loadData(tabId, true);
        });
    });
}
