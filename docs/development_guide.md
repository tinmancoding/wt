# WT Development Guide

This guide covers everything you need to know for developing, testing, and contributing to the WT project.

## Development Environment Setup

### Requirements
- [Devbox](https://www.jetpack.io/devbox) for environment management
- Bun runtime (automatically managed by Devbox)
- Git with user configuration

### Getting Started

1. **Clone and Setup**
   ```bash
   # Clone the repository
   git clone <repository-url>
   cd wt
   
   # Enter development environment (installs dependencies automatically)
   devbox shell
   ```

2. **Development Commands**
   ```bash
   # Run in development mode
   bun run dev [command]
   
   # Build production binary
   bun run build
   
   # Use the built binary
   ./wt --help
   ```

## Testing

The project uses a comprehensive testing approach with dependency injection for reliable, isolated testing.

### Test Commands
```bash
# Run all tests
bun run test

# Run specific test types
bun run test:unit              # Unit tests with full coverage
bun run test:integration       # Integration tests for main workflows

# Run single test file
bun test file.test.ts

# Run tests matching pattern
bun test --test-name-pattern "pattern"
```

### Testing Strategy

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

### Service Testing Pattern

```typescript
import { test, expect } from 'bun:test';
import { MockLoggerService, MockGitService } from '@/services/test-implementations/index.ts';
import { createServiceContainer } from '@/services/container.ts';

test('feature works correctly', async () => {
  const mockLogger = new MockLoggerService();
  const mockGit = new MockGitService();
  
  const services = createServiceContainer({
    logger: mockLogger,
    git: mockGit
  });

  // Configure mock responses
  mockGit.setCommandResponse(['branch'], 'main\nfeature');
  
  // Test your feature
  const result = await someFeature(services);
  
  // Verify behavior
  expect(result).toBe('expected');
  expect(mockLogger.hasLog('log', 'Expected message')).toBe(true);
  expect(mockGit.getExecutedCommands()).toContain({ gitDir: '/repo', args: ['branch'] });
});
```

### Quality Gates
- All tests must pass before advancing to new features
- No commits allowed with failing tests or linting errors
- TypeScript compilation must succeed without errors
- Integration tests validate real-world usage scenarios

## Code Quality

### Quality Assurance Commands
```bash
# TypeScript validation (must pass before commits)
bun run type-check

# Code style validation (must pass before commits)
bun run lint
```

### Code Style & Conventions
- **TypeScript**: Strict mode enabled, use explicit types, avoid `any`
- **Imports**: Use `.ts` extensions, path aliases `@/*` for src/, relative imports within modules
- **Error Handling**: Use custom error classes with exit codes (see EXIT_CODES in cli/types.ts)
- **Testing**: Bun test syntax `import { test, expect } from "bun:test"`, mock external dependencies in unit tests, integration tests with real command calling
- **Naming**: camelCase for variables/functions, PascalCase for classes/types, kebab-case for files
- **Structure**: Export types and main functionality from index.ts files in each module

## Architecture

WT uses a **dependency injection architecture** for better testability and maintainability.

### Service Container Pattern

**Core Services**:
- `LoggerService`: Handles all console output (log, error, warn, info, debug)
- `GitService`: Executes git commands and operations
- `FileSystemService`: File system operations (read, write, access, stat, etc.)
- `CommandService`: Non-git command execution

**Service Injection Benefits**:
- **Testable Output**: Can verify exact user messages in tests
- **Isolated Testing**: No dangerous global mocks that break subprocess execution
- **Flexible Logging**: Easy to switch to file logging, structured logging, etc.
- **Error Tracking**: Centralized error handling and logging

### Service Container Creation

```typescript
import { createServiceContainer, createTestServiceContainer } from '@/services/container.ts';

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

### Mock Service Capabilities

**MockLoggerService**:
```typescript
const mockLogger = new MockLoggerService();

// Capture and verify log messages
mockLogger.log('test message', 'arg1');
expect(mockLogger.hasLog('log', 'test message')).toBe(true);
expect(mockLogger.getLogsByLevel('log')[0]?.args).toEqual(['arg1']);

// Clear history between tests
mockLogger.clear();
```

**MockGitService**:
```typescript
const mockGit = new MockGitService();

// Configure command responses
mockGit.setCommandResponse(['status'], 'clean working tree');
mockGit.setCommandResponse(['branch'], { stdout: 'main\nfeature', stderr: '', exitCode: 0 });

// Simulate failures
mockGit.setCommandResponse(['invalid'], { stdout: '', stderr: 'unknown command', exitCode: 1 });

// Verify command execution
const commands = mockGit.getExecutedCommands();
expect(commands).toContain({ gitDir: '/repo', args: ['status'] });

// Clear history
mockGit.clear();
```

## Project Structure

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

## Contributing Workflow

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature-name`
3. **Make changes and add comprehensive tests**:
   - Write unit tests for all new functionality (aim for 100% coverage)
   - Add integration tests for main user workflows
   - Ensure all tests pass: `bun run test`
4. **Validate code quality**:
   - Type check: `bun run type-check`
   - Lint: `bun run lint`
5. **Submit a pull request** with test coverage details

### Development Best Practices

- **Feature Implementation**: Don't move to the next task until all linting errors are fixed and all tests are passing
- **Testing Requirements**: Write both unit and integration tests before proceeding to next phase
- **Service Injection**: Use dependency injection for all new features to maintain testability
- **Error Handling**: Use proper exit codes and error messages through the LoggerService
- **Documentation**: Update relevant documentation when adding new features

## Critical Testing Guidelines

### Avoid Global Module Mocks
**Problem**: Global module mocks using `mock.module()` can persist beyond test boundaries and break subsequent tests, especially integration tests that rely on subprocess execution.

**Never do this**:
```typescript
// DANGEROUS - breaks subprocess stdout for all subsequent tests
mock.module('node:child_process', () => ({
  spawn: mockSpawn
}));
```

**Safe alternatives**:
- Use scoped/targeted mocks within individual test functions
- Prefer dependency injection for testable code
- Mock at the function level, not module level

### Test Isolation
- **Never use global module mocks** that affect subprocess execution
- **Verify test isolation** by running individual tests vs full suite
- **Watch for persistent mocks** that survive between test files
- **Integration tests are fragile** - protect them from unit test side effects

## Release Process

The project uses GitHub Actions for automated releases. Before generating releases:

1. Ensure all tests pass: `bun run test`
2. Validate code quality: `bun run type-check && bun run lint`
3. Update version in `package.json`
4. Update CHANGELOG.md with release notes
5. Create and push a git tag following semantic versioning

## Related Resources

- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree)
- [GitHub CLI](https://cli.github.com/)
- [Devbox](https://www.jetpack.io/devbox)
- [Bun Runtime](https://bun.sh/)