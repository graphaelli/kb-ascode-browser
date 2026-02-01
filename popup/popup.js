// Popup script for Kibana Exporter

// State management
let currentSavedObject = null;
let currentTabId = null;

// DOM elements
const states = {
  loading: document.getElementById('loading'),
  notDetected: document.getElementById('not-detected'),
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
  retryBtn: document.getElementById('retry-btn'),
  successFilename: document.getElementById('success-filename'),
  errorMessage: document.getElementById('error-message'),
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
      displaySavedObject(response.savedObject);
      showState('detected');
    } else {
      showState('notDetected');
    }
  } catch (error) {
    // console.error('Error getting saved object info:', error);
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
    });

    if (response.success) {
      elements.successFilename.textContent = response.filename;
      showState('success');
    } else {
      elements.errorMessage.textContent = response.error || 'Unknown error occurred';
      showState('error');
    }
  } catch (error) {
    console.error('Export error:', error);
    elements.errorMessage.textContent = error.message || 'Failed to export saved object';
    showState('error');
  }
}

/**
 * Retry export after error
 */
function retryExport() {
  showState('detected');
}

// Event listeners
elements.exportBtn.addEventListener('click', exportSavedObject);
elements.retryBtn.addEventListener('click', retryExport);

// Initialize popup
showState('loading');
getSavedObjectInfo();
