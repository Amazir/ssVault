import { loadVaultName, loadCounts, loadData } from './modules/dataLoader.js';
import { setupTabs, setupQuickActions, setupAddButtons } from './modules/handlers/tabHandlers.js';
import { setupPasswordEventHandlers } from './modules/handlers/passwordHandlers.js';
import { setupFileEventHandlers } from './modules/handlers/fileHandlers.js';
import { setupGpgEventHandlers } from './modules/handlers/gpgHandlers.js';
import { setupGroupEventHandlers } from './modules/handlers/groupHandlers.js';
import { setupClipboardHandlers } from './modules/handlers/clipboardHandlers.js';
import { setupFormHandlers } from './modules/handlers/formHandlers.js';
import { setupSortHandlers } from './modules/handlers/sortHandlers.js';
import { setupPasswordGeneratorListeners } from './modules/passwordGenerator.js';

document.addEventListener('DOMContentLoaded', () => {
    // Setup all event handlers
    setupTabs();
    setupQuickActions();
    setupAddButtons();
    setupPasswordEventHandlers();
    setupFileEventHandlers();
    setupGpgEventHandlers();
    setupGroupEventHandlers();
    setupClipboardHandlers();
    setupFormHandlers();
    setupSortHandlers();
    setupPasswordGeneratorListeners();

    // Load initial data
    loadVaultName();
    loadCounts();
    loadData('passwords');
    loadData('files');
});
