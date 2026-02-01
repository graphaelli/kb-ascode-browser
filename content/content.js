// Content script for detecting Kibana pages and extracting resource context

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
 * Types that require alternative APIs (not the saved objects export API)
 */
const ALTERNATIVE_API_TYPES = {
  slo: {
    apiPath: (id) => `/api/observability/slos/${id}`,
    fileExtension: 'json',
  },
  alert: {
    apiPath: (id) => `/api/alerting/rule/${id}`,
    fileExtension: 'json',
  },
};

/**
 * Types that are not exportable via any known API
 */
const NON_EXPORTABLE_TYPES = {
  cases: 'Cases are not exportable via any known API',
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
 * Export a resource using an alternative API (for types not supported by saved objects export)
 */
async function exportViaAlternativeApi(type, id) {
  const apiConfig = ALTERNATIVE_API_TYPES[type];
  if (!apiConfig) {
    throw new Error(`No alternative API configured for type: ${type}`);
  }
  
  const baseUrl = getKibanaBaseUrl();
  const apiPath = apiConfig.apiPath(id);
  const url = `${baseUrl}${apiPath}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'kbn-xsrf': 'true',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Export failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  
  // Return as formatted JSON (pretty printed for readability)
  return JSON.stringify(data, null, 2);
}

/**
 * Fetch dashboard data via API to get embedded panel configs
 */
async function fetchDashboardData(dashboardId) {
  const baseUrl = getKibanaBaseUrl();
  const url = `${baseUrl}/api/saved_objects/dashboard/${dashboardId}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'kbn-xsrf': 'true',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch dashboard: ${response.status}`);
  }

  return await response.json();
}

/**
 * Construct a synthetic saved object export from embedded panel config
 */
function constructPanelExport(panel, dashboardTitle) {
  const now = new Date().toISOString();
  const panelType = panel.type;
  const embeddableConfig = panel.embeddableConfig || {};
  const title = extractPanelTitle(panel);
  
  // Generate a deterministic ID based on panel content
  const panelId = panel.panelIndex || crypto.randomUUID();
  
  let savedObject;
  
  if (panelType === 'lens') {
    // Lens visualization - state must be JSON stringified
    const attributes = embeddableConfig.attributes || {};
    const state = attributes.state || {};
    
    savedObject = {
      attributes: {
        title: title,
        description: attributes.description || '',
        visualizationType: attributes.visualizationType || 'lnsXY',
        state: JSON.stringify(state),
      },
      type: 'lens',
      id: panelId,
      managed: false,
      references: attributes.references || [],
      coreMigrationVersion: '8.8.0',
      typeMigrationVersion: '8.9.0',
      created_at: now,
      updated_at: now,
    };
  } else if (panelType === 'visualization') {
    // Legacy visualization or markdown
    const savedVis = embeddableConfig.savedVis || {};
    const visState = {
      type: savedVis.type || 'markdown',
      params: savedVis.params || {},
      aggs: savedVis.data?.aggs || [],
      title: title,
    };
    
    const searchSource = savedVis.data?.searchSource || { query: { language: 'kuery', query: '' }, filter: [] };
    
    savedObject = {
      attributes: {
        title: title,
        visState: JSON.stringify(visState),
        uiStateJSON: JSON.stringify(savedVis.uiState || {}),
        description: savedVis.description || '',
        version: 1,
        kibanaSavedObjectMeta: {
          searchSourceJSON: JSON.stringify(searchSource),
        },
      },
      type: 'visualization',
      id: panelId,
      managed: false,
      references: [],
      coreMigrationVersion: '8.8.0',
      typeMigrationVersion: '8.5.0',
      created_at: now,
      updated_at: now,
    };
  } else if (panelType === 'map') {
    // Maps
    const attributes = embeddableConfig.attributes || {};
    savedObject = {
      attributes: {
        title: title,
        description: attributes.description || '',
        layerListJSON: typeof attributes.layerListJSON === 'string' 
          ? attributes.layerListJSON 
          : JSON.stringify(attributes.layerListJSON || []),
        mapStateJSON: typeof attributes.mapStateJSON === 'string'
          ? attributes.mapStateJSON
          : JSON.stringify(attributes.mapStateJSON || {}),
        uiStateJSON: typeof attributes.uiStateJSON === 'string'
          ? attributes.uiStateJSON
          : JSON.stringify(attributes.uiStateJSON || {}),
      },
      type: 'map',
      id: panelId,
      managed: false,
      references: attributes.references || [],
      coreMigrationVersion: '8.8.0',
      created_at: now,
      updated_at: now,
    };
  } else if (panelType === 'search') {
    // Saved search
    const attributes = embeddableConfig.attributes || {};
    savedObject = {
      attributes: {
        title: title,
        description: attributes.description || '',
        columns: attributes.columns || [],
        sort: attributes.sort || [],
        kibanaSavedObjectMeta: attributes.kibanaSavedObjectMeta || {
          searchSourceJSON: '{}',
        },
      },
      type: 'search',
      id: panelId,
      managed: false,
      references: attributes.references || [],
      coreMigrationVersion: '8.8.0',
      created_at: now,
      updated_at: now,
    };
  } else {
    // Generic fallback - try to preserve the embedded attributes structure
    const attributes = embeddableConfig.attributes || {};
    savedObject = {
      attributes: {
        title: title,
        ...attributes,
      },
      type: panelType,
      id: panelId,
      managed: false,
      references: attributes.references || [],
      coreMigrationVersion: '8.8.0',
      created_at: now,
      updated_at: now,
    };
  }
  
  // Create NDJSON format with export summary
  const exportSummary = {
    excludedObjects: [],
    excludedObjectsCount: 0,
    exportedCount: 1,
    missingRefCount: 0,
    missingReferences: [],
  };
  
  return JSON.stringify(savedObject) + '\n' + JSON.stringify(exportSummary);
}

/**
 * Export an embedded panel from a dashboard (no saved object ID needed)
 */
async function exportEmbeddedPanel(dashboardId, panelIndex) {
  // Fetch the dashboard data
  const dashboard = await fetchDashboardData(dashboardId);
  
  // Parse panelsJSON
  const panelsJSON = dashboard.attributes?.panelsJSON;
  if (!panelsJSON) {
    throw new Error('Dashboard has no panels');
  }
  
  const panels = JSON.parse(panelsJSON);
  
  // Find the panel by index
  const panel = panels.find(p => p.panelIndex === panelIndex);
  if (!panel) {
    throw new Error(`Panel ${panelIndex} not found in dashboard`);
  }
  
  // Construct the export
  const dashboardTitle = dashboard.attributes?.title || 'Dashboard';
  return constructPanelExport(panel, dashboardTitle);
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
      const result = {
        type,
        id: match[1],
        title: extractTitle(),
        url: url,
      };
      
      // Check if this type uses an alternative API
      if (ALTERNATIVE_API_TYPES[type]) {
        result.useAlternativeApi = true;
      }
      
      // Check if this type is non-exportable
      if (NON_EXPORTABLE_TYPES[type]) {
        result.notExportable = true;
        result.notExportableReason = NON_EXPORTABLE_TYPES[type];
      }
      
      return result;
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
 * Detect embedded panels on a dashboard page
 * Returns array of panel resources sorted by visual position (top-left to bottom-right)
 */
function detectEmbeddedPanels() {
  const panels = [];
  
  // Find all dashboard panels using various Kibana selectors
  const panelSelectors = [
    '[data-test-subj="embeddablePanel"]',
    '.embPanel',
    '[data-test-embeddable-id]',
    '.dshDashboardGrid__item',
  ];
  
  let panelElements = [];
  for (const selector of panelSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      panelElements = Array.from(elements);
      break;
    }
  }
  
  // Extract info from each panel
  for (const panel of panelElements) {
    const panelInfo = extractPanelInfo(panel);
    if (panelInfo) {
      // Get position for sorting
      const rect = panel.getBoundingClientRect();
      panelInfo.position = {
        top: rect.top,
        left: rect.left,
      };
      panels.push(panelInfo);
    }
  }
  
  // Sort by position: top to bottom, then left to right
  panels.sort((a, b) => {
    const rowThreshold = 50; // Consider panels within 50px as same row
    const rowDiff = a.position.top - b.position.top;
    if (Math.abs(rowDiff) > rowThreshold) {
      return rowDiff;
    }
    return a.position.left - b.position.left;
  });
  
  // Remove position data before returning
  return panels.map(({ position, ...rest }) => rest);
}

/**
 * Extract resource info from a panel element
 */
function extractPanelInfo(panel) {
  // Try to get panel title from various selectors
  const titleSelectors = [
    '[data-test-subj="embeddablePanelTitleInner"]',
    '[data-test-subj="embeddablePanelTitleText"]',
    '.embPanel__titleText',
    '.embPanel__title',
    '[data-test-subj="dashboardPanelTitle"]',
    '.embPanel__titleInner',
    'figcaption',
    '[class*="panelTitle"]',
  ];
  
  let title = null;
  for (const selector of titleSelectors) {
    const titleEl = panel.querySelector(selector);
    if (titleEl && titleEl.textContent.trim()) {
      title = titleEl.textContent.trim();
      break;
    }
  }
  
  let id = null;
  let type = null;
  
  // Method 1: Check data attributes on the panel itself
  const dataAttrs = [
    'data-test-embeddable-id',
    'data-saved-object-id', 
    'data-panel-id',
    'data-embeddable-id',
  ];
  
  for (const attr of dataAttrs) {
    const value = panel.getAttribute(attr);
    if (value) {
      id = value;
      break;
    }
  }
  
  // Method 2: Look for data attributes on child elements
  if (!id) {
    const elementsWithData = panel.querySelectorAll('[data-saved-object-id], [data-test-embeddable-id], [data-embeddable-id]');
    for (const el of elementsWithData) {
      id = el.getAttribute('data-saved-object-id') || 
           el.getAttribute('data-test-embeddable-id') || 
           el.getAttribute('data-embeddable-id');
      if (id) break;
    }
  }
  
  // Method 3: Look for edit links in panel actions/menu
  if (!id) {
    const editLinks = panel.querySelectorAll('a[href*="/edit/"], a[href*="#/edit/"]');
    for (const link of editLinks) {
      const href = link.getAttribute('href');
      const match = href.match(/\/edit\/([^?&/#]+)/);
      if (match) {
        id = match[1];
        // Determine type from URL
        if (href.includes('/lens')) {
          type = 'lens';
        } else if (href.includes('/visualize')) {
          type = 'visualization';
        } else if (href.includes('/maps')) {
          type = 'map';
        } else if (href.includes('/discover')) {
          type = 'search';
        }
        break;
      }
    }
  }
  
  // Method 4: Look for references in panel content (React data, etc)
  if (!id) {
    // Check for Lens visualizations
    const lensContainer = panel.querySelector('[data-test-subj*="lns"], [class*="lns"]');
    if (lensContainer) {
      type = 'lens';
    }
    
    // Check for visualization embeddable
    const visContainer = panel.querySelector('[data-test-subj*="embeddable"], [class*="embeddable"]');
    if (visContainer) {
      const visId = visContainer.getAttribute('data-render-complete-id') ||
                    visContainer.getAttribute('data-embeddable-id');
      if (visId) {
        id = visId;
      }
    }
  }
  
  // Method 5: Parse from any URL-like content in data attributes
  if (!id) {
    const allElements = panel.querySelectorAll('*');
    for (const el of allElements) {
      for (const attr of el.getAttributeNames()) {
        const value = el.getAttribute(attr);
        if (value && typeof value === 'string') {
          // Look for UUID-like patterns
          const uuidMatch = value.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
          if (uuidMatch && !id) {
            id = uuidMatch[1];
            break;
          }
        }
      }
      if (id) break;
    }
  }
  
  // Determine type if not already set
  if (!type) {
    const panelContent = panel.innerHTML.toLowerCase();
    const panelAttrs = (panel.getAttribute('data-test-subj') || '').toLowerCase() +
                       (panel.className || '').toLowerCase();
    
    if (panelAttrs.includes('lens') || panelContent.includes('lnsvis')) {
      type = 'lens';
    } else if (panelAttrs.includes('map') || panelContent.includes('mapcontainer')) {
      type = 'map';
    } else if (panelAttrs.includes('search') || panelAttrs.includes('discover')) {
      type = 'search';
    } else if (panelAttrs.includes('vis') || panelContent.includes('visualization')) {
      type = 'visualization';
    } else {
      type = 'lens'; // Default to lens as it's most common in modern Kibana
    }
  }
  
  // Debug logging
  console.log('[Kibana as Code] Panel detection:', { title, id, type, panelElement: panel });
  
  // If we found at least a title, return the panel info
  if (title || id) {
    return {
      type,
      id: id || null, // null means unsaved/inline
      title: title || 'Untitled Panel',
    };
  }
  
  return null;
}

/**
 * Get all exportable resources on the page
 * Returns the main resource first, followed by embedded panels
 */
async function getAllResources() {
  const resources = [];
  
  // Get the main/top-level resource
  const mainResource = detectSavedObject();
  if (mainResource) {
    resources.push(mainResource);
  }
  
  // If on a dashboard, fetch and parse the dashboard to get embedded panels
  const url = window.location.href;
  if (url.includes('/app/dashboards') && mainResource?.id) {
    try {
      const panels = await getEmbeddedPanelsFromAPI(mainResource.id);
      resources.push(...panels);
    } catch (error) {
      console.error('[Kibana as Code] Error fetching embedded panels:', error);
      // Fallback to DOM detection
      const domPanels = detectEmbeddedPanels();
      resources.push(...domPanels);
    }
  }
  
  return resources;
}

/**
 * Extract the visualization subtype (chart type) from a panel
 */
function extractPanelSubType(panel) {
  const embeddableConfig = panel.embeddableConfig || {};
  const attributes = embeddableConfig.attributes || {};
  const state = attributes.state || {};
  const visualization = state.visualization || {};
  
  // For Lens visualizations, get the preferred series type or visualization type
  if (panel.type === 'lens') {
    // Try to get from visualization.preferredSeriesType (most common for XY charts)
    if (visualization.preferredSeriesType) {
      // Clean up the series type name (e.g., "bar_stacked" -> "bar stacked")
      return visualization.preferredSeriesType.replace(/_/g, ' ');
    }
    
    // Try to get from attributes.visualizationType (e.g., "lnsXY", "lnsMetric", "lnsPie")
    if (attributes.visualizationType) {
      const vizType = attributes.visualizationType;
      // Map common Lens visualization types to friendly names
      const typeMap = {
        'lnsXY': 'xy',
        'lnsMetric': 'metric',
        'lnsPie': 'pie',
        'lnsDatatable': 'table',
        'lnsLegacyMetric': 'metric',
        'lnsGauge': 'gauge',
        'lnsHeatmap': 'heatmap',
        'lnsTagcloud': 'tag cloud',
        'lnsMosaic': 'mosaic',
        'lnsPartition': 'partition',
      };
      return typeMap[vizType] || vizType.replace(/^lns/, '').toLowerCase();
    }
  }
  
  // For legacy visualizations, get the vis type
  if (panel.type === 'visualization') {
    const savedVis = embeddableConfig.savedVis || {};
    if (savedVis.type) {
      return savedVis.type;
    }
  }
  
  return null;
}

/**
 * Extract title from a panel object
 */
function extractPanelTitle(panel) {
  const embeddableConfig = panel.embeddableConfig || {};
  
  // Try various locations where title might be stored
  // 1. Direct title in embeddableConfig (most common)
  if (embeddableConfig.title) {
    return embeddableConfig.title;
  }
  
  // 2. Title in nested attributes (Lens visualizations)
  if (embeddableConfig.attributes?.title) {
    return embeddableConfig.attributes.title;
  }
  
  // 3. Title in savedVis (legacy visualizations)
  if (embeddableConfig.savedVis?.title) {
    return embeddableConfig.savedVis.title;
  }
  
  // 4. Check for title in the panel's vis state
  if (embeddableConfig.vis?.title) {
    return embeddableConfig.vis.title;
  }
  
  // 5. Try to extract from visualization state if it exists
  if (embeddableConfig.attributes?.state?.visualization?.title) {
    return embeddableConfig.attributes.state.visualization.title;
  }
  
  // 6. Panel-level title (sometimes used)
  if (panel.title) {
    return panel.title;
  }
  
  return 'Untitled Panel';
}

/**
 * Get embedded panels by fetching dashboard data from API
 */
async function getEmbeddedPanelsFromAPI(dashboardId) {
  const dashboard = await fetchDashboardData(dashboardId);
  
  const panelsJSON = dashboard.attributes?.panelsJSON;
  if (!panelsJSON) {
    return [];
  }
  
  const panels = JSON.parse(panelsJSON);
  const resources = [];
  
  // Sort panels by grid position (top to bottom, left to right)
  panels.sort((a, b) => {
    const aGrid = a.gridData || { y: 0, x: 0 };
    const bGrid = b.gridData || { y: 0, x: 0 };
    if (aGrid.y !== bGrid.y) {
      return aGrid.y - bGrid.y;
    }
    return aGrid.x - bGrid.x;
  });
  
  for (const panel of panels) {
    const title = extractPanelTitle(panel);
    const subType = extractPanelSubType(panel);
    
    resources.push({
      type: panel.type,
      subType: subType,
      id: null, // Embedded panels don't have their own saved object ID
      title: title,
      panelIndex: panel.panelIndex,
      dashboardId: dashboardId,
      isEmbedded: true,
    });
  }
  
  return resources;
}

/**
 * Listen for messages from the popup or background script
 */
// Store for highlighted element
let highlightedElement = null;
let highlightOverlay = null;

/**
 * Create highlight overlay for a panel
 */
function highlightPanel(panelIndex, resourceIndex) {
  // Remove any existing highlight
  unhighlightPanel();
  
  // Find panel elements on the page
  const panelSelectors = [
    '[data-test-subj="embeddablePanel"]',
    '.embPanel',
    '[data-test-embeddable-id]',
    '.dshDashboardGrid__item',
    '[data-grid-item-id]',
  ];
  
  let panelElements = [];
  for (const selector of panelSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      panelElements = Array.from(elements);
      break;
    }
  }
  
  if (panelElements.length === 0) {
    console.log('[Kibana as Code] No panel elements found');
    return;
  }
  
  // Sort panels by position to match our resource list order
  panelElements.sort((a, b) => {
    const aRect = a.getBoundingClientRect();
    const bRect = b.getBoundingClientRect();
    const rowThreshold = 50;
    const rowDiff = aRect.top - bRect.top;
    if (Math.abs(rowDiff) > rowThreshold) {
      return rowDiff;
    }
    return aRect.left - bRect.left;
  });
  
  // Resource index 0 is the dashboard itself, so embedded panels start at index 1
  const panelElementIndex = resourceIndex - 1;
  
  if (panelElementIndex >= 0 && panelElementIndex < panelElements.length) {
    const panel = panelElements[panelElementIndex];
    highlightedElement = panel;
    
    // Create overlay
    const rect = panel.getBoundingClientRect();
    highlightOverlay = document.createElement('div');
    highlightOverlay.id = 'kibana-as-code-highlight';
    highlightOverlay.style.cssText = `
      position: fixed;
      top: ${rect.top}px;
      left: ${rect.left}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      border: 3px solid #006bb4;
      border-radius: 4px;
      background: rgba(0, 107, 180, 0.1);
      pointer-events: none;
      z-index: 10000;
      transition: all 0.15s ease-out;
      box-shadow: 0 0 20px rgba(0, 107, 180, 0.3);
    `;
    document.body.appendChild(highlightOverlay);
    
    // Scroll panel into view if needed
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/**
 * Remove highlight overlay
 */
function unhighlightPanel() {
  if (highlightOverlay) {
    highlightOverlay.remove();
    highlightOverlay = null;
  }
  highlightedElement = null;
}

/**
 * Update highlight overlay position (for scroll/resize)
 */
function updateHighlightPosition() {
  if (highlightedElement && highlightOverlay) {
    const rect = highlightedElement.getBoundingClientRect();
    highlightOverlay.style.top = `${rect.top}px`;
    highlightOverlay.style.left = `${rect.left}px`;
    highlightOverlay.style.width = `${rect.width}px`;
    highlightOverlay.style.height = `${rect.height}px`;
  }
}

// Update highlight position on scroll/resize
window.addEventListener('scroll', updateHighlightPosition, true);
window.addEventListener('resize', updateHighlightPosition);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'highlightPanel') {
    highlightPanel(request.panelIndex, request.index);
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'unhighlightPanel') {
    unhighlightPanel();
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'getSavedObjectInfo') {
    (async () => {
      const savedObject = detectSavedObject();
      const baseUrl = getKibanaBaseUrl();
      
      // Get resource count for dashboard pages (async)
      let additionalResourceCount = 0;
      if (savedObject && window.location.href.includes('/app/dashboards')) {
        try {
          const resources = await getAllResources();
          // Additional resources = total - 1 (the main dashboard)
          additionalResourceCount = Math.max(0, resources.length - 1);
        } catch (e) {
          console.error('[Kibana as Code] Error getting resource count:', e);
        }
      }
      
      sendResponse({
        savedObject,
        baseUrl,
        isKibanaPage: savedObject !== null,
        additionalResourceCount,
      });
    })();
    return true;
  }
  
  if (request.action === 'getAllResources') {
    (async () => {
      try {
        const resources = await getAllResources();
        sendResponse({ resources });
      } catch (error) {
        console.error('[Kibana as Code] Error getting all resources:', error);
        sendResponse({ resources: [] });
      }
    })();
    return true;
  }
  
  if (request.action === 'exportSavedObject') {
    const { type, id, title, panelIndex, dashboardId, isEmbedded, useAlternativeApi } = request;
    
    (async () => {
      try {
        let content;
        let fileExtension = 'ndjson'; // Default for saved objects
        
        if (isEmbedded && dashboardId && panelIndex) {
          // Export embedded panel (construct synthetic saved object)
          content = await exportEmbeddedPanel(dashboardId, panelIndex);
        } else if (useAlternativeApi && ALTERNATIVE_API_TYPES[type]) {
          // Export using alternative API (SLOs, alerting rules, etc.)
          content = await exportViaAlternativeApi(type, id);
          fileExtension = ALTERNATIVE_API_TYPES[type].fileExtension || 'json';
        } else if (id) {
          // Export regular saved object via API
          content = await exportSavedObject(type, id);
        } else {
          throw new Error('No valid export target specified');
        }
        
        // Send to background script for download
        const downloadResponse = await chrome.runtime.sendMessage({
          action: 'downloadFile',
          content,
          title,
          type,
          fileExtension,
        });
        
        sendResponse(downloadResponse);
      } catch (error) {
        console.error('[Kibana as Code] Export error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  // Return true to indicate async response
  return true;
});

// Log detection on page load for debugging
console.log('[Kibana as Code] Content script loaded');
const detected = detectSavedObject();
if (detected) {
  console.log('[Kibana as Code] Detected resource:', detected);
}

} // end initKibanaExporter
