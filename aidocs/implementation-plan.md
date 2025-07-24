# WT Implementation Plan

## Overview

This document outlines the detailed implementation plan for the WT (Git Worktree Manager) project. Each phase is designed to be manually testable and reviewable within a couple of minutes.

## Phase 1: Project Foundation & Core Architecture (1-2 hours)

### Phase 1.1: Project Setup
**Duration**: 30 minutes  
**Manual Test**: Run devbox shell, install dependencies, verify TypeScript compilation

**Tasks**:
- [x] Set up project structure according to PRD specs
- [x] Create `devbox.json` with required packages and scripts
- [x] Initialize `package.json` with Bun configuration
- [x] Set up `tsconfig.json` for TypeScript
- [x] Create basic project structure (src/, tests/, docs/)
- [x] Add initial `.gitignore`

**Test Command**: `devbox shell && bun install && bun run type-check`

**Testing Requirements**:
- **Unit Tests**: Basic project structure validation, package.json parsing
- **Integration Tests**: Development environment setup verification

### Phase 1.2: CLI Framework & Entry Point
**Duration**: 30 minutes  
**Manual Test**: Run `bun run dev --help` and verify help output

**Tasks**:
- [x] Implement basic CLI argument parsing
- [x] Create command dispatch system
- [x] Add help system with usage examples
- [x] Implement version display
- [x] Add error handling framework with exit codes

**Test Command**: `bun run dev --help && bun run dev --version`

**Testing Requirements**:
- **Unit Tests**: 
  - Argument parsing with all edge cases (empty args, invalid flags, etc.)
  - Command dispatch logic with invalid commands
  - Exit code validation for all error scenarios
  - Help text formatting and completeness
- **Integration Tests**: 
  - CLI startup and basic command execution
  - Help system accessibility

### Phase 1.3: Repository Detection System
**Duration**: 45 minutes  
**Manual Test**: Navigate to different directories and test repository detection

**Tasks**:
- [x] Implement directory tree walking for repository detection
- [x] Support `.bare/` directory detection
- [x] Support `.git` file with `gitdir: ./.bare` 
- [x] Fallback to standard `.git` directory
- [x] Add proper error messages for no repository found

**Test Command**: Test in various directory structures and verify detection

**Testing Requirements**:
- **Unit Tests**:
  - Directory walking logic with mocked file system
  - Each detection method (bare, gitfile, standard) individually
  - Error handling for permission issues, non-existent paths
  - Path resolution and normalization edge cases
- **Integration Tests**:
  - Real repository detection in various directory structures
  - Repository detection from different working directories

## Phase 2: Configuration System (45 minutes)

### Phase 2.1: Configuration Schema & Loading
**Duration**: 30 minutes  
**Manual Test**: Create `.wtconfig.json` file and verify parsing

**Tasks**:
- [x] Define configuration TypeScript interface
- [x] Implement `.wtconfig.json` file loading and parsing
- [x] Add default configuration values
- [x] Validate configuration schema
- [x] Handle missing/malformed config gracefully

**Test Command**: Create various `.wtconfig.json` files and test parsing

**Testing Requirements**:
- **Unit Tests**:
  - Configuration schema validation with all valid/invalid combinations
  - JSON parsing with malformed files, missing properties
  - Default value application and override logic
  - File system error handling (permissions, missing files)
  - Type safety and runtime validation
- **Integration Tests**:
  - Configuration loading from real files in various repository structures
  - Configuration inheritance and precedence

### Phase 2.2: Configuration Commands
**Duration**: 15 minutes  
**Manual Test**: Run config commands and verify output

**Tasks**:
- [x] Implement `wt config` (show all config)
- [x] Implement `wt config <key>` (show specific value)
- [x] Implement `wt config <key> <value>` (set value)
- [x] Add config validation for known keys
- [x] Implement smart worktreeDir auto-detection

**Test Command**: `wt config && wt config worktreeDir && wt config autoFetch false`

**Testing Requirements**:
- **Unit Tests**:
  - Config command parsing and validation
  - Key-value setting with type validation
  - Invalid key/value handling
  - Output formatting consistency
- **Integration Tests**:
  - Config persistence to file system
  - Config command execution end-to-end

**Smart WorktreeDir Implementation**:
- [x] Create `detectDefaultWorktreeDir()` function using `git worktree list`
- [x] Implement intelligent fallback logic for different repository scenarios
- [x] Update config loading to use dynamic defaults instead of static `./`
- [x] Maintain backward compatibility for explicit user configurations

**Additional Testing for WorktreeDir**:
- **Unit Tests**:
  - Auto-detection logic with mocked git responses
  - Fallback scenarios (no worktrees, git errors, etc.)
  - Path normalization and validation
- **Integration Tests**:
  - Auto-detection with real repository structures
  - Compatibility with existing configurations

