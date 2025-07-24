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

