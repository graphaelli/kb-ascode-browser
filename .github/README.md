# GitHub Actions & Issue Triage

This directory contains GitHub Actions workflows for automating repository maintenance and issue triage.

## Workflows

### 1. Issue Triage (`issue-triage.yml`)

Automatically triages new issues and pull requests using intelligent pattern matching and labeling.

**Triggers:**
- New issues opened
- Issues edited
- New comments on issues

**Features:**

- **Automatic Labeling**: Analyzes issue titles and descriptions to apply relevant labels:
  - `bug` - Detected bug reports
  - `enhancement` - Feature requests
  - `documentation` - Documentation-related issues
  - `question` - Questions from users
  - `export`, `dashboard`, `visualization`, `api`, `browser` - Component-specific labels
  - `kibana-7.x`, `kibana-8.x` - Version-specific labels
  - `priority: high` - High-priority issues
  - `good first issue` - Simple issues for newcomers

- **Bug Report Assistance**: Automatically comments on bug reports that are missing important information (steps to reproduce, Kibana version, browser version)

- **Welcome New Contributors**: Automatically welcomes first-time issue creators

**Example:**

When a user opens an issue with title "Dashboard export not working in Kibana 8.10", the workflow will:
1. Add labels: `bug`, `export`, `dashboard`, `kibana-8.x`
2. If missing information, request: steps to reproduce, browser version, etc.
3. If it's the user's first issue, post a welcome message

### 2. Sync Labels (`sync-labels.yml`)

Synchronizes repository labels from the configuration file.

**Triggers:**
- Push to main/master branch modifying `.github/labels.yml`
- Manual trigger via workflow_dispatch

**Features:**
- Creates new labels defined in `labels.yml`
- Updates existing labels with new descriptions or colors
- Ensures consistent labeling across the repository

## Label Configuration

Labels are defined in `.github/labels.yml`. This file specifies:
- Label name
- Description
- Color (hex code without #)

To add a new label:
1. Edit `.github/labels.yml`
2. Add the new label configuration
3. Push to main branch or manually trigger the sync workflow

## Usage with Cursor CLI

For manual triage using Cursor's AI capabilities:

```bash
# Analyze an issue
gh issue view <issue_number> | cursor analyze-issue

# Suggest labels for an issue
gh issue view <issue_number> --json title,body | cursor suggest-labels

# Bulk triage recent issues
gh issue list --limit 10 --json number,title,body | cursor triage-batch
```

Note: These commands require Cursor CLI to be installed and configured.

## Customization

### Adding New Label Rules

Edit `.github/workflows/issue-triage.yml` and add detection logic:

```javascript
// Example: detect performance issues
if (title.includes('slow') || title.includes('performance') || 
    body.includes('performance') || body.includes('takes too long')) {
  labels.push('performance');
}
```

Don't forget to add the corresponding label to `.github/labels.yml`:

```yaml
- name: performance
  description: Performance-related issues
  color: fef2c0
```

### Adjusting Auto-Comments

Modify the comment templates in `issue-triage.yml` to customize the messages sent to users.

## Troubleshooting

### Workflow Not Running

1. Check that the workflow file has no syntax errors
2. Verify repository settings allow Actions to run
3. Check the Actions tab for error messages

### Labels Not Being Applied

1. Verify the `GITHUB_TOKEN` has `issues: write` permission
2. Check the workflow logs for label detection output
3. Ensure label names in the workflow match `labels.yml`

## Future Enhancements

Potential improvements for the triage system:

- [ ] Integration with Cursor Cloud Agents for deeper issue analysis
- [ ] Automatic assignment based on issue type
- [ ] Detection of duplicate issues
- [ ] Automatic milestone assignment
- [ ] Integration with project boards
- [ ] Sentiment analysis for issue prioritization
- [ ] Automatic issue templates suggestion
