// Popup script for Kibana as Code

// State management
let currentSavedObject = null;
let currentTabId = null;

// Initialize debug toggle
async function initDebugToggle() {
  const debugToggle = document.getElementById('debug-mode-toggle');
  
  // Load current setting
  const result = await chrome.storage.local.get('debugModeEnabled');
  debugToggle.checked = result.debugModeEnabled || false;
  
  // Listen for changes
  debugToggle.addEventListener('change', async (e) => {
    await logger.setDebugEnabled(e.target.checked);
  });
}

// DOM elements
const states = {
  loading: document.getElementById('loading'),
  notDetected: document.getElementById('not-detected'),
  notExportable: document.getElementById('not-exportable'),
  detected: document.getElementById('detected'),
  exporting: document.getElementById('exporting'),
  success: document.getElementById('success'),
  error: document.getElementById('error'),
};

const elements = {
  objectTitle: document.getElementById('object-title'),
  objectType: document.getElementById('object-type'),
  objectId: document.getElementById('object-id'),
  exportBtn: document.getElementById('export-btn'),
  exploreBtn: document.getElementById('explore-btn'),
  retryBtn: document.getElementById('retry-btn'),
  successFilename: document.getElementById('success-filename'),
  errorMessage: document.getElementById('error-message'),
  neObjectTitle: document.getElementById('ne-object-title'),
  neObjectType: document.getElementById('ne-object-type'),
  neReason: document.getElementById('ne-reason'),
  neExploreBtn: document.getElementById('ne-explore-btn'),
  ndExploreBtn: document.getElementById('nd-explore-btn'),
};

/**
 * Show a specific state, hiding all others
 */
function showState(stateName) {
  Object.entries(states).forEach(([name, element]) => {
    if (name === stateName) {
      element.classList.remove('hidden');
    } else {
      element.classList.add('hidden');
    }
  });
}

/**
 * Inject content script and get saved object info
 */
async function getSavedObjectInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      showState('notDetected');
      return;
    }

    currentTabId = tab.id;

    // Inject content script programmatically (uses activeTab permission)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/content.js']
    });

    // Give script a moment to initialize, then query for info
    await new Promise(resolve => setTimeout(resolve, 100));

    // Send message to content script
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSavedObjectInfo' });
    
    if (response && response.isKibanaPage && response.savedObject) {
      currentSavedObject = response.savedObject;
      
      // Check if this type is not exportable
      if (response.savedObject.notExportable) {
        elements.neObjectTitle.textContent = response.savedObject.title || 'Untitled';
        elements.neObjectType.textContent = response.savedObject.type;
        elements.neReason.textContent = response.savedObject.notExportableReason || 'This resource type cannot be exported.';
        showState('notExportable');
        return;
      }
      
      displaySavedObject(response.savedObject);
      
      // Always show the explore button on Kibana pages
      elements.exploreBtn.classList.remove('hidden');
      
      // Update button text based on additional resource count
      updateExploreBtnText(elements.exploreBtn, response.additionalResourceCount || 0);
      
      showState('detected');
    } else {
      showState('notDetected');
    }
  } catch (error) {
    logger.error('Error detecting resource:', error);
    showState('notDetected');
  }
}

/**
 * Display saved object information in the UI
 */
function displaySavedObject(savedObject) {
  elements.objectTitle.textContent = savedObject.title || 'Untitled';
  elements.objectType.textContent = savedObject.type;
  elements.objectId.textContent = savedObject.id;
}

/**
 * Update explore button text based on additional resource count
 */
function updateExploreBtnText(button, count) {
  const textSpan = button.querySelector('.btn-text');
  if (count > 0) {
    textSpan.textContent = `Explore ${count} more in Side Panel`;
  } else {
    textSpan.textContent = 'Open Side Panel';
  }
}

/**
 * Export the current saved object
 */
async function exportSavedObject() {
  if (!currentSavedObject || !currentTabId) {
    return;
  }

  showState('exporting');

  try {
    // Send export request to content script (which has page context for API calls)
    const response = await chrome.tabs.sendMessage(currentTabId, {
      action: 'exportSavedObject',
      type: currentSavedObject.type,
      id: currentSavedObject.id,
      title: currentSavedObject.title,
      useAlternativeApi: currentSavedObject.useAlternativeApi || false,
    });

    if (response.success) {
      elements.successFilename.textContent = response.filename;
      showState('success');
    } else {
      elements.errorMessage.textContent = response.error || 'Unknown error occurred';
      showState('error');
    }
  } catch (error) {
    logger.error('Export error:', error);
    elements.errorMessage.textContent = error.message || 'Failed to export resource';
    showState('error');
  }
}

/**
 * Retry export after error
 */
function retryExport() {
  showState('detected');
}

/**
 * Open side panel to explore all resources
 */
async function openSidePanel() {
  try {
    // Open the side panel for the current tab
    await chrome.sidePanel.open({ tabId: currentTabId });
    // Close the popup
    window.close();
  } catch (error) {
    logger.warn('Error opening side panel:', error);
  }
}

// Event listeners
elements.exportBtn.addEventListener('click', exportSavedObject);
elements.exploreBtn.addEventListener('click', openSidePanel);
elements.neExploreBtn.addEventListener('click', openSidePanel);
elements.ndExploreBtn.addEventListener('click', openSidePanel);
elements.retryBtn.addEventListener('click', retryExport);

// Initialize popup
initDebugToggle();
showState('loading');
getSavedObjectInfo();
