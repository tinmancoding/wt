# Dependency Injection Implementation Plan

## Overview

This document outlines the comprehensive plan for introducing lightweight dependency injection into the WT codebase. The goal is to make the application more testable, maintainable, and flexible by abstracting direct dependencies on external systems (git commands, filesystem operations, command execution, and console output).

## Current State Analysis

### Direct Dependencies Identified

1. **Git Commands** (`src/git.ts`):
   - Direct `spawn()` calls to `git` binary
   - Functions: `executeGitCommand()`, `executeGitCommandWithResult()`, `executeGitCommandInDir()`
   - 99 console.* calls throughout codebase

2. **Filesystem Operations**:
   - `src/repository.ts`: `readFile`, `access`, `stat` from `node:fs/promises`
   - `src/config.ts`: `readFile`, `writeFile`, `access` from `node:fs/promises`
   - `src/init.ts`: `writeFile`, `mkdir` from `fs/promises`

3. **Command Execution** (`src/git.ts`):
   - Direct `spawn()` calls for non-git commands
   - Function: `executeCommand()`

4. **Console Output**:
   - 99 direct `console.*` calls across all modules
   - Mix of log, error, warn calls
   - Critical for CLI user experience

### Files Requiring Changes

- `src/git.ts` - Core git operations
- `src/repository.ts` - Repository detection
- `src/config.ts` - Configuration management
- `src/init.ts` - Repository initialization
- `src/worktree.ts` - Worktree operations
- `src/commands/index.ts` - All command handlers
- `src/cli/cli.ts` - CLI error handling
- `src/index.ts` - Main entry point
- All test files - Mock integration

## Service Architecture Design

### Service Interfaces

```typescript
// src/services/types.ts

export interface LoggerService {
  log(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

export interface GitService {
  executeCommand(gitDir: string, args: string[]): Promise<string>;
  executeCommandWithResult(gitDir: string, args: string[]): Promise<GitCommandResult>;
  executeCommandInDir(workDir: string, args: string[]): Promise<string>;
  isAvailable(): Promise<boolean>;
  getVersion(): Promise<string>;
}

export interface FileSystemService {
  readFile(path: string, encoding?: BufferEncoding): Promise<string>;
  writeFile(path: string, data: string, encoding?: BufferEncoding): Promise<void>;
  access(path: string, mode?: number): Promise<void>;
  stat(path: string): Promise<NodeJS.Stats>;
  mkdir(path: string, options?: any): Promise<void>;
  exists(path: string): Promise<boolean>;
  isDirectory(path: string): Promise<boolean>;
  isFile(path: string): Promise<boolean>;
}

export interface CommandService {
  execute(command: string, args: string[], workDir: string, inheritStdio?: boolean): Promise<CommandResult>;
}

export interface ServiceContainer {
  logger: LoggerService;
  git: GitService;
  fs: FileSystemService;
  cmd: CommandService;
}

// Re-export types that services need
export type { GitCommandResult, CommandResult } from '../git.ts';
```

### Implementation Strategy

**Constructor Injection with Default Implementations**
- Each module accepts services via constructor parameters
- Default implementations provided for backward compatibility
- Gradual migration path - existing functions remain unchanged
- Test-friendly with easy mock injection

## Detailed Implementation Plan

### Phase 1: Service Infrastructure (2-3 days)

#### 1.1 Create Service Type Definitions
**File**: `src/services/types.ts`
- Define all service interfaces
- Re-export necessary types from existing modules
- Document interface contracts

#### 1.2 Create Default Implementations
**Files**: `src/services/implementations/`

**NodeLoggerService.ts**
```typescript
export class NodeLoggerService implements LoggerService {
  log(message: string, ...args: any[]): void {
    console.log(message, ...args);
  }
  error(message: string, ...args: any[]): void {
    console.error(message, ...args);
  }
  warn(message: string, ...args: any[]): void {
    console.warn(message, ...args);
  }
  info(message: string, ...args: any[]): void {
    console.info(message, ...args);
  }
  debug(message: string, ...args: any[]): void {
    console.debug(message, ...args);
  }
}
```

