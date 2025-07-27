# AGENTS.md - Development Guide for AI Assistants

## Essential Commands
```bash
# Development & Testing
devbox run bun run dev [args]          # Run CLI in development
devbox run bun run test                # Run all tests  
devbox run bun run test:unit           # Unit tests only
devbox run bun run test:integration    # Integration tests only
devbox run bun test file.test.ts       # Run single test file
devbox run bun test --test-name-pattern "pattern"  # Run tests matching pattern

# Quality Control (run before commits)
devbox run bun run type-check          # TypeScript compilation check
devbox run bun run lint                # ESLint validation
devbox run bun run build               # Production build (creates ./wt binary)
```

## Code Style & Conventions
- **TypeScript**: Strict mode enabled, use explicit types, avoid `any`
- **Imports**: Use `.ts` extensions, path aliases `@/*` for src/, relative imports within modules
- **Error Handling**: Use custom error classes with exit codes (see EXIT_CODES in cli/types.ts)
- **Testing**: Bun test syntax `import { test, expect } from "bun:test"`, mock external dependencies in unit tests, integration tests with real command calling
- **Naming**: camelCase for variables/functions, PascalCase for classes/types, kebab-case for files
- **Structure**: Export types and main functionality from index.ts files in each module

## Tools
- If the Context7 MCP is available, please use it to get the proper API for bun and other TypeScript libraries.

## Behaviour
- For feature implementation: Don't move to the next task until all the linting errors are fixed and all the tests are passing.

## Testing Requirements
- **Unit Tests**: Full coverage (100% goal) with complete mocking of external dependencies
- **Integration Tests**: Focus on main functionality and most commonly used scenarios
- **Every Phase**: Write both unit and integration tests before proceeding
- **Quality Gates**: All tests must pass before advancing to next phase/task 

## Critical Testing Insights & Lessons Learned

### Global Module Mock Hazards (CRITICAL)
**Problem**: Global module mocks using `mock.module()` can persist beyond test boundaries and break subsequent tests, especially integration tests that rely on subprocess execution.

**Example of Dangerous Pattern**:
```typescript
// NEVER DO THIS - breaks subprocess stdout for all subsequent tests
mock.module('node:child_process', () => ({
  spawn: mockSpawn
}));
```

**Key Issues**:
- Bun's `mock.restore()` doesn't properly restore module mocks
- Global mocks can interfere with integration tests that spawn real processes
- Symptoms: subprocess calls return empty stdout despite successful execution (exit code 0)
- Hard to debug: tests work in isolation but fail in full test suite

**Safe Alternatives**:
- Use scoped/targeted mocks within individual test functions
- Prefer dependency injection for testable code
- Mock at the function level, not module level
- If module mocking is necessary, ensure proper cleanup and test isolation

### Test Isolation Best Practices
- **Never use global module mocks** that affect subprocess execution
- **Verify test isolation** by running individual tests vs full suite
- **Watch for persistent mocks** that survive between test files
- **Integration tests are fragile** - protect them from unit test side effects

### Debugging Subprocess Issues
- If integration tests fail with empty stdout but exit code 0, suspect global mocks
- Test unit files individually to identify the culprit
- Look for `mock.module()` calls affecting `node:child_process`
- Create isolation tests to verify subprocess functionality

## Service Injection Architecture

### Service Container Pattern
The codebase uses dependency injection through a service container pattern for better testability and maintainability.

**Core Services**:
- `LoggerService`: Handles all console output (log, error, warn, info, debug)
- `GitService`: Executes git commands and operations
- `FileSystemService`: File system operations (read, write, access, stat, etc.)
- `CommandService`: Non-git command execution

**Service Container Creation**:
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

### Testing with Service Injection

**Unit Test Pattern** (PREFERRED):
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

**Integration Test Pattern**:
```typescript
test('end-to-end functionality', async () => {
  // Use real services for integration tests
  const services = createServiceContainer();
  
  // Test with real git repository and commands
  const result = await fullWorkflow(services);
  expect(result).toBeDefined();
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

**SilentLoggerService**:
```typescript
// Use for tests where output isn't relevant
const services = createServiceContainer({
  logger: new SilentLoggerService()
});
```

### Service Implementation Guidelines

**Creating New Services**:
1. Define interface in `src/services/types.ts`
2. Create implementation in `src/services/implementations/`
3. Create mock in `src/services/test-implementations/`
4. Add to service container factory
5. Write comprehensive tests

**Service Interface Design**:
- Keep interfaces focused and cohesive
- Use async/await for I/O operations
- Return meaningful error types
- Accept configuration through constructor or methods

### Migration from Console Calls

**Before (Deprecated)**:
```typescript
console.log('Creating worktree...');
console.error('Failed to create worktree');
```

**After (Correct)**:
```typescript
// In class constructor
constructor(private services: ServiceContainer) {}

// In methods
this.services.logger.log('Creating worktree...');
this.services.logger.error('Failed to create worktree');
```

**Backward Compatibility Functions**:
```typescript
// Keep existing function signatures for compatibility
export async function createWorktree(branch: string): Promise<void> {
  const services = createServiceContainer();
  const worktreeOps = new WorktreeOperations(services);
  return worktreeOps.createWorktree(branch);
}
```

