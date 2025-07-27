# WT - Git Worktree Manager

A fast, intuitive command-line tool for managing Git worktrees with smart branch resolution and GitHub integration.

## Features

- **Smart worktree creation** - Automatically handles local, remote, and new branches
- **Directory switching** - Switch between worktrees with shell integration
- **GitHub PR integration** - Create worktrees directly from pull requests
- **Command execution** - Run commands in specific worktree contexts
- **Repository initialization** - Set up bare repositories optimized for worktrees
- **Configurable workflows** - Customize behavior with hooks and settings

## Installation

### Prerequisites
- Git 2.5+ (for worktree support)
- GitHub CLI (optional, for PR features)

### Install from Release

Download the latest binary from the [releases page](https://github.com/tinmancoding/wt/releases):

```bash
# Download and install (replace with actual release URL)
curl -L https://github.com/tinmancoding/wt/releases/latest/download/wt-linux -o wt
chmod +x wt
sudo mv wt /usr/local/bin/

# Verify installation
wt --help
```

### Build from Source

If you prefer to build from source, see the [Development Guide](docs/development_guide.md).

## Quick Start

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

For development setup, testing, and contributing guidelines, see the [Development Guide](docs/development_guide.md).

## Why Worktrees?

Git worktrees allow you to have multiple working directories for a single repository, enabling:

- **Parallel development** - Work on multiple features simultaneously
- **Easy context switching** - No need to stash/commit when switching branches
- **Safe experimentation** - Test changes without affecting main workspace
- **Efficient reviews** - Check out PRs locally without disrupting current work

## Contributing

We welcome contributions! Please see the [Development Guide](docs/development_guide.md) for detailed instructions on setting up your development environment, running tests, and submitting pull requests.

## License

MIT License - see LICENSE file for details.

## Related Projects

- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree)
- [GitHub CLI](https://cli.github.com/)
- [Devbox](https://www.jetpack.io/devbox)
