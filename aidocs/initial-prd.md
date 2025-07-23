# WT - Git Worktree Manager
## Product Requirements Document

### Overview

**WT** is a compiled command-line tool built with Bun that provides an enhanced interface for managing Git worktrees. It simplifies the creation, switching, and management of worktrees while integrating seamlessly with GitHub CLI for PR-based workflows.

### Goals

- **Simplify worktree management** with intuitive commands and smart branch resolution
- **Enhance developer productivity** through fuzzy finding and automated workflows  
- **Integrate GitHub workflows** with seamless PR-to-worktree creation
- **Provide reliable tooling** with proper error handling and testing capabilities
- **Support team workflows** through configurable hooks and consistent setup

### Target Users

- Developers working on multiple features/branches simultaneously
- Teams doing code reviews requiring local testing
- Projects requiring frequent context switching between branches
- Developers using the bare repository + worktree folder structure

### Core Functionality

#### 1. Smart Worktree Creation (`wt create <branch>`)

**Behavior:**
1. **Local branch exists**: Create worktree using existing branch (warn if potentially outdated)
2. **Remote branch exists**: Fetch latest, create local tracking branch, create worktree
3. **Neither exists**: Create new branch from current HEAD, create worktree

**Technical Requirements:**
- Auto-fetch before branch resolution (configurable)
- Proper upstream tracking for remote branches
- Clear warnings for existing local branches
- Support for branch names with special characters

#### 2. Fuzzy Switching (`wt [pattern]`)

**Behavior:**
- No arguments: Show interactive fuzzy finder for all worktrees
- With pattern: Filter worktrees matching pattern, switch if single match
- Integration with `fzf` or built-in fuzzy matching

**Technical Requirements:**
- Fast worktree discovery and listing
- Cross-platform terminal integration
- Graceful fallback if fuzzy finder unavailable

#### 3. PR Integration (`wt pr <pr-number>`)

**Behavior:**
- Use GitHub CLI to fetch PR details
- Extract source branch name from PR
- Create worktree using same logic as `wt create <branch>`

**Technical Requirements:**
- Dependency on GitHub CLI (`gh`)
- Proper error handling for invalid PR numbers
- Support for cross-repository PRs (fail gracefully)

#### 4. Command Execution (`wt run <branch> <command...>`)

**Behavior:**
- Create worktree for `<branch>` if it doesn't exist
- Execute `<command>` in the worktree directory
- Preserve command exit codes and output

**Technical Requirements:**
- Process spawning with proper signal handling
- Environment variable inheritance
- Working directory management

#### 5. Repository Setup (`wt init <git-url> [name]`)

**Behavior:**
- Clone repository as bare into `.bare/` directory
- Create `.git` file with `gitdir: ./.bare`
- Configure remote fetch refspec for worktree compatibility
- Perform initial fetch of all remote branches

**Technical Requirements:**
- URL validation and parsing
- Proper bare repository configuration
- Error handling for network issues

### Technical Architecture

#### Technology Stack
- **Runtime**: Bun (for single binary compilation)
- **Language**: TypeScript
- **Dependencies**: 
  - Git (system requirement)
  - GitHub CLI (optional, for PR features)
  - fzf (optional, for enhanced fuzzy finding)

#### Repository Detection
Walk up directory tree looking for:
1. `.bare/` directory (bare repo setup)
2. `.git` file containing `gitdir: ./.bare`
3. Standard `.git` directory (fallback support)

#### Configuration System

**Location**: `.wtconfig.json` in repository root (beside `.bare/`)

**Schema**:
```json
{
  "worktreeDir": "./",           // Relative to .bare parent
  "autoFetch": true,             // Fetch before create operations  
  "confirmDelete": false,        // Confirm before removing worktrees
  "hooks": {
    "postCreate": null,          // Executable path or null
    "postRemove": null           // Executable path or null  
  },
  "defaultBranch": "main"        // Fallback default branch
}
```

#### Hook System
- Execute after successful worktree creation/removal
- Pass worktree path and branch name as arguments
- Support any executable (shell scripts, binaries, etc.)
- Fail silently if hook not found or not executable

### Command Reference

```bash
# Primary commands
wt [pattern]                     # Fuzzy switch to worktree
wt create <branch>              # Create worktree with smart branch resolution
wt pr <pr-number>               # Create worktree from GitHub PR  
wt run <branch> <command...>    # Create worktree + run command
wt remove [pattern] [--with-branch]  # Remove worktree, optionally local branch
wt list                         # List worktrees with status
wt switch [pattern]             # Explicit alias for default behavior

# Repository management  
wt init <git-url> [name]        # Initialize bare repo for worktrees
wt status                       # Show repository and worktree status
wt clean                        # Remove stale/orphaned worktrees

# Configuration
wt config                       # Show current configuration  
wt config <key>                 # Show specific config value
wt config <key> <value>         # Set config value
```

### Error Handling

#### Exit Codes
- `0`: Success
- `1`: General error
- `2`: Invalid arguments
- `3`: Git repository not found
- `4`: Network/GitHub API errors
- `5`: File system errors

#### Error Messages
- Clear, actionable error descriptions
- Suggestions for resolution when possible
- Preserve underlying Git/GitHub CLI error details
- Consistent formatting across all commands

### Development Setup

