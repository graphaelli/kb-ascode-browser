// Background service worker for Kibana as Code - handles file downloads

// Import logger
importScripts('../shared/logger.js');

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
function generateFilename(title, type, extension = 'ndjson') {
  const sanitizedTitle = sanitizeFilename(title || 'untitled');
  return `${sanitizedTitle}-${type}.${extension}`;
}

/**
 * Get MIME type for file extension
 */
function getMimeType(extension) {
  const mimeTypes = {
    'ndjson': 'application/x-ndjson',
    'json': 'application/json',
  };
  return mimeTypes[extension] || 'application/octet-stream';
}

/**
 * Download the exported content as a file
 */
async function downloadAsFile(content, filename, extension = 'ndjson') {
  // Create a data URL from the content
  const base64Content = btoa(unescape(encodeURIComponent(content)));
  const mimeType = getMimeType(extension);
  const dataUrl = `data:${mimeType};base64,${base64Content}`;

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
    const { content, title, type, fileExtension = 'ndjson' } = request;
    
    (async () => {
      try {
        // Generate filename
        const filename = generateFilename(title, type, fileExtension);
        
        // Download the file
        await downloadAsFile(content, filename, fileExtension);
        
        sendResponse({ success: true, filename });
      } catch (error) {
        logger.error('Download error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    // Return true to indicate async response
    return true;
  }
});

// Log service worker activation
logger.log('Background service worker started');
