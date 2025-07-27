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

#### 2. Worktree Path Resolution (`wt print-dir [pattern]`)

**Behavior:**
- Find worktree matching pattern using fuzzy search
- Print absolute directory path to stdout
- Used internally by shell wrapper functions for directory switching
- Can be used directly in scripts for path resolution

**Technical Requirements:**
- Fast worktree discovery and listing
- Pattern matching for worktree selection
- Clean stdout output for shell function consumption
- Proper error handling for non-existent worktrees

#### 3. Shell Integration & Switching (`wt setup --shell`)

**Behavior:**
- Generate shell wrapper functions for bash/zsh/fish
- Enable directory switching via `wt switch` and `wt sw` aliases
- Provide ultra-short `wts` convenience function
- Handle shell-specific syntax differences

**Technical Requirements:**
- Shell detection and appropriate function generation
- Clean integration with existing shell configurations
- Fallback to direct command execution for non-switch operations
- Error handling that preserves original command behavior

#### 4. PR Integration (`wt pr <pr-number>`)

**Behavior:**
- Use GitHub CLI to fetch PR details
- Extract source branch name from PR
- Create worktree using same logic as `wt create <branch>`

**Technical Requirements:**
- Dependency on GitHub CLI (`gh`)
- Proper error handling for invalid PR numbers
- Support for cross-repository PRs (fail gracefully)

#### 5. Command Execution (`wt run <branch> <command...>`)

**Behavior:**
- Create worktree for `<branch>` if it doesn't exist
- Execute `<command>` in the worktree directory
- Preserve command exit codes and output

**Technical Requirements:**
- Process spawning with proper signal handling
- Environment variable inheritance
- Working directory management

#### 6. Repository Setup (`wt init <git-url> [name]`)

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
- **Architecture**: Dependency injection with service container pattern
- **Dependencies**: 
  - Git (system requirement)
  - GitHub CLI (optional, for PR features)

#### Service Architecture
WT uses a lightweight dependency injection system for better testability and maintainability:

**Core Services**:
- `LoggerService`: Handles all console output (log, error, warn, info, debug)
- `GitService`: Executes git commands and operations
- `FileSystemService`: File system operations (read, write, access, stat, etc.)
- `CommandService`: Non-git command execution

**Service Container Pattern**:
```typescript
// Production services (uses real implementations)
const services = createServiceContainer();

// Test services (uses mock implementations)
const testServices = await createTestServiceContainer();

// Custom service mix
const customServices = createServiceContainer({
  logger: new SilentLoggerService(), // Silent for tests
  git: new MockGitService()          // Mock for controlled responses
});
```

**Benefits**:
- **Testable Output**: Can verify exact user messages in tests
- **Isolated Testing**: No dangerous global mocks that break subprocess execution
- **Flexible Logging**: Easy to switch to file logging, structured logging, etc.
- **Error Tracking**: Centralized error handling and logging
- **Extensibility**: Easy to add new service types (HTTP, database, etc.)

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
  "worktreeDir": "./",           // Auto-detected from existing worktrees if not set
  "autoFetch": true,             // Fetch before create operations  
  "confirmDelete": false,        // Confirm before removing worktrees
  "hooks": {
    "postCreate": null,          // Executable path or null
    "postRemove": null           // Executable path or null  
  },
  "defaultBranch": "main"        // Fallback default branch
}
```

#### Smart WorktreeDir Detection

The `worktreeDir` configuration uses intelligent auto-detection to determine the optimal location for new worktrees:

**Detection Algorithm**:
1. **Multiple worktrees exist**: Analyzes all existing worktrees using `git worktree list` and finds their common parent directory
2. **Single worktree exists**: Uses the parent directory of the existing worktree
3. **No additional worktrees**: Falls back to repository root (`./`)
4. **Git command failure**: Safe fallback to repository root (`./`)

**Examples**:
```bash
# Scenario 1: Bare repository with worktrees as siblings
/project/
  .bare/           # Bare repository
  main/            # Main worktree  
  feature-1/       # Additional worktree
