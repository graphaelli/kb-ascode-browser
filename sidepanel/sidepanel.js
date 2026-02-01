// Side panel script for Kibana as Code

// DOM elements
const loadingState = document.getElementById('loading');
const noResourcesState = document.getElementById('no-resources');
const resourcesContainer = document.getElementById('resources-container');
const resourcesList = document.getElementById('resources-list');
const resourceCount = document.getElementById('resource-count');
const refreshBtn = document.getElementById('refresh-btn');
const autoRefreshCheckbox = document.getElementById('auto-refresh-checkbox');

// Current tab ID and URL for tracking navigation
let currentTabId = null;
let currentTabUrl = null;
let autoRefreshEnabled = false;

/**
 * Show a specific state
 */
function showState(state) {
  loadingState.classList.add('hidden');
  noResourcesState.classList.add('hidden');
  resourcesContainer.classList.add('hidden');
  
  if (state === 'loading') {
    loadingState.classList.remove('hidden');
  } else if (state === 'no-resources') {
    noResourcesState.classList.remove('hidden');
  } else if (state === 'resources') {
    resourcesContainer.classList.remove('hidden');
  }
}

/**
 * Render a single resource item
 */
function renderResourceItem(resource, index) {
  const isPrimary = index === 0;
  const isEmbedded = resource.isEmbedded;
  const isNotExportable = resource.notExportable;
  const usesAltApi = resource.useAlternativeApi;
  const canExport = !isNotExportable && (resource.id || isEmbedded || usesAltApi); // Can export if has ID, is embedded, or uses alt API
  
  const li = document.createElement('li');
  li.className = `resource-item${isPrimary ? ' primary' : ''}${isNotExportable ? ' not-exportable' : ''}`;
  li.dataset.index = index;
  
  let typeLabel = resource.type;
  if (resource.subType) {
    // Show subtype for visualizations (e.g., "lens (bar)", "visualization (markdown)")
    typeLabel += ` (${resource.subType})`;
  } else if (usesAltApi) {
    typeLabel += ' (json)';
  }
  
  let disabledReason = '';
  if (isNotExportable) {
    disabledReason = resource.notExportableReason || 'This resource type cannot be exported';
  } else if (!canExport) {
    disabledReason = 'Cannot export this resource';
  }
  
  li.innerHTML = `
    <div class="resource-content">
      <div class="resource-header">
        <div class="resource-info">
          <div class="resource-title">${escapeHtml(resource.title || 'Untitled')}</div>
          <div class="resource-meta">
            <span class="resource-type${isEmbedded ? ' embedded' : ''}${usesAltApi ? ' alt-api' : ''}${isNotExportable ? ' not-exportable' : ''}">${escapeHtml(typeLabel)}</span>
            ${resource.id ? `<span class="resource-id" title="${escapeHtml(resource.id)}">${escapeHtml(resource.id)}</span>` : ''}
          </div>
          ${isNotExportable ? `<div class="not-exportable-reason">${escapeHtml(disabledReason)}</div>` : ''}
        </div>
        <button class="download-btn" data-index="${index}" ${!canExport ? `disabled title="${escapeHtml(disabledReason)}"` : ''}>
          <span class="btn-icon-inner">${isNotExportable ? '🚫' : '⬇️'}</span>
          <span class="btn-text">${isNotExportable ? 'N/A' : 'Export'}</span>
        </button>
      </div>
    </div>
  `;
  
  return li;
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Render all resources
 */
function renderResources(resources) {
  resourcesList.innerHTML = '';
  
  if (!resources || resources.length === 0) {
    showState('no-resources');
    return;
  }
  
  resources.forEach((resource, index) => {
    const item = renderResourceItem(resource, index);
    resourcesList.appendChild(item);
  });
  
  const exportableCount = resources.filter(r => !r.notExportable && (r.id || r.isEmbedded || r.useAlternativeApi)).length;
  resourceCount.textContent = `${resources.length} resource${resources.length !== 1 ? 's' : ''} (${exportableCount} exportable)`;
  
  showState('resources');
}

/**
 * Handle download button click
 */
async function handleDownload(index, button) {
  // Get resources from storage
  const { panelResources } = await chrome.storage.session.get('panelResources');
  if (!panelResources || !panelResources[index]) {
    return;
  }
  
  const resource = panelResources[index];
  const canExport = !resource.notExportable && (resource.id || resource.isEmbedded || resource.useAlternativeApi);
  if (!canExport) {
    return;
  }
  
  // Update button state
  button.classList.add('downloading');
  button.querySelector('.btn-text').textContent = 'Exporting...';
  button.disabled = true;
  
  // Remove any existing status
  const item = button.closest('.resource-item');
  const existingStatus = item.querySelector('.resource-status');
  if (existingStatus) {
    existingStatus.remove();
  }
  
  try {
    // Send export request to content script
    const response = await chrome.tabs.sendMessage(currentTabId, {
      action: 'exportSavedObject',
      type: resource.type,
      id: resource.id,
      title: resource.title,
      panelIndex: resource.panelIndex,
      dashboardId: resource.dashboardId,
      isEmbedded: resource.isEmbedded,
      useAlternativeApi: resource.useAlternativeApi || false,
    });
    
    if (response.success) {
      button.classList.remove('downloading');
      button.classList.add('success');
      button.querySelector('.btn-text').textContent = 'Done!';
      
      // Add success status
      const status = document.createElement('div');
      status.className = 'resource-status success';
      status.textContent = `Exported: ${response.filename}`;
      item.appendChild(status);
      
      // Reset button after delay
      setTimeout(() => {
        button.classList.remove('success');
        button.querySelector('.btn-text').textContent = 'Export';
        button.disabled = false;
      }, 2000);
    } else {
      throw new Error(response.error || 'Export failed');
    }
  } catch (error) {
    console.error('[Kibana as Code] Export error:', error);
    
    button.classList.remove('downloading');
    button.classList.add('error');
    button.querySelector('.btn-text').textContent = 'Failed';
    
    // Add error status
    const status = document.createElement('div');
    status.className = 'resource-status error';
    status.textContent = error.message;
    item.appendChild(status);
    
    // Reset button after delay
    setTimeout(() => {
      button.classList.remove('error');
      button.querySelector('.btn-text').textContent = 'Export';
      button.disabled = false;
    }, 3000);
  }
}

/**
 * Scan page for resources
 */
async function scanForResources() {
  showState('loading');
  
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      showState('no-resources');
      return;
    }
    
    currentTabId = tab.id;
    
    // Inject content script if needed
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/content.js']
      });
    } catch (e) {
      // Script might already be injected
    }
    
    // Wait for script to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Request all resources from content script
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getAllResources' });
    
    if (response && response.resources) {
      // Store resources in session storage for download handler
      await chrome.storage.session.set({ panelResources: response.resources });
      renderResources(response.resources);
    } else {
      showState('no-resources');
    }
  } catch (error) {
    console.error('[Kibana as Code] Error scanning for resources:', error);
    showState('no-resources');
  }
}

