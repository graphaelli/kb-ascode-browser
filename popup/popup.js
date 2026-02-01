// Popup script for Kibana Exporter

// State management
let currentSavedObject = null;
let currentBaseUrl = null;

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
 * Query the content script for saved object info
 */
async function getSavedObjectInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      showState('notDetected');
      return;
    }

    // Send message to content script
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSavedObjectInfo' });
    
    if (response && response.isKibanaPage && response.savedObject) {
      currentSavedObject = response.savedObject;
      currentBaseUrl = response.baseUrl;
      displaySavedObject(response.savedObject);
      showState('detected');
    } else {
      showState('notDetected');
    }
  } catch (error) {
    console.error('Error getting saved object info:', error);
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
  if (!currentSavedObject) {
    return;
  }

  showState('exporting');

  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Send export request to content script (which has page context for API calls)
    const response = await chrome.tabs.sendMessage(tab.id, {
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