# Result: worktreeDir = "./" (relative to /project/)

# Scenario 2: Bare repository with organized worktree directory
/project/
  .bare/           # Bare repository
  worktrees/
    main/          # Main worktree
    feature-1/     # Additional worktree
# Result: worktreeDir = "./worktrees/" (relative to /project/)

# Scenario 3: Standard git repository
/project/.git/     # Standard git directory
# Result: worktreeDir = "./" (repository root)
```

**User Override**: Users can explicitly set `worktreeDir` in `.wtconfig.json` to override auto-detection for custom workflows.

#### Hook System
- Execute after successful worktree creation/removal
- Pass worktree path and branch name as arguments
- Support any executable (shell scripts, binaries, etc.)
- Fail silently if hook not found or not executable

### Command Reference

```bash
# Primary commands
wt create <branch>                   # Create worktree with smart branch resolution
wt print-dir [pattern]               # Print directory path of matching worktree
wt remove [pattern] [--with-branch]  # Remove worktree, optionally local branch
wt list                              # List worktrees with status

# Shell integration (after setup)
wt switch [pattern]                  # Switch to worktree (shell function only)
wt sw [pattern]                      # Short alias for switch (shell function only)
wts [pattern]                        # Ultra-short convenience alias

# GitHub & workflow commands
wt pr <pr-number>                    # Create worktree from GitHub PR  
wt run <branch> <command...>         # Create worktree + run command

# Repository management  
wt init <git-url> [name]             # Initialize bare repo for worktrees
wt setup --bash|--zsh|--fish|--auto  # Generate shell wrapper functions
wt status                            # Show repository and worktree status
wt clean                             # Remove stale/orphaned worktrees

# Configuration
wt config                            # Show current configuration  
wt config <key>                      # Show specific config value
wt config <key> <value>              # Set config value
```

### Shell Integration Setup

To enable directory switching functionality, add this line to your shell configuration:

```bash
# Add to ~/.bashrc, ~/.zshrc, or ~/.config/fish/config.fish
source <(wt setup --bash)   # or --zsh, --fish, --auto
```

This enables the shell wrapper functions that provide seamless directory switching:
- `wt switch [pattern]` - Switch to matching worktree
- `wt sw [pattern]` - Short alias for switch  
- `wts [pattern]` - Ultra-short convenience alias

**Note**: The `switch` and `sw` commands only exist in the shell wrapper functions and use `wt print-dir` internally to resolve paths.

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
    "gh@latest"
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
- Interactive fuzzy selection for `wt print-dir` (fzf integration)

#### Advanced Features  
- Integration with other Git hosting platforms (GitLab, Bitbucket)
- Worktree dependency management (shared node_modules, etc.)
- Team configuration sharing
- Git hooks integration for automated testing

### Testing Strategy

For every development phase, we implement both unit tests and integration tests using the dependency injection architecture:

#### Unit Testing with Service Injection
**Scope**: Core logic, utility functions, configuration management  
**Coverage Goal**: Full coverage (100%) wherever possible

**Approach**:
- **Service Injection**: Use mock services instead of dangerous global mocks
- **Isolated Testing**: Each unit test focuses on a single function or module with controlled dependencies
- **Edge Case Coverage**: Test all error conditions, boundary cases, and invalid inputs
- **Branch Resolution Logic**: Comprehensive testing of all branch scenarios (local, remote, new)
- **Configuration Management**: Test all config variations, validation, and error handling
- **Error Handling**: Test every error path and exit code scenario

**Service Injection Strategy**:
```typescript
// Safe service injection for predictable testing
const mockLogger = new MockLoggerService();
const mockGit = new MockGitService();
const services = createServiceContainer({
  logger: mockLogger,
  git: mockGit
});

// Configure mock responses
mockGit.setCommandResponse(['worktree', 'list'], 'main /path/to/main');
mockGit.setCommandResponse(['branch', '-a'], 'main\n  remotes/origin/main');

