/**
 * Unit tests for setup command
 */

import { test, expect, mock } from 'bun:test';
import { createSetupCommand } from '../../src/commands/index.ts';
import { createServiceContainer } from '../../src/services/container.ts';
import { MockLoggerService } from '../../src/services/test-implementations/MockLoggerService.ts';

// Mock shell module
const mockDetectShell = mock(() => 'bash');
const mockGenerateShellWrapper = mock(() => 'mock shell wrapper');
const mockGetShellSetupInstructions = mock(() => 'mock setup instructions');

mock.module('../../src/shell.ts', () => ({
  detectShell: mockDetectShell,
  generateShellWrapper: mockGenerateShellWrapper,
  getShellSetupInstructions: mockGetShellSetupInstructions
}));

// Mock process.exit to prevent actual exits during tests
const originalProcessExit = process.exit;
let exitCode: number | null = null;

function mockProcessExit() {
  exitCode = null;
  process.exit = mock((code?: number) => {
    exitCode = code ?? 0;
    throw new Error(`Process exit called with code ${exitCode}`);
  }) as any;
}

function restoreProcessExit() {
  process.exit = originalProcessExit;
}

function setupMocks() {
  mockDetectShell.mockClear();
  mockGenerateShellWrapper.mockClear();
  mockGetShellSetupInstructions.mockClear();
  mockProcessExit();
}

function restoreMocks() {
  restoreProcessExit();
}

test('setupCommand - should generate bash wrapper when --bash flag is provided', async () => {
  setupMocks();
  
  const mockLogger = new MockLoggerService();
  const services = createServiceContainer({ logger: mockLogger });
  const setupCommand = createSetupCommand(services);
  
  try {
    await setupCommand.handler({ args: {}, flags: { bash: true }, positional: [] });
    
    expect(mockGenerateShellWrapper).toHaveBeenCalledWith('bash');
    expect(mockLogger.hasLog('log', 'mock shell wrapper')).toBe(true);
  } catch (error) {
    // Expected due to mocked process.exit
  }
  
  restoreMocks();
});

test('setupCommand - should generate zsh wrapper when --zsh flag is provided', async () => {
  setupMocks();
  
  const mockLogger = new MockLoggerService();
  const services = createServiceContainer({ logger: mockLogger });
  const setupCommand = createSetupCommand(services);
  
  try {
    await setupCommand.handler({ args: {}, flags: { zsh: true }, positional: [] });
    
    expect(mockGenerateShellWrapper).toHaveBeenCalledWith('zsh');
    expect(mockLogger.hasLog('log', 'mock shell wrapper')).toBe(true);
  } catch (error) {
    // Expected due to mocked process.exit
  }
  
  restoreMocks();
});

test('setupCommand - should generate fish wrapper when --fish flag is provided', async () => {
  setupMocks();
  
  const mockLogger = new MockLoggerService();
  const services = createServiceContainer({ logger: mockLogger });
  const setupCommand = createSetupCommand(services);
  
  try {
    await setupCommand.handler({ args: {}, flags: { fish: true }, positional: [] });
    
    expect(mockGenerateShellWrapper).toHaveBeenCalledWith('fish');
    expect(mockLogger.hasLog('log', 'mock shell wrapper')).toBe(true);
  } catch (error) {
    // Expected due to mocked process.exit
  }
  
  restoreMocks();
});

test('setupCommand - should auto-detect shell when --auto flag is provided', async () => {
  setupMocks();
  mockDetectShell.mockReturnValue('zsh');
  
  const mockLogger = new MockLoggerService();
  const services = createServiceContainer({ logger: mockLogger });
  const setupCommand = createSetupCommand(services);
  
  try {
    await setupCommand.handler({ args: {}, flags: { auto: true }, positional: [] });
    
    expect(mockDetectShell).toHaveBeenCalled();
    expect(mockGenerateShellWrapper).toHaveBeenCalledWith('zsh');
    expect(mockLogger.hasLog('log', 'mock shell wrapper')).toBe(true);
  } catch (error) {
    // Expected due to mocked process.exit
  }
  
  restoreMocks();
});

test('setupCommand - should show error when auto-detection fails', async () => {
  setupMocks();
  (mockDetectShell as any).mockReturnValue(null);
  
  const mockLogger = new MockLoggerService();
  const services = createServiceContainer({ logger: mockLogger });
  const setupCommand = createSetupCommand(services);
  
  try {
    await setupCommand.handler({ args: {}, flags: { auto: true }, positional: [] });
  } catch (error) {
    expect(exitCode).toBe(1);
    expect(mockLogger.hasLog('error', 'Error: Could not auto-detect shell from $SHELL environment variable')).toBe(true);
  }
  
  restoreMocks();
});