## Phase 3: Basic Worktree Operations (2-3 hours)

### Phase 3.1: Worktree Listing
**Duration**: 45 minutes  
**Manual Test**: Create manual worktrees and verify listing

**Tasks**:
- [x] Implement git worktree list parsing
- [x] Format worktree display with status
- [x] Show current worktree indicator
- [x] Handle empty worktree list gracefully
- [x] Add `wt list` command

**Test Command**: `git worktree add ../test-worktree && wt list`

**Testing Requirements**:
- **Unit Tests**:
  - Git worktree list output parsing with various formats
  - Worktree status detection and formatting
  - Current worktree identification logic
  - Empty list and error condition handling
  - Display formatting and alignment
- **Integration Tests**:
  - Listing real worktrees in different repository structures
  - Current worktree detection from various directories

### Phase 3.2: Worktree Creation (Smart Branch Resolution)
**Duration**: 1.5 hours  
**Manual Test**: Test all three branch scenarios (local, remote, new)

**Tasks**:
- [x] Implement branch existence checking (local)
- [x] Implement branch existence checking (remote)
- [x] Add auto-fetch functionality (respecting config)
- [x] Create worktree for existing local branch
- [x] Create worktree for remote branch (with tracking)
- [x] Create worktree for new branch from HEAD
- [x] Add proper warning messages for outdated branches
- [x] Implement `wt create <branch>` command

**Test Scenarios**:
1. `wt create existing-local-branch`
2. `wt create origin/remote-branch`  
3. `wt create brand-new-branch`

**Testing Requirements**:
- **Unit Tests**:
  - Branch existence checking logic with mocked git responses
  - Each branch resolution scenario (local, remote, new) individually
  - Auto-fetch logic and configuration respect
  - Warning message generation for outdated branches
  - Error handling for git command failures
  - Path validation and worktree name generation
- **Integration Tests**:
  - End-to-end worktree creation for all branch scenarios
  - Auto-fetch behavior with real remote repositories
  - Worktree creation in different repository structures
  - Integration with configuration system

### Phase 3.3: Worktree Removal
**Duration**: 30 minutes  
**Manual Test**: Remove worktrees with and without branch deletion

**Tasks**:
- [x] Implement worktree removal with git worktree remove
- [x] Add optional branch deletion with `--with-branch` flag
- [x] Support pattern matching for worktree selection
- [x] Add confirmation prompts (respecting config)
- [x] Implement `wt remove [pattern] [--with-branch]` command

**Test Command**: `wt remove test-worktree --with-branch`

**Testing Requirements**:
- **Unit Tests**:
  - Worktree removal logic with mocked git commands
  - Pattern matching for worktree selection
  - Confirmation prompt handling and config integration
  - Branch deletion logic and safety checks
  - Error handling for removal failures
- **Integration Tests**:
  - Complete removal workflow with real worktrees
  - Pattern matching with multiple worktrees
  - Branch deletion verification

## Phase 4: Path Resolution & Shell Integration (1 hour)

### Phase 4.1: Print-Dir Command Implementation  
**Duration**: 30 minutes  
**Manual Test**: Test path resolution with existing worktrees

**Tasks**:
- [ ] Remove legacy `wt switch` command and related tests
- [ ] Implement `wt print-dir [pattern]` command
- [ ] Add pattern matching for worktree names
- [ ] Handle single match auto-selection
- [ ] Handle multiple matches with user selection
- [ ] Clean stdout output for shell function consumption
- [ ] Proper error handling for non-existent worktrees

**Test Command**: `wt print-dir feat` (should output directory path)

**Testing Requirements**:
- **Unit Tests**:
  - Pattern matching logic with various worktree name formats
  - Path resolution and normalization
  - Error handling for missing worktrees
  - Stdout formatting validation
  - Edge cases with special characters in worktree names
- **Integration Tests**:
  - Path resolution with real worktrees in different repository structures
  - Pattern matching with multiple similar worktree names

### Phase 4.2: Shell Wrapper Function Generation
**Duration**: 30 minutes  
**Manual Test**: Generate and test shell functions across different shells

**Tasks**:
- [ ] Implement `wt setup --bash|--zsh|--fish|--auto` command
- [ ] Add shell detection from environment variables
- [ ] Generate shell-specific wrapper function syntax
- [ ] Create `wt()`, `wts()` functions with proper error handling
- [ ] Handle switch/sw subcommands with directory changing
- [ ] Add fallback to normal command execution for non-switch operations

**Test Command**: `source <(wt setup --bash) && wt switch feat`

**Testing Requirements**:
- **Unit Tests**:
  - Shell detection logic with various $SHELL values
  - Function generation with proper shell syntax
  - Command routing logic (switch vs other commands)
  - Error handling and fallback behavior