**NodeGitService.ts**
```typescript
export class NodeGitService implements GitService {
  async executeCommand(gitDir: string, args: string[]): Promise<string> {
    // Move existing executeGitCommand logic here
  }
  
  async executeCommandWithResult(gitDir: string, args: string[]): Promise<GitCommandResult> {
    // Move existing executeGitCommandWithResult logic here
  }
  
  async executeCommandInDir(workDir: string, args: string[]): Promise<string> {
    // Move existing executeGitCommandInDir logic here
  }
  
  async isAvailable(): Promise<boolean> {
    // Move existing isGitAvailable logic here
  }
  
  async getVersion(): Promise<string> {
    // Move existing getGitVersion logic here
  }
}
```

**NodeFileSystemService.ts**
```typescript
import { readFile as fsReadFile, writeFile as fsWriteFile, access as fsAccess, stat as fsStat, mkdir as fsMkdir, constants } from 'node:fs/promises';

export class NodeFileSystemService implements FileSystemService {
  async readFile(path: string, encoding: BufferEncoding = 'utf-8'): Promise<string> {
    return fsReadFile(path, encoding);
  }
  
  async writeFile(path: string, data: string, encoding: BufferEncoding = 'utf-8'): Promise<void> {
    return fsWriteFile(path, data, encoding);
  }
  
  async access(path: string, mode: number = constants.F_OK): Promise<void> {
    return fsAccess(path, mode);
  }
  
  async stat(path: string): Promise<NodeJS.Stats> {
    return fsStat(path);
  }
  
  async mkdir(path: string, options?: any): Promise<void> {
    return fsMkdir(path, options);
  }
  
  async exists(path: string): Promise<boolean> {
    try {
      await this.access(path);
      return true;
    } catch {
      return false;
    }
  }
  
  async isDirectory(path: string): Promise<boolean> {
    try {
      const stats = await this.stat(path);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
  
  async isFile(path: string): Promise<boolean> {
    try {
      const stats = await this.stat(path);
      return stats.isFile();
    } catch {
      return false;
    }
  }
}
```

**NodeCommandService.ts**
```typescript
export class NodeCommandService implements CommandService {
  async execute(command: string, args: string[], workDir: string, inheritStdio = false): Promise<CommandResult> {
    // Move existing executeCommand logic here
  }
}
```

#### 1.3 Create Test Implementations
**Files**: `src/services/test-implementations/`

**MockLoggerService.ts**
```typescript
export class MockLoggerService implements LoggerService {
  logs: Array<{level: string, message: string, args: any[]}> = [];

  log(message: string, ...args: any[]): void {
    this.logs.push({level: 'log', message, args});
  }

  error(message: string, ...args: any[]): void {
    this.logs.push({level: 'error', message, args});
  }

  warn(message: string, ...args: any[]): void {
    this.logs.push({level: 'warn', message, args});
  }

  info(message: string, ...args: any[]): void {
    this.logs.push({level: 'info', message, args});
  }

  debug(message: string, ...args: any[]): void {
    this.logs.push({level: 'debug', message, args});
  }

  getLogsByLevel(level: string): Array<{message: string, args: any[]}> {
    return this.logs
      .filter(log => log.level === level)
      .map(log => ({message: log.message, args: log.args}));
  }

  getAllLogs(): Array<{level: string, message: string, args: any[]}> {
    return [...this.logs];
  }

  clear(): void {
    this.logs = [];
  }

  hasLog(level: string, message: string): boolean {
    return this.logs.some(log => log.level === level && log.message === message);
  }
}
```

**SilentLoggerService.ts**
```typescript
export class SilentLoggerService implements LoggerService {
  log(): void {}
  error(): void {}
  warn(): void {}
  info(): void {}
  debug(): void {}
}
```

**MockGitService.ts**, **MockFileSystemService.ts**, **MockCommandService.ts**
- Full mock implementations for testing
- Configurable responses
- Error simulation capabilities

