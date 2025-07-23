# WT - Git Worktree Manager

A fast, intuitive command-line tool for managing Git worktrees with smart branch resolution and GitHub integration.

## Features

- **Smart worktree creation** - Automatically handles local, remote, and new branches
- **Fuzzy switching** - Quickly switch between worktrees with pattern matching
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
# Create worktree with smart branch resolution
wt create feature-branch

# Switch to worktree (fuzzy matching)
wt feat                    # Matches feature-branch
wt                         # Interactive selection

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
├── .wtconfig       # WT configuration
├── feature-1/      # Worktree directories
├── feature-2/
└── main/
```

## Configuration

Create a `.wtconfig` file in your repository root:

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

## Commands

### Core Commands
- `wt [pattern]` - Switch to worktree (fuzzy matching)
- `wt create <branch>` - Create worktree with smart branch resolution
- `wt list` - List all worktrees with status
- `wt remove [pattern] [--with-branch]` - Remove worktree
- `wt switch [pattern]` - Explicit switch command

### GitHub Integration
- `wt pr <pr-number>` - Create worktree from GitHub PR

### Repository Management
- `wt init <git-url> [name]` - Initialize bare repository
- `wt status` - Show repository and worktree status
- `wt clean` - Remove orphaned worktrees

### Advanced
- `wt run <branch> <command...>` - Execute command in worktree
- `wt config` - Manage configuration
- `wt config <key>` - Show config value
- `wt config <key> <value>` - Set config value

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

# Run tests
bun run test
bun run test:unit      # Unit tests only
bun run test:integration  # Integration tests only

# Type checking and linting
bun run type-check
bun run lint

# Build production binary
bun run build
```

### Project Structure
```
wt/
├── src/
│   ├── cli/           # CLI parsing and commands
│   ├── commands/      # Command implementations  
│   ├── index.ts       # Entry point
│   └── repository.ts  # Repository detection
├── tests/
│   ├── unit/          # Unit tests with mocks
│   ├── integration/   # Integration tests
│   └── fixtures/      # Test data
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
3. Make changes and add tests
4. Run the test suite: `bun run test`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Related Projects

- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree)
- [GitHub CLI](https://cli.github.com/)
- [Devbox](https://www.jetpack.io/devbox)