- **Integration Tests**:
  - Shell function generation and sourcing
  - Directory switching functionality across different shells
  - Error handling when print-dir fails
  - Integration with existing shell environments


## Phase 5: Testing Framework (1.5 hours)

### Phase 5.1: Unit Testing Setup
**Duration**: 45 minutes  
**Manual Test**: Run test suite and verify coverage

**Tasks**:
- [ ] Set up Bun test runner configuration with coverage reporting
- [ ] Create comprehensive mock interfaces for git commands
- [ ] Create mock interfaces for file system operations
- [ ] Add tests for repository detection (full coverage)
- [ ] Add tests for configuration management (full coverage)
- [ ] Add tests for branch resolution logic (full coverage)
- [ ] Implement test utilities for common mocking patterns

**Test Command**: `bun test unit/ --coverage`

**Testing Requirements**:
- **Coverage Goal**: 100% line and branch coverage where possible
- **Mock Strategy**: Complete isolation from external dependencies
- **Test Organization**: Group tests by module with clear naming
- **Edge Cases**: Comprehensive testing of error conditions and boundary cases

**Mock Implementation Requirements**:
```typescript
// Example comprehensive mocking setup
interface GitCommandMock {
  mockWorktreeList(output: string): void
  mockBranchExists(branch: string, exists: boolean): void  
  mockFetch(success: boolean): void
  mockWorktreeAdd(success: boolean): void
  resetMocks(): void
}

interface FileSystemMock {
  mockFileExists(path: string, exists: boolean): void
  mockDirectoryExists(path: string, exists: boolean): void
  mockReadFile(path: string, content: string | Error): void
  mockWriteFile(path: string, success: boolean): void
}
```

### Phase 5.2: Integration Testing Setup  
**Duration**: 45 minutes  
**Manual Test**: Run integration tests with temporary repositories

**Tasks**:
- [ ] Create temporary repository utilities with cleanup
- [ ] Add test fixtures for various repository scenarios
- [ ] Implement common workflow testing patterns
- [ ] Add cleanup mechanisms for test repositories
- [ ] Create integration test suite for main user workflows
- [ ] Set up CI-compatible test environment

**Test Command**: `bun test integration/`

**Testing Requirements**:
- **Focus**: Most commonly used scenarios and end-to-end workflows
- **Real Operations**: Use actual git commands, not mocks
- **Cleanup**: Automatic cleanup of temporary repositories
- **Isolation**: Each test runs in a fresh environment

**Key Integration Test Scenarios**:
```typescript
// Priority integration tests (most common workflows)
describe('Core Worktree Workflow', () => {
  test('create → switch → work → remove cycle')
  test('multiple worktrees management')
  test('repository detection across directory structures')
})

describe('Branch Resolution', () => {
  test('local branch worktree creation')
  test('remote branch worktree creation with tracking')  
  test('new branch worktree creation')
})

describe('Configuration System', () => {
  test('config auto-detection and loading')
  test('config persistence and updates')
})
```

**Temporary Repository Utilities**:
```typescript
interface TempRepoOptions {
  branches: string[]
  commits?: number
  remotes?: string[]
  bareSetup?: boolean
  worktrees?: string[]
  config?: Partial<WTConfig>
}

async function createTempRepo(options: TempRepoOptions): Promise<TempRepo>
```

## Phase 6: GitHub CLI Integration (2 hours)

### Phase 6.1: GitHub CLI Detection & PR Fetching
**Duration**: 1 hour  
**Manual Test**: Run against real GitHub PR

**Tasks**:
- [ ] Detect GitHub CLI availability
- [ ] Implement PR detail fetching with `gh pr view`
- [ ] Parse PR response for branch information
- [ ] Handle authentication errors gracefully
- [ ] Add proper error messages for invalid PRs

**Test Command**: `wt pr 123` (using real PR number)

### Phase 6.2: PR Worktree Creation
**Duration**: 1 hour  
**Manual Test**: Create worktrees from different PR scenarios

**Tasks**:
- [ ] Extract source branch from PR data
- [ ] Integrate with existing branch resolution logic
- [ ] Handle cross-repository PRs (with error)
- [ ] Add PR-specific error handling
- [ ] Implement `wt pr <pr-number>` command

**Test Command**: Test with various PR types and verify worktree creation

## Phase 7: Command Execution (1 hour)

### Phase 7.1: Command Runner Implementation
**Duration**: 1 hour  
**Manual Test**: Run various commands in worktree context

**Tasks**:
- [ ] Implement process spawning with proper signal handling
- [ ] Preserve command exit codes and output
- [ ] Handle environment variable inheritance
- [ ] Manage working directory context
- [ ] Integrate with worktree creation logic
- [ ] Implement `wt run <branch> <command...>` command

**Test Command**: `wt run feature-branch "npm test"` or `wt run main "ls -la"`

