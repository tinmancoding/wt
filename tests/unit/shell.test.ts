/**
 * Unit tests for shell integration functionality
 */

import { test, expect } from 'bun:test';
import { detectShell, generateShellWrapper, getShellSetupInstructions, type SupportedShell } from '../../src/shell.ts';

// Save original environment
const originalShell = process.env.SHELL;

// Cleanup function
function restoreEnvironment() {
  process.env.SHELL = originalShell;
}

test('detectShell - should detect bash from SHELL environment variable', () => {
  process.env.SHELL = '/bin/bash';
  expect(detectShell()).toBe('bash');
  restoreEnvironment();
});

test('detectShell - should detect zsh from SHELL environment variable', () => {
  process.env.SHELL = '/bin/zsh';
  expect(detectShell()).toBe('zsh');
  restoreEnvironment();
});

test('detectShell - should detect fish from SHELL environment variable', () => {
  process.env.SHELL = '/usr/bin/fish';
  expect(detectShell()).toBe('fish');
  restoreEnvironment();
});

test('detectShell - should detect shell with complex path', () => {
  process.env.SHELL = '/usr/local/bin/zsh';
  expect(detectShell()).toBe('zsh');
  restoreEnvironment();
});

test('detectShell - should handle case variations', () => {
  process.env.SHELL = '/bin/ZSH';
  expect(detectShell()).toBe('zsh');
  restoreEnvironment();
});

test('detectShell - should return null for unsupported shell', () => {
  process.env.SHELL = '/bin/sh';
  expect(detectShell()).toBe(null);
  restoreEnvironment();
});

test('detectShell - should return null for invalid shell path', () => {
  process.env.SHELL = '/bin/some-unknown-shell';
  expect(detectShell()).toBe(null);
  restoreEnvironment();
});

test('detectShell - should return null when SHELL is not set', () => {
  delete process.env.SHELL;
  expect(detectShell()).toBe(null);
  restoreEnvironment();
});

test('detectShell - should return null when SHELL is empty', () => {
  process.env.SHELL = '';
  expect(detectShell()).toBe(null);
  restoreEnvironment();
});

test('generateShellWrapper - should generate bash wrapper with default binary path', () => {
  const wrapper = generateShellWrapper('bash');
  
  expect(wrapper).toContain('# WT shell integration wrapper functions');
  expect(wrapper).toContain('wt() {');
  expect(wrapper).toContain('wts() {');
  expect(wrapper).toContain('command "wt" print-dir');
  expect(wrapper).toContain('command "wt" "$@"');
  expect(wrapper).toContain('switch');
  expect(wrapper).toContain('sw');
});

test('generateShellWrapper - should generate bash wrapper with custom binary path', () => {
  const wrapper = generateShellWrapper('bash', '/usr/local/bin/wt');
  
  expect(wrapper).toContain('command "/usr/local/bin/wt" print-dir');
  expect(wrapper).toContain('command "/usr/local/bin/wt" "$@"');
});

test('generateShellWrapper - should generate zsh wrapper (same as bash)', () => {
  const bashWrapper = generateShellWrapper('bash');
  const zshWrapper = generateShellWrapper('zsh');
  
  expect(bashWrapper).toBe(zshWrapper);
});

test('generateShellWrapper - should generate fish wrapper with proper syntax', () => {
  const wrapper = generateShellWrapper('fish');
  
  expect(wrapper).toContain('# WT shell integration wrapper functions for fish');
  expect(wrapper).toContain('function wt');
  expect(wrapper).toContain('function wts');
  expect(wrapper).toContain('command wt print-dir');
  expect(wrapper).toContain('command wt $argv');
  expect(wrapper).toContain('test "$cmd" = "switch"');
  expect(wrapper).toContain('test "$cmd" = "sw"');
});

test('generateShellWrapper - should generate fish wrapper with custom binary path', () => {
  const wrapper = generateShellWrapper('fish', '/usr/local/bin/wt');
  
  expect(wrapper).toContain('command /usr/local/bin/wt print-dir');
  expect(wrapper).toContain('command /usr/local/bin/wt $argv');
});

test('generateShellWrapper - should throw error for unsupported shell', () => {
  expect(() => {
    generateShellWrapper('unsupported' as SupportedShell);
  }).toThrow('Unsupported shell: unsupported');
});

test('generateShellWrapper - bash/zsh wrapper should handle switch command', () => {
  const wrapper = generateShellWrapper('bash');
  
  // Check that switch command handling is present
  expect(wrapper).toContain('if [[ "$cmd" == "switch" || "$cmd" == "sw" ]]; then');
  expect(wrapper).toContain('shift  # Remove the command from arguments');
  expect(wrapper).toContain('target_dir=$(command "wt" print-dir "$@" 2>/dev/null)');
  expect(wrapper).toContain('cd "$target_dir" || return 1');
});