#### 1.4 Create Service Container
**File**: `src/services/container.ts`
```typescript
import type { ServiceContainer, LoggerService, GitService, FileSystemService, CommandService } from './types.ts';
import { NodeLoggerService } from './implementations/NodeLoggerService.ts';
import { NodeGitService } from './implementations/NodeGitService.ts';
import { NodeFileSystemService } from './implementations/NodeFileSystemService.ts';
import { NodeCommandService } from './implementations/NodeCommandService.ts';

export interface ServiceContainerOptions {
  logger?: LoggerService;
  git?: GitService;
  fs?: FileSystemService;
  cmd?: CommandService;
}

export function createServiceContainer(options: ServiceContainerOptions = {}): ServiceContainer {
  return {
    logger: options.logger ?? new NodeLoggerService(),
    git: options.git ?? new NodeGitService(),
    fs: options.fs ?? new NodeFileSystemService(),
    cmd: options.cmd ?? new NodeCommandService()
  };
}

export function createTestServiceContainer(options: ServiceContainerOptions = {}): ServiceContainer {
  // Import test implementations
  const { MockLoggerService } = await import('./test-implementations/MockLoggerService.ts');
  const { MockGitService } = await import('./test-implementations/MockGitService.ts');
  const { MockFileSystemService } = await import('./test-implementations/MockFileSystemService.ts');
  const { MockCommandService } = await import('./test-implementations/MockCommandService.ts');

  return {
    logger: options.logger ?? new MockLoggerService(),
    git: options.git ?? new MockGitService(),
    fs: options.fs ?? new MockFileSystemService(),
    cmd: options.cmd ?? new MockCommandService()
  };
}
```

#### 1.5 Update Module Exports
**File**: `src/services/index.ts`
```typescript
export * from './types.ts';
export * from './container.ts';
export * from './implementations/index.ts';
export * from './test-implementations/index.ts';
```

### Phase 2: Core Module Refactoring (3-4 days)

#### 2.1 Refactor `src/git.ts`
**Goals**:
- Move implementations to `NodeGitService`
- Keep existing functions as thin wrappers for backward compatibility
- Accept `LoggerService` for error reporting

**Changes**:
```typescript
// Keep existing function signatures for backward compatibility
export async function executeGitCommand(gitDir: string, args: string[]): Promise<string> {
  const defaultGit = new NodeGitService();
  return defaultGit.executeCommand(gitDir, args);
}

// Add new service-based functions
export class GitOperations {
  constructor(
    private git: GitService,
    private logger: LoggerService
  ) {}

  async executeCommand(gitDir: string, args: string[]): Promise<string> {
    try {
      return await this.git.executeCommand(gitDir, args);
    } catch (error) {
      this.logger.error(`Git command failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // ... other methods
}
```

#### 2.2 Refactor `src/repository.ts`
**Goals**:
- Accept `FileSystemService` and `LoggerService` via constructor
- Replace direct fs calls with service calls
- Keep existing functions for backward compatibility

**Changes**:
```typescript
export class RepositoryOperations {
  constructor(
    private fs: FileSystemService,
    private logger: LoggerService
  ) {}

  async detectRepository(startPath?: string): Promise<RepositoryInfo> {
    // Replace direct fs calls with this.fs calls
    // Replace console calls with this.logger calls
  }

  // ... other methods
}

// Backward compatibility
export async function detectRepository(startPath?: string): Promise<RepositoryInfo> {
  const defaultServices = createServiceContainer();
  const repoOps = new RepositoryOperations(defaultServices.fs, defaultServices.logger);
  return repoOps.detectRepository(startPath);
}
```

#### 2.3 Refactor `src/config.ts`
**Goals**:
- Accept `FileSystemService`, `GitService`, and `LoggerService`
- Replace direct fs calls and git calls with service calls
- Maintain existing function signatures

**Changes**:
```typescript
export class ConfigOperations {
  constructor(
    private fs: FileSystemService,
    private git: GitService,
    private logger: LoggerService
  ) {}

  async loadConfig(repoInfo: RepositoryInfo): Promise<WTConfig> {
    // Replace fs calls with this.fs calls
    // Replace git calls with this.git calls
    // Replace console calls with this.logger calls
  }

  // ... other methods
}

