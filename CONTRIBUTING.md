# Contributing to Kibana as Code

Thank you for your interest in contributing to this project! This document provides guidelines for contributing.

## Getting Started

1. **Fork the repository** and clone it locally
2. **Create a branch** for your changes
3. **Make your changes** following the code style
4. **Test your changes** manually in Chrome
5. **Submit a pull request** with a clear description

## Development Setup

### Prerequisites

- Chrome browser (latest version recommended)
- Text editor or IDE

### Testing the Extension Locally

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the extension directory
5. Test your changes on a Kibana instance

## Issue Reporting

### Automatic Triage

This repository uses automated issue triage! When you open an issue:

- **Labels are automatically applied** based on your issue content
- **First-time contributors receive a welcome message**
- **Bug reports** missing key information will receive a helpful comment requesting details

### Bug Reports

When reporting a bug, please include:

- **Clear title** describing the issue
- **Steps to reproduce** the problem
- **Kibana version** (e.g., 8.10.0)
- **Browser version** (e.g., Chrome 119)
- **Expected vs actual behavior**
- **Screenshots** if applicable
- **Error messages** from the browser console (F12)

Example:

```
Title: Dashboard export fails in Kibana 8.10

**Describe the bug**
When I click the export button on a dashboard page, nothing happens.

**Steps to reproduce**
1. Navigate to a dashboard in Kibana 8.10
2. Click the extension icon
3. Click "Export"
4. No download occurs

**Environment**
- Kibana: 8.10.0
- Chrome: 119.0.6045.199
- OS: macOS 14

**Console errors**
Error: Export failed: 403 Forbidden - Insufficient privileges
```

### Feature Requests

For feature requests, please describe:

- **What you want to achieve** (the use case)
- **Why it would be useful** (the motivation)
- **How it might work** (optional suggestions)

## Code Contributions

### Code Style

- Use **consistent indentation** (2 spaces)
- Add **comments** for complex logic
- Follow **existing code patterns**
- Keep functions **small and focused**

### Commit Messages

Write clear commit messages:

- Use present tense ("Add feature" not "Added feature")
- First line should be concise (50 chars or less)
- Add details in the body if needed

Good examples:
```
Add support for SLO export via alternative API

Fix panel detection on Kibana 8.11

Update documentation for dashboard export
```

### Pull Request Process

1. **Update documentation** if needed
2. **Test thoroughly** on multiple Kibana versions if possible
3. **Reference related issues** in your PR description
4. **Respond to review feedback** promptly
5. **Squash commits** if requested before merge

## Issue Labels

Our automated triage system uses these labels:

- `bug` - Something isn't working
- `enhancement` - New feature or improvement
- `documentation` - Documentation updates
- `question` - Questions from users
- `good first issue` - Great for newcomers
- `priority: high` - Needs urgent attention
- `export` - Export functionality
- `dashboard` - Dashboard-related
- `visualization` - Panel/visualization related
- `api` - API or backend issues
- `browser` - Browser compatibility
- `kibana-7.x` / `kibana-8.x` - Version-specific

## Manual Issue Triage

Maintainers can use the triage CLI for manual triage:

```bash
# Analyze an issue
cd .github/scripts
npm install
node triage-cli.js analyze 42

# Suggest and apply labels
node triage-cli.js suggest 42 --apply

# Batch triage recent issues
node triage-cli.js batch 20 --apply
```

## Questions?

Feel free to:
- Open an issue with the `question` label
- Start a discussion in the Discussions tab
- Reach out to maintainers

We appreciate your contributions! 🎉
