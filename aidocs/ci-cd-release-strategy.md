# CI/CD and Release Strategy

## Overview

This document outlines the CI/CD pipeline and release strategy for the `wt` (Git Worktree Manager) project. The strategy focuses on automated quality checks, cross-platform binary generation, and streamlined releases.

## CI Pipeline (GitHub Actions)

### Quality Checks Workflow
**Trigger**: Every PR and push to `main` branch

**Jobs**:
1. **Lint Check**: Run ESLint on all TypeScript files
2. **Type Check**: Verify TypeScript compilation without emitting files
3. **Unit Tests**: Run all unit tests with Bun
4. **Integration Tests**: Run integration tests with real git operations
5. **Build Verification**: Ensure the project builds successfully

**Environment Setup**: 
- **Devbox**: Use devbox for consistent dependency management (Bun, Node.js, etc.)
- OS: Ubuntu (primary), with optional macOS/Windows for integration tests

### Workflow Benefits
- Fast feedback on code quality
- Prevents broken code from reaching main branch
- Ensures cross-platform compatibility
- Validates all test suites pass

## Release Strategy

### Recommended Approach: **GitHub Actions (Automated)**

**Why GitHub Actions over Local**:
1. **Consistency**: Same environment every time, no "works on my machine" issues
2. **Security**: GitHub-managed secrets for tokens and signing
3. **Auditability**: Full release history and logs
4. **Collaboration**: Team members can trigger releases without local setup
5. **Integration**: Native GitHub API access for releases and artifacts
6. **Reliability**: No dependency on developer's local environment or network

### Release Workflow

**Trigger**: Manual dispatch or git tag push (e.g., `v1.2.3`)

**Process**:
1. **Version Management**: 
   - Update `package.json` version
   - Create git tag
   - Generate changelog from commits

2. **Cross-Platform Build**:
   - Use devbox to ensure consistent Bun version and dependencies
   - Build binaries for all target platforms:
     - `wt-linux-x64`
     - `wt-linux-arm64` 
     - `wt-darwin-x64` (Intel Mac)
     - `wt-darwin-arm64` (Apple Silicon)
   - Generate checksums for all binaries
   - Create archive packages (tar.gz/zip)

3. **Release Creation**:
   - Create GitHub release with tag
   - Upload all binary artifacts
   - Include checksums file
   - Auto-generate release notes from commits
   - Mark as pre-release or stable

### Target Platforms & Binaries

| Platform | Architecture | Binary Name | Target Flag |
|----------|-------------|-------------|-------------|
| Linux | x64 | `wt-linux-x64` | `bun-linux-x64` |
| Linux | ARM64 | `wt-linux-arm64` | `bun-linux-arm64` |
| macOS | x64 (Intel) | `wt-darwin-x64` | `bun-darwin-x64` |
| macOS | ARM64 (Apple Silicon) | `wt-darwin-arm64` | `bun-darwin-arm64` |

### Release Versioning

**Semantic Versioning (SemVer)**:
- `MAJOR.MINOR.PATCH` (e.g., `1.2.3`)
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

**Pre-release**: `1.2.3-beta.1`, `1.2.3-rc.1`

### Release Triggers

1. **Manual Release**: 
   - Developer triggers workflow via GitHub UI
   - Specify version number and release type

2. **Tag-based Release**:
   - Push git tag matching pattern `v*.*.*`
   - Automatically triggers release workflow

## Implementation Files

### Required Files:
1. `.github/workflows/ci.yml` - Quality checks workflow (uses devbox)
2. `.github/workflows/release.yml` - Release automation workflow (uses devbox)
3. `scripts/build-all.sh` - Cross-platform build script
4. `scripts/release.sh` - Local release helper (optional)
5. `install.sh` - Installation script for end users
6. `docs/` - Documentation website (GitHub Pages) to host install.sh