#### Development Environment Management
The project uses [Devbox](https://www.jetpack.io/devbox) for reproducible development environments and dependency management.

**Required Configuration** (`devbox.json`):
```json
{
  "packages": [
    "bun@latest",
    "git@latest", 
    "gh@latest",
    "fzf@latest"
  ],
  "shell": {
    "init_hook": [
      "echo 'WT development environment ready!'",
      "bun install"
    ],
    "scripts": {
      "test": "bun test",
      "test:unit": "bun test unit/",
      "test:integration": "bun test integration/",
      "build": "bun build --compile --minify --sourcemap --target bun src/index.ts --outfile wt",
      "dev": "bun run src/index.ts",
      "lint": "bun run eslint src/ tests/",
      "type-check": "bun run tsc --noEmit"
    }
  },
  "env": {
    "NODE_ENV": "development"
  }
}
```

**Developer Workflow**:
```bash
# Setup development environment
devbox shell

# Install dependencies  
bun install

# Run in development mode
bun run dev

# Run tests
bun run test

# Build binary
bun run build
```

**Project Structure**:
```
wt/
├── devbox.json               # Development environment configuration
├── package.json              # Bun dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── src/                     # Source code
├── tests/                   # Test files
├── docs/                    # Documentation
└── README.md
```

### Installation & Distribution

#### Installation Methods
- Download compiled binary from GitHub releases
- Package managers (Homebrew, npm, etc.)
- Build from source with Bun

#### System Requirements
- Git 2.5+ (for worktree support)
- GitHub CLI (optional, for PR features)
- Unix-like system (Linux, macOS, WSL)

### Future Enhancements

#### V1.1 Potential Features
- `wt open <pattern>` - Open worktree in configured editor
- `wt sync` - Update all worktrees from their upstreams
- `wt archive <pattern>` - Archive completed worktrees
- Enhanced status display with branch ahead/behind info
- Template system for new repository initialization

#### Advanced Features  
- Integration with other Git hosting platforms (GitLab, Bitbucket)
- Worktree dependency management (shared node_modules, etc.)
- Team configuration sharing
- Git hooks integration for automated testing

### Testing Strategy

#### Unit Testing
**Scope**: Core logic, utility functions, configuration management

**Approach**:
- Mock git and GitHub CLI interfaces for isolated testing
- Test branch resolution logic with various scenarios
- Validate configuration parsing and validation
- Test error handling and edge cases

**Tools**: Bun's built-in test runner, mock interfaces for external commands

#### Integration Testing  
**Scope**: End-to-end workflows with real git operations

**Repository Structure**:
```
wt/
├── src/                    # Source code
├── tests/
│   ├── unit/              # Unit tests with mocks
│   ├── integration/       # Integration tests with real git operations
│   └── fixtures/          # Pre-made test repositories and configurations
├── temp/                  # Temporary test repositories (gitignored)
├── docs/
└── package.json
```

**Testing Strategy**:
- **Self-testing**: Use WT's own repository for basic integration tests (repository detection, listing)
- **Temporary repositories**: Generate fresh repos for isolated test scenarios
- **Fixture repositories**: Small pre-made repositories for specific test cases

**Test Scenarios**:
```bash
# Core worktree operations
- wt init with real GitHub repository
- wt create with local/remote/new branch scenarios  
- wt switch between multiple worktrees
- wt remove with and without --with-branch
- Repository detection from various directory levels

# GitHub integration (requires authentication)
- wt pr with test PRs from WT repository itself
- Error handling for invalid PR numbers
- Mock GitHub CLI responses for predictable testing

# Advanced workflows
- wt run with various commands
- Hook execution and error handling
- Configuration file management
```

**Temporary Repository Creation**:
```typescript
// Example integration test setup
const tempRepo = await createTempRepo({
  branches: ['main', 'feature-1', 'feature-2'], 
  commits: 5,
  remotes: ['origin'],
  bareSetup: true  // Create with .bare structure
})

// Run tests against temporary repository
// Automatic cleanup after test completion
```

**CI/CD Integration**:
```yaml
# .github/workflows/test.yml
- name: Setup Git for Testing
  run: |
    git config --global user.name "Test User"
    git config --global user.email "test@example.com"

- name: Integration Tests
  run: bun test integration/
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Mock Strategy for GitHub CLI**:
- Mock `gh pr view` responses for predictable PR testing
- Test both success and error scenarios  
- Use real PRs from WT repository for select integration tests
- Validate command arguments passed to GitHub CLI

#### Performance Testing
- Benchmark worktree creation/switching times
- Test with repositories containing many worktrees (50+)
- Memory usage profiling for large repositories

#### Compatibility Testing  
- Multiple Git versions (2.5+)
- Different operating systems (Linux, macOS, Windows/WSL)
- Various repository structures (bare, standard, submodules)

### Success Metrics

- **Adoption**: GitHub stars, download counts
- **Usability**: Issue reports related to confusing behavior
- **Performance**: Command execution time benchmarks
- **Reliability**: Error rate and crash reports
- **Test Coverage**: >90% unit test coverage, comprehensive integration test suite

### Risks & Mitigations

#### Technical Risks
- **Bun ecosystem maturity**: Monitor Bun stability, maintain Node.js compatibility path
- **Cross-platform compatibility**: Extensive testing on all target platforms
- **Git version compatibility**: Test against minimum supported Git versions

#### User Experience Risks  
- **Learning curve**: Comprehensive documentation and examples
- **Integration complexity**: Clear setup instructions and troubleshooting guides
- **Breaking changes**: Semantic versioning and migration guides

### Development Phases

#### Phase 1: Core MVP
- `wt create`, `wt switch`, `wt list`, `wt remove`
- Basic repository detection
- Configuration system
- Unit and integration tests

#### Phase 2: GitHub Integration  
- `wt pr` command
- GitHub CLI integration
- Enhanced error handling

#### Phase 3: Advanced Features
- `wt run` command  
- Hook system
- `wt init` and repository setup
- Performance optimizations

#### Phase 4: Polish & Distribution
- Comprehensive documentation
- Installation packages
- Community feedback integration
