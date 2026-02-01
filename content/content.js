// Content script for detecting Kibana pages and extracting saved object context

// Guard against multiple injections
if (window.__kibanaExporterLoaded) {
  // Already loaded, skip initialization
} else {
  window.__kibanaExporterLoaded = true;
  initKibanaExporter();
}

function initKibanaExporter() {

/**
 * URL patterns for different Kibana saved object types
 * IDs can be UUIDs or custom strings - capture until query params or end
 */
const KIBANA_PATTERNS = {
  dashboard: /\/app\/dashboards#\/view\/([^?&]+)/,
  visualization: /\/app\/visualize#\/edit\/([^?&]+)/,
  lens: /\/app\/lens#\/edit\/([^?&]+)/,
  search: /\/app\/discover#\/view\/([^?&]+)/,
  map: /\/app\/maps#\/map\/([^?&]+)/,
  'index-pattern': /\/app\/management\/kibana\/indexPatterns\/patterns\/([^?&]+)/,
  query: /\/app\/management\/kibana\/objects\/savedQueries\/([^?&]+)/,
  // SLO patterns
  slo: /\/app\/slos\/([^?&/]+)/,
  // Alerting rules
  alert: /\/app\/management\/insightsAndAlerting\/triggersActions\/rule\/([^?&]+)/,
  // Cases
  cases: /\/app\/security\/cases\/([^?&]+)/,
};

/**
 * Export a saved object using the Kibana API (called from content script context)
 */
async function exportSavedObject(type, id) {
  const baseUrl = getKibanaBaseUrl();
  const exportUrl = `${baseUrl}/api/saved_objects/_export`;
  
  const body = {
    objects: [{ type, id }],
    includeReferencesDeep: true,
  };

  const response = await fetch(exportUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'kbn-xsrf': 'true',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Export failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.text();
}

/**
 * Extract title from page based on object type
 */
function extractTitle() {
  // Try common Kibana title selectors
  const selectors = [
    // Dashboard title
    '[data-test-subj="dashboardTitle"]',
    // Page header
    '.euiPageHeaderContent h1',
    '.euiPageHeader h1',
    // Breadcrumb (last item)
    '.euiBreadcrumb:last-child',
    // Generic heading
    'h1.euiTitle',
    // Lens title
    '[data-test-subj="lnsApp_topNavTitle"]',
    // Saved search title  
    '[data-test-subj="discoverSavedSearchTitle"]',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      return element.textContent.trim();
    }
  }

  // Fallback: try to get from document title
  const docTitle = document.title;
  if (docTitle) {
    // Remove common suffixes like " - Elastic" or " - Kibana"
    return docTitle.replace(/\s*[-–—]\s*(Elastic|Kibana).*$/i, '').trim();
  }

  return null;
}

/**
 * Detect the saved object type and ID from the current URL
 */
function detectSavedObject() {
  const url = window.location.href;
  
  for (const [type, pattern] of Object.entries(KIBANA_PATTERNS)) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return {
        type,
        id: match[1],
        title: extractTitle(),
        url: url,
      };
    }
  }
  
  return null;
}

/**
 * Get the base Kibana URL for API calls
 */
function getKibanaBaseUrl() {
  const url = new URL(window.location.href);
  return `${url.protocol}//${url.host}`;
}

/**
 * Listen for messages from the popup or background script
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSavedObjectInfo') {
    const savedObject = detectSavedObject();
    const baseUrl = getKibanaBaseUrl();
    
    sendResponse({
      savedObject,
      baseUrl,
      isKibanaPage: savedObject !== null,
    });
  }
  
  if (request.action === 'exportSavedObject') {
    const { type, id, title } = request;
    
    (async () => {
      try {
        // Export using content script context (has page cookies)
        const content = await exportSavedObject(type, id);
        
        // Send to background script for download
        const downloadResponse = await chrome.runtime.sendMessage({
          action: 'downloadFile',
          content,
          title,
          type,
        });
        
        sendResponse(downloadResponse);
      } catch (error) {
        console.error('[Kibana Exporter] Export error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
  }
  
  // Return true to indicate async response
  return true;
});

// Log detection on page load for debugging
console.log('[Kibana Exporter] Content script loaded');
const detected = detectSavedObject();
if (detected) {
  console.log('[Kibana Exporter] Detected saved object:', detected);
}

} // end initKibanaExporter
