# Kibana as Code

A Chrome Browser extension that enables downloading saved object(s) from Kibana directly from the page using those objects.

## Features

- **One-click export** of Kibana dashboards, visualizations, and other saved objects
- **Intelligent naming** using the format `{title}-{type}.ndjson`
- **Side panel** to explore and export multiple resources from dashboards
- **Support for embedded panels** that aren't saved as separate objects
- **Alternative API support** for SLOs, alerts, and other special resource types

## How It Works

Saved objects are exported using the Kibana API:
https://www.elastic.co/docs/api/doc/kibana/operation/operation-post-saved-objects-export

The extension automatically:
1. Detects what Kibana page you're viewing
2. Extracts the resource title and ID
3. Uses your existing Kibana session to call the export API
4. Downloads the resource with an intelligent filename

## Supported Resource Types

The extension supports exporting various Kibana saved object types, including:

- `dashboard` - Kibana dashboards
- `visualization` - Legacy visualizations
- `lens` - Lens visualizations
- `search` - Saved searches
- `index-pattern` - Index patterns
- `map` - Maps
- `alert` - Alerting rules (via alternative API)
- `slo` - SLOs (via alternative API)
- And more...

The exact list depends on enabled plugins in your Kibana instance.

## Installation

### From Source

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the extension directory

### From Chrome Web Store

*(Coming soon)*

## Usage

### Quick Export

1. Navigate to any Kibana dashboard, visualization, or saved object
2. Click the extension icon
3. Click "Export" to download the resource

### Explore Dashboard Resources

1. Navigate to a Kibana dashboard
2. Click the extension icon
3. Click "Open Side Panel" to see all dashboard resources
4. Hover over resources to highlight them on the page
5. Click "Export" on any resource to download it

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Automated Issue Triage

This repository uses **automated issue triage** powered by GitHub Actions. When you open an issue:

- 🏷️ Labels are automatically applied based on issue content
- 👋 First-time contributors receive a welcome message
- 📋 Bug reports get helpful prompts for missing information

This helps us respond to issues faster and keep the project organized!

## Browser Support

Currently only **Chrome** is supported. There are no plans to support other browsers at this time.

## License

See LICENSE file for details.
