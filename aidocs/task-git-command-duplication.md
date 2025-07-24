# Task: Code Duplication in Git Command Execution

## Priority: Critical 🚨

## Problem
The `executeGitCommand` function is duplicated in two files with slightly different implementations, creating maintenance issues and inconsistent error handling across the codebase.

## Current State
- `src/config.ts:69` has `executeGitCommand` implementation
- `src/worktree.ts:19` has nearly identical `executeGitCommand` implementation
- Both functions do the same thing but may have subtle differences
- No shared utility module for common git operations

## Impact
- Code duplication violates DRY principle
- Bug fixes need to be applied in multiple places
- Inconsistent error handling between modules
- Harder to maintain and test git command logic
- Risk of implementations diverging over time

## Solution
1. Create shared `src/git.ts` utility module
2. Implement single `executeGitCommand` function with proper error handling
3. Export git utility functions for reuse
4. Update config.ts and worktree.ts to use shared implementation
5. Add comprehensive tests for git utilities

## Files Affected
- New: src/git.ts
- src/config.ts (remove duplicate, import from git.ts)
- src/worktree.ts (remove duplicate, import from git.ts)
- tests/unit/ (add git utility tests)