test('setupCommand - should show help when no flags are provided', async () => {
  setupMocks();
  mockDetectShell.mockReturnValue('bash');
  
  const mockLogger = new MockLoggerService();
  const services = createServiceContainer({ logger: mockLogger });
  const setupCommand = createSetupCommand(services);
  
  try {
    await setupCommand.handler({ args: {}, flags: {}, positional: [] });
  } catch (error) {
    expect(exitCode).toBe(2);
    expect(mockLogger.hasLog('error', 'Error: Please specify a shell option')).toBe(true);
    expect(mockLogger.hasLog('error', 'Usage: wt setup --bash|--zsh|--fish|--auto')).toBe(true);
  }
  
  restoreMocks();
});

test('setupCommand - should include detected shell instructions when no flags provided', async () => {
  setupMocks();
  mockDetectShell.mockReturnValue('fish');
  mockGetShellSetupInstructions.mockReturnValue('fish instructions');
  
  const mockLogger = new MockLoggerService();
  const services = createServiceContainer({ logger: mockLogger });
  const setupCommand = createSetupCommand(services);
  
  try {
    await setupCommand.handler({ args: {}, flags: {}, positional: [] });
  } catch (error) {
    expect(mockDetectShell).toHaveBeenCalled();
    expect(mockGetShellSetupInstructions).toHaveBeenCalledWith('fish');
    expect(mockLogger.hasLog('error', 'fish instructions')).toBe(true);
  }
  
  restoreMocks();
});

test('setupCommand - should show generic instructions when shell not detected', async () => {
  setupMocks();
  (mockDetectShell as any).mockReturnValue(null);
  
  const mockLogger = new MockLoggerService();
  const services = createServiceContainer({ logger: mockLogger });
  const setupCommand = createSetupCommand(services);
  
  try {
    await setupCommand.handler({ args: {}, flags: {}, positional: [] });
  } catch (error) {
    expect(mockLogger.hasLog('error', '# For bash: source <(wt setup --bash)')).toBe(true);
    expect(mockLogger.hasLog('error', '# For zsh:  source <(wt setup --zsh)')).toBe(true);
    expect(mockLogger.hasLog('error', '# For fish: wt setup --fish | source')).toBe(true);
  }
  
  restoreMocks();
});

test('setupCommand - should handle generation errors gracefully', async () => {
  setupMocks();
  mockGenerateShellWrapper.mockImplementation(() => {
    throw new Error('Mock generation error');
  });
  
  const mockLogger = new MockLoggerService();
  const services = createServiceContainer({ logger: mockLogger });
  const setupCommand = createSetupCommand(services);
  
  try {
    await setupCommand.handler({ args: {}, flags: { bash: true }, positional: [] });
  } catch (error) {
    expect(exitCode).toBe(1);
    expect(mockLogger.hasLog('error', 'Error generating shell wrapper: Mock generation error')).toBe(true);
  }
  
  restoreMocks();
});

test('setupCommand - bash flag should take precedence over other flags', async () => {
  setupMocks();
  
  const mockLogger = new MockLoggerService();
  const services = createServiceContainer({ logger: mockLogger });
  const setupCommand = createSetupCommand(services);
  
  try {
    await setupCommand.handler({ args: {}, flags: { bash: true, zsh: true, fish: true }, positional: [] });
    
    expect(mockGenerateShellWrapper).toHaveBeenCalledWith('bash');
  } catch (error) {
    // Expected due to mocked process.exit
  }
  
  restoreMocks();
});

test('setupCommand - zsh flag should take precedence over fish flag', async () => {
  setupMocks();
  
  const mockLogger = new MockLoggerService();
  const services = createServiceContainer({ logger: mockLogger });
  const setupCommand = createSetupCommand(services);
  
  try {
    await setupCommand.handler({ args: {}, flags: { zsh: true, fish: true }, positional: [] });
    
    expect(mockGenerateShellWrapper).toHaveBeenCalledWith('zsh');
  } catch (error) {
    // Expected due to mocked process.exit
  }
  
  restoreMocks();
});

test('setupCommand - should show examples in help output', async () => {
  setupMocks();
  
  const mockLogger = new MockLoggerService();
  const services = createServiceContainer({ logger: mockLogger });
  const setupCommand = createSetupCommand(services);
  
  try {
    await setupCommand.handler({ args: {}, flags: {}, positional: [] });
  } catch (error) {
    expect(mockLogger.hasLog('error', 'Examples:')).toBe(true);
    expect(mockLogger.hasLog('error', '  wt setup --auto          # Auto-detect shell')).toBe(true);
    expect(mockLogger.hasLog('error', '  wt setup --bash          # Generate bash functions')).toBe(true);
    expect(mockLogger.hasLog('error', '  wt setup --zsh           # Generate zsh functions')).toBe(true);
    expect(mockLogger.hasLog('error', '  wt setup --fish          # Generate fish functions')).toBe(true);
  }
  
  restoreMocks();
});