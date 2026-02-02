# Release Process

This project uses GitHub Actions to automate releases. When you push a version tag, the workflow automatically builds and packages the Chrome extension.

## Creating a Release

1. **Update the version in `manifest.json`**
   ```bash
   # Edit manifest.json and update the version field
   # Example: "version": "1.0.1"
   ```

2. **Commit the version change**
   ```bash
   git add manifest.json
   git commit -m "Bump version to 1.0.1"
   ```

3. **Create and push a git tag**
   ```bash
   # Tag format: v{MAJOR}.{MINOR}.{PATCH}
   git tag v1.0.1
   git push origin v1.0.1
   ```

4. **GitHub Actions will automatically:**
   - Package the extension as a ZIP file
   - Generate a changelog from git commits
   - Create a GitHub Release with the packaged extension
   - Upload the extension as a downloadable artifact

## What Gets Packaged

The release workflow packages the following files into the ZIP:
- `manifest.json`
- `background/` directory
- `content/` directory  
- `popup/` directory
- `sidepanel/` directory
- `README.MD`

Git files and macOS metadata (`.DS_Store`) are excluded.

## Release Naming

The packaged extension will be named: `kibana-as-code-v{VERSION}.zip`

Example: `kibana-as-code-v1.0.1.zip`

## Versioning

This project follows [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for new functionality in a backwards compatible manner
- **PATCH** version for backwards compatible bug fixes

## Troubleshooting

### Version Mismatch Warning

If the version in `manifest.json` doesn't match the git tag, the workflow will show a warning but will still create the release. Make sure to keep these in sync.

### Failed Release

If the release fails, check the GitHub Actions logs at:
`https://github.com/graphaelli/kb-ascode-browser/actions`

Common issues:
- Missing permissions (workflow needs `contents: write` permission)
- Invalid tag format (must be `v*.*.*`)
- Network issues during artifact upload
