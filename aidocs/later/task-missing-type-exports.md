# Task: Missing Type Exports for Better API Surface

## Priority: Medium

## Problem
Commonly used types are not exported from module index files, forcing consumers to import from internal implementation files. This creates tight coupling and makes the API surface unclear.

## Current State
- Types like `RepositoryInfo`, `WTConfig`, `WorktreeInfo` are defined in implementation files
- No re-exports from index.ts files
- Consumers must know internal file structure to import types
- API surface is not clearly defined

## Impact
- Tight coupling between modules
- Unclear public API boundaries
- Harder to refactor internal structure
- Poor developer experience for type imports
- Future breaking changes more likely

## Examples of Missing Exports
```typescript
// Current: consumers must know internal structure
import type { RepositoryInfo } from './repository.ts';
import type { WTConfig } from './config.ts';
import type { WorktreeInfo } from './worktree.ts';

// Better: clear API surface
import type { RepositoryInfo, WTConfig, WorktreeInfo } from './index.ts';
```

## Solution
1. Create comprehensive type exports in src/index.ts
2. Export commonly used interfaces and types
3. Re-export from module index files where appropriate
4. Update existing imports to use public API
5. Document the public type API

## Files Affected
- src/index.ts (add type exports)
- src/repository.ts, src/config.ts, src/worktree.ts (ensure types are exported)
- Update internal imports to use public API where appropriate
- tests/ (update test imports if needed)