// Backward compatibility
export async function loadConfig(repoInfo: RepositoryInfo): Promise<WTConfig> {
  const defaultServices = createServiceContainer();
  const configOps = new ConfigOperations(defaultServices.fs, defaultServices.git, defaultServices.logger);
  return configOps.loadConfig(repoInfo);
}
```

#### 2.4 Refactor `src/init.ts`
**Goals**:
- Accept full `ServiceContainer`
- Replace all direct calls with service calls

**Changes**:
```typescript
export class InitOperations {
  constructor(private services: ServiceContainer) {}

  async initializeRepository(gitUrl: string, targetName?: string): Promise<void> {
    // Replace fs calls with this.services.fs calls
    // Replace git calls with this.services.git calls
    // Replace console calls with this.services.logger calls
    // Replace command calls with this.services.cmd calls
  }
}

// Backward compatibility
export async function initializeRepository(gitUrl: string, targetName?: string): Promise<void> {
  const defaultServices = createServiceContainer();
  const initOps = new InitOperations(defaultServices);
  return initOps.initializeRepository(gitUrl, targetName);
}
```

### Phase 3: High-Level Module Updates (2-3 days)

#### 3.1 Refactor `src/worktree.ts`
**Goals**:
- Accept full `ServiceContainer`
- Replace all console.* calls with logger calls
- Update all git and command operations to use services

**Key Changes**:
```typescript
export class WorktreeOperations {
  constructor(private services: ServiceContainer) {}

  async listWorktrees(repoInfo: RepositoryInfo): Promise<WorktreeInfo[]> {
    // Replace executeGitCommand with this.services.git calls
    // Replace console calls with this.services.logger calls
  }

  async createWorktreeWithBranch(repoInfo: RepositoryInfo, config: WTConfig, branch: string): Promise<void> {
    // Update all git operations
    // Update all console output
    // Example: this.services.logger.log('Fetching latest changes...');
  }

  // ... all other methods
}