// Test and verify behavior
const result = await someFeature(services);
expect(mockLogger.hasLog('log', 'Expected message')).toBe(true);
expect(mockGit.getExecutedCommands()).toContain(['worktree', 'add', ...]);
```

**Tools**: Bun's built-in test runner with service injection pattern

#### Integration Testing with Real Services
**Scope**: End-to-end workflows with real git operations  
**Focus**: Main functionality and most commonly used scenarios

**Repository Structure**:
```
wt/
├── src/                    # Source code
│   ├── services/          # Service interfaces and implementations
│   │   ├── implementations/     # Real service implementations
│   │   ├── test-implementations/ # Mock services for testing
│   │   └── container.ts         # Service container factory
├── tests/
│   ├── unit/              # Unit tests with service injection
│   ├── integration/       # Integration tests with real services
│   └── fixtures/          # Pre-made test repositories and configurations
├── temp/                  # Temporary test repositories (gitignored)
├── docs/
└── package.json
```

**Testing Philosophy**:
- **Real Services**: Use actual service implementations for integration tests
- **Common Scenarios**: Focus on workflows developers use daily
- **End-to-End Validation**: Test complete user journeys with real dependencies
- **Realistic Environments**: Test with various repository structures and states
- **No Global Mocks**: Avoid dangerous module mocks that break subprocess execution

**Key Integration Scenarios**:
```bash
# Core worktree workflows (most commonly used)
- wt create → wt switch → wt remove cycle
- Repository detection across directory structures
- Configuration loading and auto-detection
- Multi-worktree repository management
- Shell integration setup and function generation

# GitHub integration (common developer workflow)  
- wt pr → work → merge workflow
- Error handling for invalid PRs and network issues

# Advanced but common scenarios
- Hook execution during worktree lifecycle
- Repository initialization and setup
- Command execution in worktree context
- Shell wrapper function testing across different shells
```

**Service-Based Testing Utilities**:
```typescript
// Create test services for unit tests
const testServices = await createTestServiceContainer();

// Create real services for integration tests
const realServices = createServiceContainer();

// Create custom service mix
const customServices = createServiceContainer({
  logger: new SilentLoggerService(), // Silent for tests
  git: new MockGitService()          // Mock for controlled responses
});

// Utilities for creating realistic test scenarios
const tempRepo = await createTempRepo({
  branches: ['main', 'feature-1', 'feature-2'], 
  commits: 5,
  remotes: ['origin'],
  bareSetup: true,  // Create with .bare structure
  worktrees: ['main', 'feature-1'],  // Pre-create worktrees
  config: { autoFetch: false }  // Custom configuration
})

// Automatic cleanup ensures no test pollution
// Each test gets a fresh, isolated environment
```

**CI/CD Integration**:
```yaml
# .github/workflows/test.yml
- name: Setup Git for Testing
  run: |
    git config --global user.name "Test User"
    git config --global user.email "test@example.com"

- name: Unit Tests (Full Coverage)
  run: bun test unit/ --coverage
  
- name: Integration Tests (Common Scenarios)
  run: bun test integration/
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Phase-Based Testing Requirements**:
- **Every Phase**: Unit tests with full coverage of new functionality
- **Every Phase**: Integration tests for user-facing features
- **Pre-Commit**: All tests must pass, lint and type-check must succeed
- **No Moving Forward**: Until all tests pass and coverage targets are met

#### Performance Testing
- Benchmark worktree creation/switching times with large repositories
- Test with repositories containing many worktrees (50+)
- Memory usage profiling for large repositories
- Response time validation for fuzzy finding operations

#### Compatibility Testing  
- Multiple Git versions (2.5+)
- Different operating systems (Linux, macOS, Windows/WSL)  
- Various repository structures (bare, standard, submodules)
- Different terminal environments and shells

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
- `wt create`, `wt print-dir`, `wt list`, `wt remove`
- Basic repository detection
- Configuration system
- Shell integration setup (`wt setup --shell`)
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