// Event listeners
refreshBtn.addEventListener('click', scanForResources);

resourcesList.addEventListener('click', (e) => {
  const button = e.target.closest('.download-btn');
  if (button && !button.disabled) {
    const index = parseInt(button.dataset.index, 10);
    handleDownload(index, button);
  }
});

// Highlight panel on hover
resourcesList.addEventListener('mouseenter', async (e) => {
  const item = e.target.closest('.resource-item');
  if (item && currentTabId) {
    const index = parseInt(item.dataset.index, 10);
    const { panelResources } = await chrome.storage.session.get('panelResources');
    if (panelResources && panelResources[index]) {
      const resource = panelResources[index];
      try {
        await chrome.tabs.sendMessage(currentTabId, {
          action: 'highlightPanel',
          panelIndex: resource.panelIndex,
          index: index,
        });
      } catch (e) {
        // Ignore errors if content script not ready
      }
    }
  }
}, true);

resourcesList.addEventListener('mouseleave', async (e) => {
  const item = e.target.closest('.resource-item');
  if (item && currentTabId) {
    try {
      await chrome.tabs.sendMessage(currentTabId, {
        action: 'unhighlightPanel',
      });
    } catch (e) {
      // Ignore errors
    }
  }
}, true);

// Auto-refresh checkbox handler
autoRefreshCheckbox.addEventListener('change', async (e) => {
  autoRefreshEnabled = e.target.checked;
  await chrome.storage.session.set({ autoRefreshEnabled });
  
  if (autoRefreshEnabled) {
    // Store current URL when enabling
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      currentTabUrl = tab.url;
    }
  }
});

// Listen for tab updates (URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only care about the current tab and when URL changes
  if (tabId === currentTabId && changeInfo.url && autoRefreshEnabled) {
    // URL has changed, trigger refresh
    currentTabUrl = changeInfo.url;
    scanForResources();
  }
});

// Listen for tab activation (user switches tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (autoRefreshEnabled) {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.url !== currentTabUrl) {
      currentTabId = activeInfo.tabId;
      currentTabUrl = tab.url;
      scanForResources();
    }
  }
});

// Initialize auto-refresh state from storage
async function initAutoRefresh() {
  const { autoRefreshEnabled: stored } = await chrome.storage.session.get('autoRefreshEnabled');
  if (stored) {
    autoRefreshEnabled = true;
    autoRefreshCheckbox.checked = true;
  }
}

// Initialize
initAutoRefresh();
scanForResources();
