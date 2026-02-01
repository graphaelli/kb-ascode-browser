// Background service worker for Kibana as Code - handles file downloads

/**
 * Sanitize a string for use as a filename
 */
function sanitizeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, '-')  // Replace invalid chars
    .replace(/\s+/g, '-')           // Replace whitespace with dashes
    .replace(/-+/g, '-')            // Collapse multiple dashes
    .replace(/^-|-$/g, '')          // Remove leading/trailing dashes
    .substring(0, 200);             // Limit length
}

/**
 * Generate the filename for a saved object export
 */
function generateFilename(title, type) {
  const sanitizedTitle = sanitizeFilename(title || 'untitled');
  return `${sanitizedTitle}-${type}.ndjson`;
}

/**
 * Download the exported content as a file
 */
async function downloadAsFile(content, filename) {
  // Create a data URL from the content
  const base64Content = btoa(unescape(encodeURIComponent(content)));
  const dataUrl = `data:application/x-ndjson;base64,${base64Content}`;

  // Use Chrome downloads API
  const downloadId = await chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: true,
  });
  
  return downloadId;
}

/**
 * Handle messages from popup or content scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadFile') {
    const { content, title, type } = request;
    
    (async () => {
      try {
        // Generate filename
        const filename = generateFilename(title, type);
        
        // Download the file
        await downloadAsFile(content, filename);
        
        sendResponse({ success: true, filename });
      } catch (error) {
        console.error('[Kibana as Code] Download error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    // Return true to indicate async response
    return true;
  }
});

// Log service worker activation
console.log('[Kibana as Code] Background service worker started');
