import { test, expect } from 'bun:test';
import { MockGitService } from '../../../src/services/test-implementations/MockGitService.ts';
import type { GitCommandResult } from '../../../src/services/types.ts';

test('MockGitService executeCommand returns configured response', async () => {
  const mockGit = new MockGitService();
  const expectedOutput = 'branch1\nbranch2';
  
  mockGit.setCommandResponse(['branch', '-a'], expectedOutput);
  
  const result = await mockGit.executeCommand('/repo', ['branch', '-a']);
  expect(result).toBe(expectedOutput);
});

test('MockGitService executeCommandWithResult returns configured response', async () => {
  const mockGit = new MockGitService();
  const expectedResult: GitCommandResult = { stdout: 'success output', stderr: '', exitCode: 0 };
  
  mockGit.setCommandResponse(['status'], expectedResult);
  
  const result = await mockGit.executeCommandWithResult('/repo', ['status']);
  expect(result).toEqual(expectedResult);
});

test('MockGitService executeCommandInDir returns configured response', async () => {
  const mockGit = new MockGitService();
  const expectedOutput = 'commit hash';
  
  mockGit.setCommandResponse(['rev-parse', 'HEAD'], expectedOutput);
  
  const result = await mockGit.executeCommandInDir('/workdir', ['rev-parse', 'HEAD']);
  expect(result).toBe(expectedOutput);
});

test('MockGitService tracks executed commands', async () => {
  const mockGit = new MockGitService();
  
  mockGit.setCommandResponse(['branch'], 'main');
  mockGit.setCommandResponse(['status'], 'clean');
  
  await mockGit.executeCommand('/repo', ['branch']);
  await mockGit.executeCommand('/repo', ['status']);
  
  const executedCommands = mockGit.getExecutedCommands();
  expect(executedCommands).toHaveLength(2);
  expect(executedCommands[0]).toEqual({ gitDir: '/repo', args: ['branch'] });
  expect(executedCommands[1]).toEqual({ gitDir: '/repo', args: ['status'] });
});

test('MockGitService tracks commands with directories', async () => {
  const mockGit = new MockGitService();
  
  mockGit.setCommandResponse(['log'], 'commit log');
  
  await mockGit.executeCommand('/repo1', ['log']);
  
  const commandsWithDirs = mockGit.getExecutedCommands();
  expect(commandsWithDirs).toHaveLength(1);
  expect(commandsWithDirs[0]).toEqual({ gitDir: '/repo1', args: ['log'] });
});

test('MockGitService tracks executeCommandInDir separately', async () => {
  const mockGit = new MockGitService();
  
  mockGit.setCommandResponse(['log'], 'commit log');
  
  await mockGit.executeCommandInDir('/workdir', ['log']);
  
  const inDirCommands = mockGit.getExecutedInDirCommands();
  expect(inDirCommands).toHaveLength(1);
  expect(inDirCommands[0]).toEqual({ workDir: '/workdir', args: ['log'] });
});

test('MockGitService can simulate command failures', async () => {
  const mockGit = new MockGitService();
  
  const errorResult: GitCommandResult = { stdout: '', stderr: 'Unknown git command', exitCode: 1 };
  mockGit.setCommandResponse(['invalid-command'], errorResult);
  
  await expect(mockGit.executeCommand('/repo', ['invalid-command'])).rejects.toThrow('Unknown git command');
});

test('MockGitService can simulate git availability', async () => {
  const mockGit = new MockGitService();
  
  mockGit.setGitAvailable(false);
  expect(await mockGit.isAvailable()).toBe(false);
  
  mockGit.setGitAvailable(true);
  expect(await mockGit.isAvailable()).toBe(true);
});

test('MockGitService can simulate git version', async () => {
  const mockGit = new MockGitService();
  const expectedVersion = 'git version 2.34.1';
  
  mockGit.setGitVersion(expectedVersion);
  
  const version = await mockGit.getVersion();
  expect(version).toBe(expectedVersion);
});

test('MockGitService clears command history', async () => {
  const mockGit = new MockGitService();
  
  mockGit.setCommandResponse(['branch'], 'main');
  await mockGit.executeCommand('/repo', ['branch']);
  
  expect(mockGit.getExecutedCommands()).toHaveLength(1);
  
  mockGit.clear();
  
  expect(mockGit.getExecutedCommands()).toHaveLength(0);
  expect(mockGit.getExecutedInDirCommands()).toHaveLength(0);
});

test('MockGitService handles multiple responses for same command', async () => {
  const mockGit = new MockGitService();
  
  mockGit.setCommandResponse(['status'], 'clean');
  mockGit.setCommandResponse(['status'], 'modified files');
  
  const result1 = await mockGit.executeCommand('/repo', ['status']);
  const result2 = await mockGit.executeCommand('/repo', ['status']);
  
  // Should return the last configured response
  expect(result1).toBe('modified files');
  expect(result2).toBe('modified files');
});

test('MockGitService returns default response for unconfigured commands', async () => {
  const mockGit = new MockGitService();
  
  const result = await mockGit.executeCommand('/repo', ['unconfigured-command']);
  expect(result).toBe('');
});

test('MockGitService handles version command by default', async () => {
  const mockGit = new MockGitService();
  
  const result = await mockGit.executeCommand('/repo', ['--version']);
  expect(result).toBe('git version 2.34.1');
});

test('MockGitService throws when git unavailable and getting version', async () => {
  const mockGit = new MockGitService();
  
  mockGit.setGitAvailable(false);
  
  await expect(mockGit.getVersion()).rejects.toThrow('Git is not available');
});