test('generateShellWrapper - bash/zsh wrapper should handle error cases', () => {
  const wrapper = generateShellWrapper('bash');
  
  expect(wrapper).toContain('if [[ $? -eq 0 && -n "$target_dir" && -d "$target_dir" ]]; then');
  expect(wrapper).toContain('echo "Error: Could not switch to worktree" >&2');
  expect(wrapper).toContain('return 1');
});

test('generateShellWrapper - fish wrapper should handle switch command', () => {
  const wrapper = generateShellWrapper('fish');
  
  expect(wrapper).toContain('if test "$cmd" = "switch"; or test "$cmd" = "sw"');
  expect(wrapper).toContain('set -e argv[1]  # Remove the command from arguments');
  expect(wrapper).toContain('set target_dir (command wt print-dir $argv 2>/dev/null)');
  expect(wrapper).toContain('cd "$target_dir"');
});

test('generateShellWrapper - fish wrapper should handle error cases', () => {
  const wrapper = generateShellWrapper('fish');
  
  expect(wrapper).toContain('if test $status -eq 0; and test -n "$target_dir"; and test -d "$target_dir"');
  expect(wrapper).toContain('echo "Error: Could not switch to worktree" >&2');
  expect(wrapper).toContain('return 1');
});

test('generateShellWrapper - bash/zsh wrapper should include wts alias', () => {
  const wrapper = generateShellWrapper('bash');
  
  expect(wrapper).toContain('wts() {');
  expect(wrapper).toContain('wt switch "$@"');
});

test('generateShellWrapper - fish wrapper should include wts alias', () => {
  const wrapper = generateShellWrapper('fish');
  
  expect(wrapper).toContain('function wts');
  expect(wrapper).toContain('wt switch $argv');
});

test('getShellSetupInstructions - should return correct instructions for bash', () => {
  const instructions = getShellSetupInstructions('bash');
  
  expect(instructions).toContain('~/.bashrc');
  expect(instructions).toContain('source <(wt setup --bash)');
});

test('getShellSetupInstructions - should return correct instructions for zsh', () => {
  const instructions = getShellSetupInstructions('zsh');
  
  expect(instructions).toContain('~/.zshrc');
  expect(instructions).toContain('source <(wt setup --zsh)');
});

test('getShellSetupInstructions - should return correct instructions for fish', () => {
  const instructions = getShellSetupInstructions('fish');
  
  expect(instructions).toContain('~/.config/fish/config.fish');
  expect(instructions).toContain('wt setup --fish | source');
});

test('getShellSetupInstructions - should throw error for unsupported shell', () => {
  expect(() => {
    getShellSetupInstructions('unsupported' as SupportedShell);
  }).toThrow('Unsupported shell: unsupported');
});

test('generateShellWrapper - bash/zsh wrapper should pass through non-switch commands', () => {
  const wrapper = generateShellWrapper('bash');
  
  // Should have an else clause that passes through to the actual binary
  expect(wrapper).toContain('else');
  expect(wrapper).toContain('command "wt" "$@"');
  expect(wrapper).toContain('# For all other commands, pass through to the actual wt binary');
});

test('generateShellWrapper - fish wrapper should pass through non-switch commands', () => {
  const wrapper = generateShellWrapper('fish');
  
  // Should have an else clause that passes through to the actual binary
  expect(wrapper).toContain('else');
  expect(wrapper).toContain('command wt $argv');
  expect(wrapper).toContain('# For all other commands, pass through to the actual wt binary');
});

test('generateShellWrapper - should escape shell metacharacters in paths', () => {
  const wrapper = generateShellWrapper('bash', '/path with spaces/wt');
  
  expect(wrapper).toContain('command "/path with spaces/wt"');
});

test('generateShellWrapper - bash wrapper should use proper shell syntax', () => {
  const wrapper = generateShellWrapper('bash');
  
  // Check for bash-specific syntax
  expect(wrapper).toContain('local cmd="$1"');
  expect(wrapper).toContain('local target_dir');
  expect(wrapper).toContain('[[ ');
  expect(wrapper).toContain('shift');
});

test('generateShellWrapper - fish wrapper should use proper fish syntax', () => {
  const wrapper = generateShellWrapper('fish');
  
  // Check for fish-specific syntax
  expect(wrapper).toContain('set cmd $argv[1]');
  expect(wrapper).toContain('set target_dir');
  expect(wrapper).toContain('test ');
  expect(wrapper).toContain('set -e argv[1]');
});