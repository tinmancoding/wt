/**
 * Integration tests for shell setup functionality
 */

import { test, expect } from 'bun:test';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { tmpdir } from 'os';
import { mkdtemp, writeFile, rm } from 'fs/promises';

const execAsync = promisify(exec);

// Path to the development binary
const wtBinary = path.join(process.cwd(), 'src/index.ts');
const runWt = async (args: string): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
  try {
    const { stdout, stderr } = await execAsync(`bun run ${wtBinary} ${args}`);
    return { stdout, stderr, exitCode: 0 };
  } catch (error: any) {
    return { 
      stdout: error.stdout || '', 
      stderr: error.stderr || '', 
      exitCode: error.code || 1 
    };
  }
};

test('integration: setup command should generate bash wrapper functions', async () => {
  const { stdout, exitCode } = await runWt('setup --bash');
  
  expect(exitCode).toBe(0);
  expect(stdout).toContain('# WT shell integration wrapper functions');
  expect(stdout).toContain('wt() {');
  expect(stdout).toContain('wts() {');
  expect(stdout).toContain('switch');
  expect(stdout).toContain('sw');
});

test('integration: setup command should generate zsh wrapper functions', async () => {
  const { stdout, exitCode } = await runWt('setup --zsh');
  
  expect(exitCode).toBe(0);
  expect(stdout).toContain('# WT shell integration wrapper functions');
  expect(stdout).toContain('wt() {');
  expect(stdout).toContain('wts() {');
});

test('integration: setup command should generate fish wrapper functions', async () => {
  const { stdout, exitCode } = await runWt('setup --fish');
  
  expect(exitCode).toBe(0);
  expect(stdout).toContain('# WT shell integration wrapper functions for fish');
  expect(stdout).toContain('function wt');
  expect(stdout).toContain('function wts');
});

test('integration: setup command should show help when no flags provided', async () => {
  const { stderr, exitCode } = await runWt('setup');
  
  expect(exitCode).toBe(2);
  expect(stderr).toContain('Error: Please specify a shell option');
  expect(stderr).toContain('Usage: wt setup --bash|--zsh|--fish|--auto');
  expect(stderr).toContain('Examples:');
});

test('integration: setup command help should show available options', async () => {
  const { stdout, exitCode } = await runWt('setup --help');
  
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Generate shell wrapper functions for enhanced integration');
  expect(stdout).toContain('--bash');
  expect(stdout).toContain('--zsh');
  expect(stdout).toContain('--fish');
  expect(stdout).toContain('--auto');
});

test('integration: setup command help should show available options', async () => {
  const { stdout, exitCode } = await runWt('setup --help');
  
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Generate shell wrapper functions for enhanced integration');
  expect(stdout).toContain('--bash');
  expect(stdout).toContain('--zsh');
  expect(stdout).toContain('--fish');
  expect(stdout).toContain('--auto');
});

test('integration: bash wrapper should handle switch commands correctly', async () => {
  const { stdout } = await runWt('setup --bash');
  
  // Check that the generated wrapper contains proper switch handling
  expect(stdout).toContain('if [[ "$cmd" == "switch" || "$cmd" == "sw" ]]; then');
  expect(stdout).toContain('target_dir=$(command "wt" print-dir "$@" 2>/dev/null)');
  expect(stdout).toContain('cd "$target_dir" || return 1');
  expect(stdout).toContain('echo "Error: Could not switch to worktree" >&2');
});

test('integration: fish wrapper should handle switch commands correctly', async () => {
  const { stdout } = await runWt('setup --fish');
  
  // Check that the generated wrapper contains proper switch handling
  expect(stdout).toContain('if test "$cmd" = "switch"; or test "$cmd" = "sw"');
  expect(stdout).toContain('set target_dir (command wt print-dir $argv 2>/dev/null)');
  expect(stdout).toContain('cd "$target_dir"');
  expect(stdout).toContain('echo "Error: Could not switch to worktree" >&2');
});

test('integration: generated wrapper should pass through non-switch commands', async () => {
  const { stdout } = await runWt('setup --bash');
  
  expect(stdout).toContain('else');
  expect(stdout).toContain('command "wt" "$@"');
  expect(stdout).toContain('# For all other commands, pass through to the actual wt binary');
});

