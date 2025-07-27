# WT - Git Worktree Manager

A fast, intuitive command-line tool for managing Git worktrees with smart branch resolution and GitHub integration.

## Features

- **Smart worktree creation** - Automatically handles local, remote, and new branches
- **Directory switching** - Switch between worktrees with shell integration
- **GitHub PR integration** - Create worktrees directly from pull requests
- **Command execution** - Run commands in specific worktree contexts
- **Repository initialization** - Set up bare repositories optimized for worktrees
- **Configurable workflows** - Customize behavior with hooks and settings

## Quick Start

### Installation

1. **Prerequisites**
   - Git 2.5+ (for worktree support)
   - [Devbox](https://www.jetpack.io/devbox) (for development)
   - GitHub CLI (optional, for PR features)

2. **Development Setup**
   ```bash
   # Clone and enter development environment
   git clone <repository-url>
   cd wt
   devbox shell
   
   # Dependencies are automatically installed
   # Run the tool in development mode
   bun run dev --help
   ```

3. **Build Binary**
   ```bash
   # Create production binary
   bun run build
   
   # Use the binary
   ./wt --help
   ```

### Basic Usage

```bash
# Shell integration setup (one-time)
source <(wt setup --bash)       # Add to ~/.bashrc
# source <(wt setup --zsh)      # Add to ~/.zshrc  
# source <(wt setup --fish)     # Add to ~/.config/fish/config.fish

# Create worktree with smart branch resolution
wt create feature-branch

# Switch to worktree (requires shell integration)
wt switch feat                 # Fuzzy matches feature-branch
wt sw feat                     # Short alias
wts feat                       # Ultra-short alias

# Get worktree directory path (for scripts)
wt print-dir feature-branch

# Create worktree from GitHub PR
wt pr 123

# Run command in specific branch context
wt run main "npm test"

# List all worktrees
wt list

# Remove worktree (optionally with branch)
wt remove feature-branch --with-branch
```

### Repository Setup

WT works best with a bare repository structure:

```bash
# Initialize new repository for worktrees
wt init https://github.com/user/repo.git my-project

# Resulting structure:
my-project/
├── .bare/          # Bare git repository
├── .git            # Points to .bare directory
├── .wtconfig.json  # WT configuration
├── feature-1/      # Worktree directories
├── feature-2/
└── main/
```

## Configuration

WT automatically detects the optimal location for worktrees based on your repository structure. You can customize behavior with a `.wtconfig.json` file in your repository root:

```json
{
  "worktreeDir": "./",
  "autoFetch": true,
  "confirmDelete": false,
  "hooks": {
    "postCreate": "./scripts/setup-worktree.sh",
    "postRemove": null
  },
  "defaultBranch": "main"
}
```

### Smart WorktreeDir Detection

The `worktreeDir` setting uses intelligent auto-detection when not explicitly configured:

**Detection Logic**:
- **Multiple worktrees**: Finds the common parent directory of all existing worktrees
- **Single worktree**: Uses the parent directory of the existing worktree  
- **No additional worktrees**: Defaults to repository root
- **Manual override**: Set `worktreeDir` explicitly to override auto-detection

**Examples**:
```bash
# Scenario 1: Worktrees as siblings to .bare
/project/
  .bare/         # Bare repository
  main/          # Main worktree
  feature-1/     # Additional worktree
# Auto-detected worktreeDir: "./"

# Scenario 2: Organized worktree directory
/project/
  .bare/         # Bare repository  
  worktrees/
    main/        # Main worktree
    feature-1/   # Additional worktree
# Auto-detected worktreeDir: "./worktrees/"
```

This ensures new worktrees are created in the same location as existing ones, providing consistent project organization.

## Commands

### Core Commands
- `wt create <branch>` - Create worktree with smart branch resolution
- `wt print-dir [pattern]` - Print directory path of matching worktree
- `wt list` - List all worktrees with status
- `wt remove [pattern] [--with-branch]` - Remove worktree

### Shell Integration (after setup)
- `wt switch [pattern]` - Switch to worktree (shell function only)
- `wt sw [pattern]` - Short alias for switch (shell function only)  
- `wts [pattern]` - Ultra-short convenience alias

### GitHub Integration
- `wt pr <pr-number>` - Create worktree from GitHub PR

### Repository Management
- `wt init <git-url> [name]` - Initialize bare repository
- `wt setup --bash|--zsh|--fish|--auto` - Generate shell wrapper functions
- `wt status` - Show repository and worktree status
- `wt clean` - Remove orphaned worktrees

### Advanced
- `wt run <branch> <command...>` - Execute command in worktree
- `wt config` - Manage configuration
- `wt config <key>` - Show config value
- `wt config <key> <value>` - Set config value

## Shell Integration

To enable directory switching, WT provides shell wrapper functions that must be sourced into your shell:

### Setup (One-time)

Add this line to your shell configuration file:

```bash
# Bash: ~/.bashrc
source <(wt setup --bash)

# Zsh: ~/.zshrc  
source <(wt setup --zsh)

# Fish: ~/.config/fish/config.fish
source (wt setup --fish | psub)

# Auto-detect shell
source <(wt setup --auto)
```

### How It Works

1. **Direct Commands**: Commands like `wt create`, `wt list`, `wt print-dir` work normally
2. **Shell Functions**: `wt switch`, `wt sw`, and `wts` are shell functions that:
   - Call `wt print-dir` to get the target directory
   - Use `cd` to change to that directory
   - Fall back to normal error handling if the path resolution fails

### Shell Function Benefits

- **Seamless switching**: `wt switch feature` actually changes your current directory
- **Multiple convenience levels**: `wt switch`, `wt sw`, or `wts` for different typing preferences
- **Script compatibility**: Use `wt print-dir` directly in scripts for path resolution
- **Clean separation**: Core functionality remains shell-independent

## Development

### Requirements
- [Devbox](https://www.jetpack.io/devbox) for environment management
- Bun runtime (automatically managed by Devbox)
- Git with user configuration

### Development Workflow
```bash
# Enter development environment
devbox shell

# Run in development mode
bun run dev [command]

# Testing (comprehensive coverage required)
bun run test                    # Run all tests  
bun run test:unit              # Unit tests with full coverage
bun run test:integration       # Integration tests for main workflows

# Quality assurance (all must pass before commits)
bun run type-check             # TypeScript validation
bun run lint                   # Code style validation

# Build production binary
bun run build
```

### Architecture

WT uses a **dependency injection architecture** for better testability and maintainability:

**Service Container Pattern**:
- `LoggerService`: Handles all console output (log, error, warn, info, debug)
- `GitService`: Executes git commands and operations
- `FileSystemService`: File system operations (read, write, access, stat, etc.)
- `CommandService`: Non-git command execution

**Service Injection Benefits**:
- **Testable Output**: Can verify exact user messages in tests
- **Isolated Testing**: No dangerous global mocks that break subprocess execution
- **Flexible Logging**: Easy to switch to file logging, structured logging, etc.
- **Error Tracking**: Centralized error handling and logging

### Testing Strategy

The project uses a comprehensive testing approach with dependency injection for reliable, isolated testing:

**Unit Tests** - Service injection with complete isolation:
- Use mock services (`MockLoggerService`, `MockGitService`, etc.) for predictable testing
- 100% coverage goal for all core functionality
- No global module mocks that can break subprocess execution
- Fast execution with controlled, isolated test conditions

**Integration Tests** - Real services for end-to-end validation:
- Use real service implementations for actual git operations
- Focus on most commonly used features and workflows
- Testing with various repository structures and states
- Validation of user experience and error handling

**Service Testing Pattern**:
```typescript
// Unit test with service injection
const mockLogger = new MockLoggerService();
const mockGit = new MockGitService();
const services = createServiceContainer({
  logger: mockLogger,
  git: mockGit
});

// Configure mock responses
mockGit.setCommandResponse(['branch'], 'main\nfeature');

// Test and verify
const result = await someFeature(services);
expect(mockLogger.hasLog('log', 'Expected message')).toBe(true);
```

**Quality Gates**:
- All tests must pass before advancing to new features
- No commits allowed with failing tests or linting errors
- TypeScript compilation must succeed without errors
- Integration tests validate real-world usage scenarios

### Project Structure
```
wt/
├── src/
│   ├── cli/           # CLI parsing and commands
│   ├── commands/      # Command implementations  
│   ├── services/      # Service interfaces and implementations
│   │   ├── implementations/     # Real service implementations
│   │   ├── test-implementations/ # Mock services for testing
│   │   ├── container.ts         # Service container factory
│   │   └── types.ts            # Service interfaces
│   ├── index.ts       # Entry point
│   └── repository.ts  # Repository detection
├── tests/
│   ├── unit/          # Unit tests with service injection
│   ├── integration/   # Integration tests with real services
│   └── fixtures/      # Test data and repositories
├── docs/              # Documentation
├── devbox.json        # Development environment
└── package.json       # Dependencies and scripts
```

## Why Worktrees?

Git worktrees allow you to have multiple working directories for a single repository, enabling:

- **Parallel development** - Work on multiple features simultaneously
- **Easy context switching** - No need to stash/commit when switching branches
- **Safe experimentation** - Test changes without affecting main workspace
- **Efficient reviews** - Check out PRs locally without disrupting current work

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make changes and add comprehensive tests:
   - Write unit tests for all new functionality (aim for 100% coverage)
   - Add integration tests for main user workflows
   - Ensure all tests pass: `bun run test`
4. Validate code quality:
   - Type check: `bun run type-check`
   - Lint: `bun run lint`
5. Submit a pull request with test coverage details

## License

MIT License - see LICENSE file for details.

## Related Projects

- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree)
- [GitHub CLI](https://cli.github.com/)
- [Devbox](https://www.jetpack.io/devbox)
