#!/usr/bin/env node

/**
 * Issue Triage CLI Tool
 * 
 * A command-line tool for triaging GitHub issues with AI assistance.
 * Can be used manually or integrated with Cursor workflows.
 * 
 * Usage:
 *   node triage-cli.js analyze <issue-number>
 *   node triage-cli.js suggest <issue-number>
 *   node triage-cli.js batch [limit]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read labels configuration
function loadLabels() {
  const labelsPath = path.join(__dirname, '..', 'labels.yml');
  if (fs.existsSync(labelsPath)) {
    const yaml = require('js-yaml');
    const config = yaml.load(fs.readFileSync(labelsPath, 'utf8'));
    return config.labels.map(l => l.name);
  }
  return [];
}

// Analyze issue and suggest labels
function analyzeIssue(issueData) {
  const title = (issueData.title || '').toLowerCase();
  const body = (issueData.body || '').toLowerCase();
  const labels = [];

  // Feature requests
  if (title.includes('feature') || title.includes('enhancement') || 
      body.includes('it would be nice') || body.includes('could you add')) {
    labels.push('enhancement');
  }

  // Bug reports
  if (title.includes('bug') || title.includes('error') || title.includes('broken') ||
      title.includes('not working') || title.includes('issue') || title.includes('fail')) {
    labels.push('bug');
  }

  // Documentation
  if (title.includes('doc') || title.includes('readme') || 
      body.includes('documentation')) {
    labels.push('documentation');
  }

  // Questions
  if (title.includes('how to') || title.includes('question') || title.startsWith('?')) {
    labels.push('question');
  }

  // Component detection
  const components = {
    'export': /export|download/,
    'dashboard': /dashboard/,
    'visualization': /visualization|panel|lens/,
    'api': /api|endpoint|request/,
    'browser': /chrome|browser/,
  };

  for (const [label, pattern] of Object.entries(components)) {
    if (pattern.test(title) || pattern.test(body)) {
      labels.push(label);
    }
  }

  // Version detection
  if (body.match(/kibana\s*8/i)) {
    labels.push('kibana-8.x');
  } else if (body.match(/kibana\s*7/i)) {
    labels.push('kibana-7.x');
  }

  // Priority
  if (title.includes('critical') || title.includes('urgent') || 
      body.includes('production') || body.includes('blocker')) {
    labels.push('priority: high');
  }

  return {
    labels,
    confidence: labels.length > 0 ? 'high' : 'low',
    suggestions: generateSuggestions(title, body, labels),
  };
}

// Generate helpful suggestions
function generateSuggestions(title, body, labels) {
  const suggestions = [];

  if (labels.includes('bug')) {
    if (!body.includes('steps') && !body.includes('reproduce')) {
      suggestions.push('Request steps to reproduce');
    }
    if (!body.includes('version') && !body.includes('kibana')) {
      suggestions.push('Request Kibana version');
    }
    if (!body.includes('chrome') && !body.includes('browser')) {
      suggestions.push('Request browser version');
    }
  }

  if (labels.includes('enhancement')) {
    if (!body.includes('use case') && !body.includes('why')) {
      suggestions.push('Request use case or motivation');
    }
  }

  if (labels.length === 0) {
    suggestions.push('Issue needs more context to categorize');
  }

  return suggestions;
}

// Get issue from GitHub
function getIssue(issueNumber) {
  try {
    const output = execSync(
      `gh issue view ${issueNumber} --json title,body,number,author,labels`,
      { encoding: 'utf8' }
    );
    return JSON.parse(output);
  } catch (error) {
    console.error('Error fetching issue:', error.message);
    process.exit(1);
  }
}

// Get multiple issues
function getIssues(limit = 10) {
  try {
    const output = execSync(
      `gh issue list --limit ${limit} --json number,title,body,labels,author`,
      { encoding: 'utf8' }
    );
    return JSON.parse(output);
  } catch (error) {
    console.error('Error fetching issues:', error.message);
    process.exit(1);
  }
}

// Apply labels to issue
function applyLabels(issueNumber, labels) {
  if (labels.length === 0) return;
  
  try {
    execSync(
      `gh issue edit ${issueNumber} --add-label "${labels.join(',')}"`,
      { encoding: 'utf8', stdio: 'inherit' }
    );
    console.log(`✓ Applied labels to #${issueNumber}: ${labels.join(', ')}`);
  } catch (error) {
    console.error(`✗ Error applying labels to #${issueNumber}:`, error.message);
  }
}

// Command: analyze
function cmdAnalyze(issueNumber) {
  console.log(`\nAnalyzing issue #${issueNumber}...\n`);
  
  const issue = getIssue(issueNumber);
  const analysis = analyzeIssue(issue);
  
  console.log(`Title: ${issue.title}`);
  console.log(`Author: ${issue.author.login}`);
  console.log(`\nSuggested Labels (${analysis.confidence} confidence):`);
  
  if (analysis.labels.length > 0) {
    analysis.labels.forEach(label => console.log(`  - ${label}`));
  } else {
    console.log('  (none)');
  }
  
  if (analysis.suggestions.length > 0) {
    console.log('\nSuggestions:');
    analysis.suggestions.forEach(s => console.log(`  • ${s}`));
  }
  
  console.log('');
}

// Command: suggest (with auto-apply option)
function cmdSuggest(issueNumber, autoApply = false) {
  const issue = getIssue(issueNumber);
  const analysis = analyzeIssue(issue);
  
  console.log(`\nIssue #${issueNumber}: ${issue.title}`);
  console.log(`Suggested labels: ${analysis.labels.join(', ') || '(none)'}`);
  
  if (autoApply && analysis.labels.length > 0) {
    const existingLabels = issue.labels.map(l => l.name);
    const newLabels = analysis.labels.filter(l => !existingLabels.includes(l));
    
    if (newLabels.length > 0) {
      applyLabels(issueNumber, newLabels);
    } else {
      console.log('  (all labels already applied)');
    }
  }
}

// Command: batch triage
function cmdBatch(limit = 10, autoApply = false) {
  console.log(`\nTriaging last ${limit} issues...\n`);
  
  const issues = getIssues(limit);
  const results = [];
  
  for (const issue of issues) {
    const analysis = analyzeIssue(issue);
    results.push({
      number: issue.number,
      title: issue.title,
      labels: analysis.labels,
      existing: issue.labels.map(l => l.name),
    });
  }
  
  // Display results
  console.log('Triage Results:\n');
  for (const result of results) {
    const newLabels = result.labels.filter(l => !result.existing.includes(l));
    console.log(`#${result.number}: ${result.title}`);
    console.log(`  Existing: ${result.existing.join(', ') || '(none)'}`);
    console.log(`  Suggested: ${newLabels.join(', ') || '(none)'}`);
    
    if (autoApply && newLabels.length > 0) {
      applyLabels(result.number, newLabels);
    }
    console.log('');
  }
}

// Main CLI
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(`
Issue Triage CLI

Usage:
  triage-cli.js analyze <issue-number>
      Analyze an issue and show suggested labels

  triage-cli.js suggest <issue-number> [--apply]
      Suggest labels for an issue (optionally apply them)

  triage-cli.js batch [limit] [--apply]
      Triage multiple recent issues (default: 10)

Examples:
  node triage-cli.js analyze 42
  node triage-cli.js suggest 42 --apply
  node triage-cli.js batch 20 --apply
    `);
    process.exit(0);
  }
  
  switch (command) {
    case 'analyze':
      if (!args[1]) {
        console.error('Error: Issue number required');
        process.exit(1);
      }
      cmdAnalyze(args[1]);
      break;
      
    case 'suggest':
      if (!args[1]) {
        console.error('Error: Issue number required');
        process.exit(1);
      }
      cmdSuggest(args[1], args.includes('--apply'));
      break;
      
    case 'batch':
      const limit = parseInt(args[1]) || 10;
      cmdBatch(limit, args.includes('--apply'));
      break;
      
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run with --help for usage information');
      process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { analyzeIssue, generateSuggestions };
