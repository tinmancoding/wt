# Repository Detection Test Coverage

This document outlines the comprehensive test coverage for the repository detection functionality in the WT project.

## Test Structure

The repository detection logic is tested at two levels:

### Unit Tests (`tests/unit/repository.test.ts`)
Tests isolated components and type safety:
- ✅ `RepositoryError` class instantiation and properties
- ✅ Repository info type structures for all repository types
- ✅ Exit code constants validation

### Integration Tests (`tests/integration/repository.test.ts`)
Tests actual file system operations with real temporary directories:

## Test Coverage

### `detectRepository()` Function
- ✅ **Bare Repository Detection**: Detects `.bare/` directories correctly
- ✅ **Gitfile Repository Detection**: Parses `.git` files pointing to `.bare` directories
- ✅ **Standard Repository Detection**: Falls back to standard `.git` directories
- ✅ **Directory Tree Walking**: Walks up the directory tree to find repositories
- ✅ **Error Handling**: Throws appropriate errors when no repository found
- ✅ **Absolute Path Gitfiles**: Handles `.git` files with absolute paths
- ✅ **Malformed Gitfiles**: Gracefully handles malformed `.git` files

### `validateRepository()` Function
- ✅ **Bare Repository Validation**: Validates bare repositories with config files
- ✅ **Standard Repository Validation**: Validates standard git repositories
- ✅ **Missing Git Directory**: Throws errors for missing git directories
- ✅ **Missing Config**: Throws errors for bare repositories without config files

### Real World Scenarios
- ✅ **Complex Worktree Setup**: Tests WT project-like repository structures with multiple worktrees
- ✅ **Nested Directory Detection**: Detects repositories from deeply nested subdirectories
- ✅ **Mixed Repository Types**: Handles repositories with both bare and worktree structures

## Test Statistics

- **Total Tests**: 18
- **Total Expectations**: 53
- **Pass Rate**: 100%
- **Coverage Areas**: 
  - File system operations
  - Error handling
  - Type safety
  - Real-world scenarios

## Test Execution

```bash
# Run all tests
devbox run test

# Run only unit tests
devbox run test:unit

# Run only integration tests
devbox run test:integration
```

All tests use temporary directories in `/tmp` to avoid conflicts with the project's own git repository structure.

## Quality Assurance

- ✅ TypeScript compilation passes
- ✅ All async operations properly handled
- ✅ File system cleanup in test teardown
- ✅ Comprehensive error scenario coverage
- ✅ Real file system operations (not just mocks)