# Build Plan: Kibana Saved Objects Chrome Extension

A Chrome extension for downloading Kibana saved objects directly from the browser using the Kibana export API.

## Phase 1: Extension Foundation

1. **Create manifest.json** (Manifest V3) with required permissions:
   - `activeTab` - to access current tab URL
   - `scripting` - to inject content scripts
   - `host_permissions` for Kibana domains (configurable)

2. **Set up project structure:**
   - `manifest.json` - extension configuration
   - `popup/` - popup UI (HTML/CSS/JS)
   - `content/` - content scripts for page interaction
   - `background/` - service worker for API calls
   - `icons/` - extension icons

## Phase 2: Page Detection & Context Extraction

3. **Create content script** to detect Kibana pages and extract context:
   - Identify saved object type from URL patterns (dashboard, visualization, lens, search, etc.)
   - Extract object title from page DOM or breadcrumbs
   - Extract object ID from URL

## Phase 3: Export API Integration

4. **Implement Kibana API client** in background service worker:
   - Call `POST /api/saved_objects/_export` with object type and ID
   - Handle authentication (use existing session cookies)
   - Handle API errors gracefully

## Phase 4: Download & Naming

5. **Implement file download:**
   - Generate filename: `{title}-{type}.ndjson`
   - Sanitize title for filesystem compatibility
   - Trigger download using Chrome downloads API

## Phase 5: User Interface

6. **Build popup UI:**
   - Show detected object info (title, type)
   - Download button
   - Status/error messages
   - Settings for host configuration

## Phase 6: Polish

7. **Add icons and branding**
8. **Error handling and edge cases**
9. **Testing on various Kibana pages**
