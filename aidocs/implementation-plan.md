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

## Phase 2: Configuration System (45 minutes)

### Phase 2.1: Configuration Schema & Loading
**Duration**: 30 minutes  
**Manual Test**: Create `.wtconfig` file and verify parsing

**Tasks**:
- [ ] Define configuration TypeScript interface
- [ ] Implement `.wtconfig` file loading and parsing
- [ ] Add default configuration values
- [ ] Validate configuration schema
- [ ] Handle missing/malformed config gracefully

**Test Command**: Create various `.wtconfig` files and test parsing

### Phase 2.2: Configuration Commands
**Duration**: 15 minutes  
**Manual Test**: Run config commands and verify output

**Tasks**:
- [ ] Implement `wt config` (show all config)
- [ ] Implement `wt config <key>` (show specific value)
- [ ] Implement `wt config <key> <value>` (set value)
- [ ] Add config validation for known keys

**Test Command**: `wt config && wt config worktreeDir && wt config autoFetch false`

## Phase 3: Basic Worktree Operations (2-3 hours)

### Phase 3.1: Worktree Listing
**Duration**: 45 minutes  
**Manual Test**: Create manual worktrees and verify listing

**Tasks**:
- [ ] Implement git worktree list parsing
- [ ] Format worktree display with status
- [ ] Show current worktree indicator
- [ ] Handle empty worktree list gracefully
- [ ] Add `wt list` command

**Test Command**: `git worktree add ../test-worktree && wt list`

### Phase 3.2: Worktree Creation (Smart Branch Resolution)
**Duration**: 1.5 hours  
**Manual Test**: Test all three branch scenarios (local, remote, new)

**Tasks**:
- [ ] Implement branch existence checking (local)
- [ ] Implement branch existence checking (remote)
- [ ] Add auto-fetch functionality (respecting config)
- [ ] Create worktree for existing local branch
- [ ] Create worktree for remote branch (with tracking)
- [ ] Create worktree for new branch from HEAD
- [ ] Add proper warning messages for outdated branches
- [ ] Implement `wt create <branch>` command

**Test Scenarios**:
1. `wt create existing-local-branch`
2. `wt create origin/remote-branch`  
3. `wt create brand-new-branch`

### Phase 3.3: Worktree Removal
**Duration**: 30 minutes  
**Manual Test**: Remove worktrees with and without branch deletion

**Tasks**:
- [ ] Implement worktree removal with git worktree remove
- [ ] Add optional branch deletion with `--with-branch` flag
- [ ] Support pattern matching for worktree selection
- [ ] Add confirmation prompts (respecting config)
- [ ] Implement `wt remove [pattern] [--with-branch]` command

**Test Command**: `wt remove test-worktree --with-branch`

## Phase 4: Fuzzy Finding & Switching (1 hour)

### Phase 4.1: Basic Switching
**Duration**: 30 minutes  
**Manual Test**: Switch between existing worktrees

**Tasks**:
- [ ] Implement directory changing to worktree
- [ ] Add pattern matching for worktree names
- [ ] Handle single match auto-selection
- [ ] Handle multiple matches with user selection
- [ ] Implement `wt [pattern]` and `wt switch [pattern]` commands

**Test Command**: `wt feat` (if multiple feature branches exist)

### Phase 4.2: Interactive Fuzzy Finding
**Duration**: 30 minutes  
**Manual Test**: Run without arguments and verify fuzzy finder

**Tasks**:
- [ ] Detect fzf availability
- [ ] Implement built-in fuzzy matching fallback
- [ ] Create interactive worktree selection
- [ ] Handle empty selection gracefully
- [ ] Integrate with `wt` (no arguments) command

**Test Command**: `wt` (should show interactive selection)

## Phase 5: Testing Framework (1.5 hours)

### Phase 5.1: Unit Testing Setup
**Duration**: 45 minutes  
**Manual Test**: Run test suite and verify coverage

**Tasks**:
- [ ] Set up Bun test runner configuration
- [ ] Create mock interfaces for git commands
- [ ] Add tests for repository detection
- [ ] Add tests for configuration management
- [ ] Add tests for branch resolution logic

**Test Command**: `bun test unit/`

### Phase 5.2: Integration Testing Setup  
**Duration**: 45 minutes  
**Manual Test**: Run integration tests with temporary repositories

**Tasks**:
- [ ] Create temporary repository utilities
- [ ] Add test fixtures for various scenarios
- [ ] Test worktree operations end-to-end
- [ ] Add cleanup mechanisms for test repositories
- [ ] Create integration test suite

**Test Command**: `bun test integration/`

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

**Test Command**: Configure hooks in `.wtconfig` and verify execution

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

Each phase includes specific manual testing steps:

1. **Immediate Testing**: Run provided test commands after each phase
2. **Integration Testing**: Verify new features work with existing functionality  
3. **Edge Case Testing**: Test error conditions and boundary cases
4. **Performance Testing**: Ensure responsive performance on typical repositories

## Success Criteria

Each phase is considered complete when:
- All listed tasks are implemented
- Manual test commands pass successfully
- Code passes type checking (`bun run type-check`)
- Unit tests pass (where applicable)
- No obvious bugs or edge case failures

## Estimated Total Time: 12-15 hours

This plan breaks down the full WT implementation into manageable, testable phases that can be reviewed quickly and provide immediate value at each step.