## Phase 8: Repository Initialization (1.5 hours)

### Phase 8.1: Bare Repository Setup
**Duration**: 1.5 hours  
**Manual Test**: Initialize new repository and verify structure

**Tasks**:
- [ ] Implement URL validation and parsing
- [ ] Clone repository as bare into `.bare/` directory
- [ ] Create `.git` file with proper gitdir reference
- [ ] Configure remote fetch refspec for worktrees
- [ ] Perform initial fetch of all remote branches
- [ ] Add network error handling
- [ ] Implement `wt init <git-url> [name]` command

**Test Command**: `wt init https://github.com/example/repo.git test-repo`

## Phase 9: Hook System (1 hour)

### Phase 9.1: Hook Implementation
**Duration**: 1 hour  
**Manual Test**: Create test hooks and verify execution

**Tasks**:
- [ ] Implement hook discovery from configuration
- [ ] Add post-create hook execution
- [ ] Add post-remove hook execution
- [ ] Pass proper arguments (worktree path, branch name)
- [ ] Handle hook failures gracefully
- [ ] Support various executable types

**Test Command**: Configure hooks in `.wtconfig.json` and verify execution

## Phase 10: Additional Commands & Polish (1.5 hours)

### Phase 10.1: Status & Cleanup Commands
**Duration**: 45 minutes  
**Manual Test**: Verify status display and cleanup functionality

**Tasks**:
- [ ] Implement `wt status` with repository and worktree info
- [ ] Implement `wt clean` for orphaned worktree removal
- [ ] Add detailed status information
- [ ] Handle edge cases gracefully

**Test Command**: `wt status && wt clean`

### Phase 10.2: Build System & Final Polish
**Duration**: 45 minutes  
**Manual Test**: Build binary and verify functionality

**Tasks**:
- [ ] Configure Bun build for single binary compilation
- [ ] Add proper error formatting consistency
- [ ] Optimize performance for large repositories
- [ ] Add comprehensive help documentation
- [ ] Final testing across all commands

**Test Command**: `bun run build && ./wt --help`

## Testing Strategy per Phase

Each phase includes comprehensive testing requirements:

### Testing Requirements for Every Phase

1. **Unit Tests (Full Coverage Goal)**:
   - Write unit tests immediately after implementing each task
   - Aim for 100% coverage where practically possible
   - Mock all external dependencies (git, file system, network)
   - Test all error conditions and edge cases
   - Validate all exit codes and error messages

2. **Integration Tests (Common Scenarios)**:
   - Test main user workflows end-to-end
   - Focus on most commonly used features
   - Use real git operations and file system
   - Test with various repository structures
   - Validate user experience and error handling

3. **Quality Gates**:
   - **No advancing to next phase** until current phase tests pass
   - Run `bun run test` and ensure all tests pass
   - Run `bun run type-check` and fix all TypeScript errors
   - Run `bun run lint` and fix all linting issues
   - Verify manual test commands work as expected

### Testing Commands for Each Phase

**After every phase implementation**:
```bash
# Run all tests and quality checks
bun run test                    # All tests must pass
bun run test:unit              # Unit tests with coverage
bun run test:integration       # Integration tests 
bun run type-check             # No TypeScript errors
bun run lint                   # No linting errors
```

**Coverage Requirements**:
- **Unit Tests**: Target 100% coverage for new code
- **Integration Tests**: Cover all main user workflows
- **Error Handling**: Test every error path and exit code

### Phase-Specific Testing Focus

Each phase adds specific testing requirements:

- **Phase 1-2**: Foundation testing (CLI, config, repository detection)
- **Phase 3**: Core worktree operations testing
- **Phase 4**: User interaction and fuzzy finding testing
- **Phase 5**: Testing infrastructure itself
- **Phase 6+**: Advanced features with backward compatibility testing

**Test Organization**:
```
tests/
├── unit/
│   ├── cli/              # CLI parsing and dispatch
│   ├── config/           # Configuration management
│   ├── repository/       # Repository detection
│   ├── worktree/         # Worktree operations
│   └── utils/            # Utility functions
├── integration/
│   ├── workflows/        # End-to-end user workflows
│   ├── commands/         # Individual command testing
│   └── scenarios/        # Complex multi-step scenarios
└── fixtures/             # Test data and repositories
```

## Success Criteria

Each phase is considered complete when:
- All listed tasks are implemented
- Manual test commands pass successfully
- **All unit tests pass with target coverage**
- **All integration tests pass for implemented features**
- Code passes type checking (`bun run type-check`)
- Code passes linting (`bun run lint`)
- No obvious bugs or edge case failures
- **Quality gates prevent advancing to next phase until all tests pass**

## Estimated Total Time: 11.5-14 hours

This plan breaks down the full WT implementation into manageable, testable phases that can be reviewed quickly and provide immediate value at each step.