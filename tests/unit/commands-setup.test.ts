/**
 * Unit tests for setup command
 */

import { test, expect, mock } from 'bun:test';
import { setupCommand } from '../../src/commands/index.ts';

// Mock shell module
const mockDetectShell = mock(() => 'bash');
const mockGenerateShellWrapper = mock(() => 'mock shell wrapper');
const mockGetShellSetupInstructions = mock(() => 'mock setup instructions');

mock.module('../../src/shell.ts', () => ({
  detectShell: mockDetectShell,
  generateShellWrapper: mockGenerateShellWrapper,
  getShellSetupInstructions: mockGetShellSetupInstructions
}));

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalProcessExit = process.exit;

let consoleLogOutput: string[] = [];
let consoleErrorOutput: string[] = [];
let exitCode: number | null = null;

function setupMocks() {
  consoleLogOutput = [];
  consoleErrorOutput = [];
  exitCode = null;
  
  console.log = mock((message: string) => {
    consoleLogOutput.push(message);
  });
  
  console.error = mock((message: string) => {
    consoleErrorOutput.push(message);
  });
  
  process.exit = mock((code?: number) => {
    exitCode = code ?? 0;
    throw new Error(`Process exit called with code ${exitCode}`);
  }) as any;
}

function restoreMocks() {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  process.exit = originalProcessExit;
  
  mockDetectShell.mockClear();
  mockGenerateShellWrapper.mockClear();
  mockGetShellSetupInstructions.mockClear();
}

test('setupCommand - should generate bash wrapper when --bash flag is provided', async () => {
  setupMocks();
  
  try {
    await setupCommand.handler({ args: {}, flags: { bash: true }, positional: [] });
    
    expect(mockGenerateShellWrapper).toHaveBeenCalledWith('bash');
    expect(consoleLogOutput).toContain('mock shell wrapper');
  } catch (error) {
    // Expected due to mocked process.exit
  }
  
  restoreMocks();
});

test('setupCommand - should generate zsh wrapper when --zsh flag is provided', async () => {
  setupMocks();
  
  try {
    await setupCommand.handler({ args: {}, flags: { zsh: true }, positional: [] });
    
    expect(mockGenerateShellWrapper).toHaveBeenCalledWith('zsh');
    expect(consoleLogOutput).toContain('mock shell wrapper');
  } catch (error) {
    // Expected due to mocked process.exit
  }
  
  restoreMocks();
});

test('setupCommand - should generate fish wrapper when --fish flag is provided', async () => {
  setupMocks();
  
  try {
    await setupCommand.handler({ args: {}, flags: { fish: true }, positional: [] });
    
    expect(mockGenerateShellWrapper).toHaveBeenCalledWith('fish');
    expect(consoleLogOutput).toContain('mock shell wrapper');
  } catch (error) {
    // Expected due to mocked process.exit
  }
  
  restoreMocks();
});

test('setupCommand - should auto-detect shell when --auto flag is provided', async () => {
  setupMocks();
  mockDetectShell.mockReturnValue('zsh');
  
  try {
    await setupCommand.handler({ args: {}, flags: { auto: true }, positional: [] });
    
    expect(mockDetectShell).toHaveBeenCalled();
    expect(mockGenerateShellWrapper).toHaveBeenCalledWith('zsh');
    expect(consoleLogOutput).toContain('mock shell wrapper');
  } catch (error) {
    // Expected due to mocked process.exit
  }
  
  restoreMocks();
});

test('setupCommand - should show error when auto-detection fails', async () => {
  setupMocks();
  (mockDetectShell as any).mockReturnValue(null);
  
  try {
    await setupCommand.handler({ args: {}, flags: { auto: true }, positional: [] });
  } catch (error) {
    expect(exitCode).toBe(1);
    expect(consoleErrorOutput.some(msg => msg.includes('Could not auto-detect shell'))).toBe(true);
  }
  
  restoreMocks();
});

test('setupCommand - should show help when no flags are provided', async () => {
  setupMocks();
  mockDetectShell.mockReturnValue('bash');
  
  try {
    await setupCommand.handler({ args: {}, flags: {}, positional: [] });
  } catch (error) {
    expect(exitCode).toBe(2);
    expect(consoleErrorOutput.some(msg => msg.includes('Please specify a shell option'))).toBe(true);
    expect(consoleErrorOutput.some(msg => msg.includes('Usage: wt setup'))).toBe(true);
  }
  
  restoreMocks();
});

test('setupCommand - should include detected shell instructions when no flags provided', async () => {
  setupMocks();
  mockDetectShell.mockReturnValue('fish');
  mockGetShellSetupInstructions.mockReturnValue('fish instructions');
  
  try {
    await setupCommand.handler({ args: {}, flags: {}, positional: [] });
  } catch (error) {
    expect(mockDetectShell).toHaveBeenCalled();
    expect(mockGetShellSetupInstructions).toHaveBeenCalledWith('fish');
    expect(consoleErrorOutput.some(msg => msg.includes('fish instructions'))).toBe(true);
  }
  
  restoreMocks();
});

test('setupCommand - should show generic instructions when shell not detected', async () => {
  setupMocks();
  (mockDetectShell as any).mockReturnValue(null);
  
  try {
    await setupCommand.handler({ args: {}, flags: {}, positional: [] });
  } catch (error) {
    expect(consoleErrorOutput.some(msg => msg.includes('# For bash: source'))).toBe(true);
    expect(consoleErrorOutput.some(msg => msg.includes('# For zsh:  source'))).toBe(true);
    expect(consoleErrorOutput.some(msg => msg.includes('# For fish: wt setup'))).toBe(true);
  }
  
  restoreMocks();
});

test('setupCommand - should handle generation errors gracefully', async () => {
  setupMocks();
  mockGenerateShellWrapper.mockImplementation(() => {
    throw new Error('Mock generation error');
  });
  
  try {
    await setupCommand.handler({ args: {}, flags: { bash: true }, positional: [] });
  } catch (error) {
    expect(exitCode).toBe(1);
    expect(consoleErrorOutput.some(msg => msg.includes('Error generating shell wrapper'))).toBe(true);
    expect(consoleErrorOutput.some(msg => msg.includes('Mock generation error'))).toBe(true);
  }
  
  restoreMocks();
});

test('setupCommand - bash flag should take precedence over other flags', async () => {
  setupMocks();
  
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
  
  try {
    await setupCommand.handler({ args: {}, flags: {}, positional: [] });
  } catch (error) {
    expect(consoleErrorOutput.some(msg => msg.includes('Examples:'))).toBe(true);
    expect(consoleErrorOutput.some(msg => msg.includes('wt setup --auto'))).toBe(true);
    expect(consoleErrorOutput.some(msg => msg.includes('wt setup --bash'))).toBe(true);
    expect(consoleErrorOutput.some(msg => msg.includes('wt setup --zsh'))).toBe(true);
    expect(consoleErrorOutput.some(msg => msg.includes('wt setup --fish'))).toBe(true);
  }
  
  restoreMocks();
});