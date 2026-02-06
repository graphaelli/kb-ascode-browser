// Centralized logging utility for Kibana as Code
// Respects the user's debug mode setting

/**
 * Logger class that respects debug mode setting
 */
class Logger {
  constructor(prefix = '[Kibana as Code]') {
    this.prefix = prefix;
    this._debugEnabled = false;
    this._initialized = false;
    this._initPromise = null;
  }

  /**
   * Initialize logger by loading debug setting from storage
   */
  async init() {
    if (this._initialized) {
      return;
    }

    if (this._initPromise) {
      return this._initPromise;
    }

    this._initPromise = (async () => {
      try {
        const result = await chrome.storage.local.get('debugModeEnabled');
        this._debugEnabled = result.debugModeEnabled || false;
        this._initialized = true;
      } catch (error) {
        // If storage fails, default to disabled
        this._debugEnabled = false;
        this._initialized = true;
      }
    })();

    return this._initPromise;
  }

  /**
   * Get current debug state (synchronous)
   */
  isDebugEnabled() {
    return this._debugEnabled;
  }

  /**
   * Set debug state and persist to storage
   */
  async setDebugEnabled(enabled) {
    this._debugEnabled = enabled;
    try {
      await chrome.storage.local.set({ debugModeEnabled: enabled });
    } catch (error) {
      console.error('Failed to save debug setting:', error);
    }
  }

  /**
   * Log info message (only if debug mode is enabled)
   */
  log(...args) {
    if (this._debugEnabled) {
      console.log(this.prefix, ...args);
    }
  }

  /**
   * Log warning message (only if debug mode is enabled)
   */
  warn(...args) {
    if (this._debugEnabled) {
      console.warn(this.prefix, ...args);
    }
  }

  /**
   * Log error message (only if debug mode is enabled)
   */
  error(...args) {
    if (this._debugEnabled) {
      console.error(this.prefix, ...args);
    }
  }

  /**
   * Always log info message (regardless of debug mode)
   * Use sparingly for critical information
   */
  alwaysLog(...args) {
    console.log(this.prefix, ...args);
  }

  /**
   * Always log warning message (regardless of debug mode)
   * Use sparingly for critical warnings
   */
  alwaysWarn(...args) {
    console.warn(this.prefix, ...args);
  }

  /**
   * Always log error message (regardless of debug mode)
   * Use sparingly for critical errors
   */
  alwaysError(...args) {
    console.error(this.prefix, ...args);
  }
}

// Create singleton instance
const logger = new Logger('[Kibana as Code]');

// Initialize immediately
logger.init();

// Listen for changes to debug setting
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.debugModeEnabled) {
    logger._debugEnabled = changes.debugModeEnabled.newValue || false;
  }
});
