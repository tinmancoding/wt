# Task: Import Consistency Improvements

## Priority: Medium

## Problem
The codebase has inconsistent import patterns between Node.js built-in modules, with some files using the `node:` prefix and others not. This creates inconsistency and potential confusion.

## Current State
- `src/config.ts` uses `node:path`, `node:fs/promises`, `node:child_process`
- `src/repository.ts` uses `node:path`, `node:fs/promises`
- `src/worktree.ts` uses `child_process`, `path` (without node: prefix)
- Inconsistent patterns across the codebase

## Impact
- Code style inconsistency
- Potential confusion for developers
- Mixed import patterns make code harder to read
- Future Node.js compatibility issues

## Best Practice
Node.js recommends using the `node:` prefix for built-in modules to:
- Clearly distinguish built-in modules from npm packages
- Improve future compatibility
- Make import intentions explicit

## Solution
1. Standardize all Node.js built-in imports to use `node:` prefix
2. Update all files to use consistent import pattern:
   - `import { spawn } from 'node:child_process'`
   - `import { resolve, dirname, join } from 'node:path'`
   - `import { readFile, writeFile, access, constants } from 'node:fs/promises'`
3. Add ESLint rule to enforce consistent imports
4. Update any new code to follow this pattern

## Files Affected
- src/worktree.ts (update imports)
- Any other files with inconsistent imports
- .eslintrc.js (add import consistency rule)