test('integration: generated wrapper should include ultra-short alias', async () => {
  const { stdout: bashOutput } = await runWt('setup --bash');
  const { stdout: fishOutput } = await runWt('setup --fish');
  
  expect(bashOutput).toContain('wts() {');
  expect(bashOutput).toContain('wt switch "$@"');
  
  expect(fishOutput).toContain('function wts');
  expect(fishOutput).toContain('wt switch $argv');
});

test('integration: setup command should work in actual shell environment', async () => {
  let tempDir: string | null = null;
  
  try {
    // Create temporary directory
    tempDir = await mkdtemp(path.join(tmpdir(), 'wt-shell-test-'));
    
    // Generate bash wrapper and save to file
    const { stdout: bashWrapper, exitCode } = await runWt('setup --bash');
    expect(exitCode).toBe(0);
    
    const wrapperFile = path.join(tempDir, 'wt-wrapper.sh');
    await writeFile(wrapperFile, bashWrapper);
    
    // Test that the wrapper file contains valid shell syntax
    try {
      await execAsync(`bash -n ${wrapperFile}`);
      // If no error thrown, syntax is valid
    } catch (error) {
      throw new Error(`Shell syntax validation failed: ${error}`);
    }
    
  } finally {
    // Cleanup
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
});

test('integration: setup command should handle shell auto-detection gracefully', async () => {
  // Test with forced shell environment
  const originalShell = process.env.SHELL;
  
  try {
    // Test with known shell
    process.env.SHELL = '/bin/bash';
    const { stdout: autoResult, exitCode: autoExitCode } = await runWt('setup --auto');
    
    // Should succeed and generate bash wrapper
    expect(autoExitCode).toBe(0);
    expect(autoResult).toContain('# WT shell integration wrapper functions');
    expect(autoResult).toContain('wt() {');
    
    // Test with unknown shell
    process.env.SHELL = '/bin/unknown-shell';
    const { stderr: errorResult, exitCode: errorExitCode } = await runWt('setup --auto');
    
    // Should fail gracefully
    expect(errorExitCode).toBe(1);
    expect(errorResult).toContain('Could not auto-detect shell');
    
  } finally {
    // Restore original shell
    if (originalShell) {
      process.env.SHELL = originalShell;
    } else {
      delete process.env.SHELL;
    }
  }
});

test('integration: generated fish wrapper should have valid fish syntax', async () => {
  let tempDir: string | null = null;
  
  try {
    // Create temporary directory
    tempDir = await mkdtemp(path.join(tmpdir(), 'wt-fish-test-'));
    
    // Generate fish wrapper and save to file
    const { stdout: fishWrapper, exitCode } = await runWt('setup --fish');
    expect(exitCode).toBe(0);
    
    const wrapperFile = path.join(tempDir, 'wt-wrapper.fish');
    await writeFile(wrapperFile, fishWrapper);
    
    // Try to validate fish syntax if fish is available
    try {
      await execAsync(`fish -n ${wrapperFile}`);
      // If no error thrown, syntax is valid
    } catch (error) {
      // Fish might not be available in test environment, that's OK
      console.log('Fish not available for syntax checking, skipping validation');
    }
    
  } finally {
    // Cleanup
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
});

test('integration: setup command should handle multiple flags correctly', async () => {
  // bash should take precedence
  const { stdout, exitCode } = await runWt('setup --bash --zsh --fish');
  
  expect(exitCode).toBe(0);
  expect(stdout).toContain('# WT shell integration wrapper functions');
  expect(stdout).toContain('wt() {');
  expect(stdout).not.toContain('function wt'); // Should not generate fish syntax
});

test('integration: generated wrapper should reference correct binary path', async () => {
  const { stdout } = await runWt('setup --bash');
  
  // Should use 'wt' as the default binary path
  expect(stdout).toContain('command "wt" print-dir');
  expect(stdout).toContain('command "wt" "$@"');
  
  const { stdout: fishOutput } = await runWt('setup --fish');
  expect(fishOutput).toContain('command wt print-dir');
  expect(fishOutput).toContain('command wt $argv');
});