// Update existing functions to use default services
export async function listWorktrees(repoInfo: RepositoryInfo): Promise<WorktreeInfo[]> {
  const defaultServices = createServiceContainer();
  const worktreeOps = new WorktreeOperations(defaultServices);
  return worktreeOps.listWorktrees(repoInfo);
}
```

#### 3.2 Refactor `src/commands/index.ts`
**Goals**:
- Replace ALL 55+ console.* calls with logger calls
- Pass ServiceContainer through to all operations
- Update all command handlers

**Key Changes**:
```typescript
// Update each command to accept ServiceContainer
export function createListCommand(services: ServiceContainer): Command {
  return {
    name: 'list',
    description: 'List all worktrees',
    aliases: ['ls'],
    handler: async () => {
      try {
        const repoOps = new RepositoryOperations(services.fs, services.logger);
        const repoInfo = await repoOps.detectRepository();
        
        const worktreeOps = new WorktreeOperations(services);
        const worktrees = await worktreeOps.listWorktrees(repoInfo);
        
        if (worktrees.length === 0) {
          services.logger.log('No worktrees found.');
          return;
        }
        
        services.logger.log(formatWorktreeHeader());
        for (const worktree of worktrees) {
          services.logger.log(formatWorktree(worktree));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        services.logger.error(`Error listing worktrees: ${message}`);
        
        if (error instanceof RepositoryError) {
          process.exit(EXIT_CODES.GIT_REPO_NOT_FOUND);
        } else {
          process.exit(EXIT_CODES.GENERAL_ERROR);
        }
      }
    }
  };
}

// Export factory function
export function createCommands(services: ServiceContainer): Command[] {
  return [
    createListCommand(services),
    createCreateCommand(services),
    createConfigCommand(services),
    createRemoveCommand(services),
    createPrintDirCommand(services),
    createSetupCommand(services),
    createRunCommand(services),
    createInitCommand(services)
  ];
}
```

#### 3.3 Update `src/cli/cli.ts`
**Goals**:
- Accept LoggerService for error reporting
- Use service-based commands

**Changes**:
```typescript
export class CLI {
  constructor(
    private config: CLIConfig,
    private help: HelpGenerator,
    private logger: LoggerService,
    private commands: Map<string, Command>
  ) {}

  // Update error handling to use this.logger instead of console
  private handleError(error: unknown): void {
    if (error instanceof ExitCodeError) {
      process.exit(error.code);
    }

    if (error instanceof Error) {
      this.logger.error(`Error: ${error.message}`);
      
      if (error.name === 'ValidationError') {
        process.exit(EXIT_CODES.INVALID_ARGUMENTS);
      }
      
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }

    this.logger.error('An unknown error occurred');
    process.exit(EXIT_CODES.GENERAL_ERROR);
  }
}
```

#### 3.4 Update `src/index.ts`
**Goals**:
- Create default service container
- Initialize CLI with services

**Changes**:
```typescript
import { createServiceContainer } from './services/index.ts';
import { createCommands } from './commands/index.ts';

async function main(): Promise<void> {
  try {
    const services = createServiceContainer();
    const commands = createCommands(services);
    
    const cli = new CLI(
      CLI_CONFIG,
      new HelpGenerator(CLI_CONFIG),
      services.logger,
      new Map(commands.map(cmd => [cmd.name, cmd]))
    );

    await cli.run(process.argv);
  } catch (error) {
    // Use console.error here as last resort since services may not be available
    console.error(error instanceof Error ? error.message : 'An unknown error occurred');
    process.exit(EXIT_CODES.GENERAL_ERROR);
  }
}
```

### Phase 4: Testing Integration & Cleanup (2-3 days)

#### 4.1 Update Unit Tests
**Goals**:
- Replace all `mock.module()` usage with service injection
- Use `MockLoggerService` to verify output
- Use `SilentLoggerService` when output isn't relevant

**Example Test Updates**:
```typescript
// Before: Dangerous global mocking
mock.module('node:child_process', () => ({
  spawn: mockSpawn
}));

// After: Safe service injection
test('createWorktreeWithBranch creates new branch', async () => {
  const mockLogger = new MockLoggerService();
  const mockGit = new MockGitService();
  const mockFs = new MockFileSystemService();
  const mockCmd = new MockCommandService();
  
  const services = createServiceContainer({
    logger: mockLogger,
    git: mockGit,
    fs: mockFs,
    cmd: mockCmd
  });

  // Configure mock responses
  mockGit.setCommandResponse(['worktree', 'list', '--porcelain'], '');
  mockGit.setCommandResponse(['branch', '-a'], 'main\n  remotes/origin/main');
  
  const worktreeOps = new WorktreeOperations(services);
  await worktreeOps.createWorktreeWithBranch(repoInfo, config, 'feature');

  // Verify git commands were called
  expect(mockGit.getExecutedCommands()).toContain(['worktree', 'add', ...]);
  
  // Verify output messages
  expect(mockLogger.hasLog('log', 'Created worktree with new branch \'feature\' at ...')).toBe(true);
});
```

#### 4.2 Update Integration Tests
**Goals**:
- Use real service implementations
- Verify end-to-end functionality still works
- Keep subprocess testing functional

**Changes**:
```typescript
test('CLI list command works end-to-end', async () => {
  // Use real services for integration tests
  const services = createServiceContainer();
  const commands = createCommands(services);
  
  // Test with real repository and git commands
  // ...
});
```

#### 4.3 Add Service Container Tests
**Goals**:
- Test service container creation
- Test service interactions
- Test mock service behaviors

**New Test Files**:
- `tests/unit/services/container.test.ts`
- `tests/unit/services/mock-logger.test.ts`
- `tests/unit/services/mock-git.test.ts`
- `tests/unit/services/implementations.test.ts`

#### 4.4 Remove Direct Console Usage
**Goals**:
- Search and replace remaining console.* calls
- Update any missed modules
- Ensure all output goes through LoggerService

**Verification**:
```bash
# Should return no results after cleanup
grep -r "console\." src/ --include="*.ts" | grep -v "test"
```

#### 4.5 Update Documentation
**Goals**:
- Update AGENTS.md with new testing patterns
- Document service injection patterns
- Update test setup instructions

## Testing Strategy

### Unit Tests
- **Service Isolation**: Each service tested in isolation with mocks
- **Output Verification**: Use `MockLoggerService` to verify exact log messages
- **Error Handling**: Test error propagation through service layers
- **Mock Configuration**: Easy setup of mock responses for different scenarios

### Integration Tests
- **Real Services**: Use actual implementations for end-to-end testing
- **Subprocess Safety**: No more global mocks that break subprocess execution
- **Full Workflow**: Test complete user workflows with real git operations

### Test Utilities
```typescript
// Test helper functions
export function createTestServices(overrides: Partial<ServiceContainerOptions> = {}): ServiceContainer {
  return createTestServiceContainer(overrides);
}

export function createSilentServices(): ServiceContainer {
  return createServiceContainer({
    logger: new SilentLoggerService()
  });
}

export function expectLogMessage(mockLogger: MockLoggerService, level: string, message: string): void {
  expect(mockLogger.hasLog(level, message)).toBe(true);
}
```

## Migration Benefits

### Immediate Benefits
1. **Testable Output**: Can verify exact user messages in tests
2. **Isolated Testing**: No more dangerous global mocks
3. **Flexible Logging**: Easy to switch to file logging, structured logging, etc.
4. **Error Tracking**: Centralized error handling and logging

### Long-term Benefits
1. **Extensibility**: Easy to add new service types (HTTP, database, etc.)
2. **Environment Adaptation**: Different implementations for different environments
3. **Performance Monitoring**: Can add timing and metrics to services
4. **Debugging**: Centralized logging makes debugging much easier

### Backward Compatibility
- All existing function signatures preserved
- Existing code continues to work without changes
- Gradual migration path allows incremental adoption
- No breaking changes for external consumers

## Implementation Checklist

### Phase 1: Service Infrastructure
- [ ] Create `src/services/types.ts` with all interfaces
- [ ] Implement `NodeLoggerService`
- [ ] Implement `NodeGitService`
- [ ] Implement `NodeFileSystemService`
- [ ] Implement `NodeCommandService`
- [ ] Implement `MockLoggerService`
- [ ] Implement other mock services
- [ ] Create service container factory
- [ ] Test service container creation
- [ ] Update module exports

### Phase 2: Core Module Refactoring
- [ ] Refactor `src/git.ts` with service classes
- [ ] Refactor `src/repository.ts` with service injection
- [ ] Refactor `src/config.ts` with service injection
- [ ] Refactor `src/init.ts` with service injection
- [ ] Maintain backward compatibility functions
- [ ] Test core module refactoring

### Phase 3: High-Level Module Updates
- [ ] Refactor `src/worktree.ts` to use services
- [ ] Update all command handlers in `src/commands/index.ts`
- [ ] Replace all 99 console.* calls with logger calls
- [ ] Update `src/cli/cli.ts` error handling
- [ ] Update `src/index.ts` service initialization
- [ ] Test command handler updates

### Phase 4: Testing Integration & Cleanup
- [ ] Update all unit tests to use service injection
- [ ] Remove dangerous global mocks
- [ ] Add comprehensive service tests
- [ ] Update integration tests
- [ ] Verify no remaining console.* calls in src/
- [ ] Update documentation
- [ ] Run full test suite
- [ ] Performance testing

## Timeline

- **Phase 1**: 2-3 days (service infrastructure)
- **Phase 2**: 3-4 days (core module refactoring)  
- **Phase 3**: 2-3 days (high-level module updates)
- **Phase 4**: 2-3 days (testing integration & cleanup)

**Total Estimated Time**: 9-13 days

## Success Criteria

1. **All tests pass**: Both unit and integration tests work correctly
2. **No console.* in src/**: All output goes through LoggerService
3. **No global mocks**: Unit tests use service injection only
4. **Backward compatibility**: Existing functions still work
5. **Performance maintained**: No significant performance regression
6. **Documentation updated**: AGENTS.md reflects new patterns

This implementation will significantly improve the testability and maintainability of the WT codebase while preserving existing functionality and providing a foundation for future enhancements.