### Devbox Integration:
All workflows will use devbox to ensure consistent environments:
- Use `jetify-com/devbox-install-action@v0.12.0` in GitHub Actions
- Automatic installation of Bun, Node.js, and other dependencies from `devbox.json`
- Reproducible builds across different CI runners
- Same environment locally and in CI
- Built-in caching for faster CI builds

**Example workflow step**:
```yaml
- name: Install devbox
  uses: jetify-com/devbox-install-action@v0.12.0
- name: Run tests
  run: devbox run test
```

### Package.json Scripts:
```json
{
  "scripts": {
    "build:all": "./scripts/build-all.sh",
    "build:linux-x64": "bun build --compile --minify --target=bun-linux-x64 src/index.ts --outfile dist/wt-linux-x64",
    "build:linux-arm64": "bun build --compile --minify --target=bun-linux-arm64 src/index.ts --outfile dist/wt-linux-arm64",
    "build:darwin-x64": "bun build --compile --minify --target=bun-darwin-x64 src/index.ts --outfile dist/wt-darwin-x64",
    "build:darwin-arm64": "bun build --compile --minify --target=bun-darwin-arm64 src/index.ts --outfile dist/wt-darwin-arm64"
  }
}
```

## Security Considerations

1. **GitHub Secrets**:
   - `GITHUB_TOKEN`: For creating releases (auto-provided)
   - Optional: Code signing certificates for binaries

2. **Permissions**:
   - Workflow needs `contents: write` for creating releases
   - `actions: read` for accessing workflow context

3. **Binary Verification**:
   - Generate SHA256 checksums for all binaries
   - Include checksums in release artifacts

## Distribution Strategy

### GitHub Releases (Primary)
- Official release channel
- All platforms and architectures
- Checksums and signatures
- Release notes and changelog

### Installation Script
**Simple Installation**: `install.sh` script for easy installation
- **Platform Auto-detection**: Automatically detects OS and architecture
- **Latest Version**: Downloads and installs the latest release by default
- **Customizable**: Environment variables for custom installation
  - `WT_INSTALL_PATH`: Custom installation directory (default: `~/.local/bin`)
  - `WT_INSTALL_VERSION`: Specific version to install (default: latest)
- **Hosted**: Available on official documentation website via GitHub Pages

**Usage Examples**:
```bash
# Install latest version to default location
curl -fsSL https://wt-docs.github.io/install.sh | sh

# Install to custom path
WT_INSTALL_PATH=/usr/local/bin curl -fsSL https://wt-docs.github.io/install.sh | sh

# Install specific version
WT_INSTALL_VERSION=v1.2.3 curl -fsSL https://wt-docs.github.io/install.sh | sh

# Both custom path and version
WT_INSTALL_PATH=/opt/bin WT_INSTALL_VERSION=v1.2.3 curl -fsSL https://wt-docs.github.io/install.sh | sh
```

**Script Features**:
- Platform detection (Linux x64/ARM64, macOS x64/ARM64)
- Checksum verification for security
- Automatic binary permissions setup
- PATH verification and guidance
- Error handling and user feedback
- Uninstall instructions

### Future Considerations
- **Package Managers**: Homebrew (macOS), Scoop (Windows), APT/YUM (Linux)
- **Container Images**: Docker Hub for containerized usage
- **NPM Package**: For Node.js ecosystem integration

## Rollback Strategy

1. **Failed Release**: Delete GitHub release and tag, fix issues, re-release
2. **Broken Binary**: Mark release as pre-release, upload fixed binaries
3. **Critical Bug**: Immediate patch release with hotfix

## Monitoring & Metrics

- **Download Statistics**: GitHub release download counts
- **Build Success Rate**: CI/CD pipeline success metrics
- **Release Frequency**: Track release cadence and patterns
- **Issue Correlation**: Link releases to bug reports and feature requests

## Next Steps

1. Implement CI workflow (`.github/workflows/ci.yml`)
2. Create release workflow (`.github/workflows/release.yml`)
3. Build cross-platform build scripts
4. Test release process with pre-release
5. Document release process for maintainers