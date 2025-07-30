import { test, expect } from 'bun:test';
import { resolve, join } from 'path';
import { validateAndParseGitUrl, RepositoryInitError, NetworkError, InitOperations } from '../../src/init.ts';
import { EXIT_CODES } from '../../src/cli/types.ts';
import { MockLoggerService, MockGitService, MockFileSystemService, MockCommandService } from '../../src/services/test-implementations/index.ts';
import { createServiceContainer } from '../../src/services/container.ts';

// Test validateAndParseGitUrl function
test('validateAndParseGitUrl - HTTP URL', () => {
  const result = validateAndParseGitUrl('https://github.com/user/repo.git');
  
  expect(result.url).toBe('https://github.com/user/repo.git');
  expect(result.name).toBe('repo');
});

test('validateAndParseGitUrl - HTTP URL without .git', () => {
  const result = validateAndParseGitUrl('https://github.com/user/myproject');
  
  expect(result.url).toBe('https://github.com/user/myproject');
  expect(result.name).toBe('myproject');
});

test('validateAndParseGitUrl - SSH URL', () => {
  const result = validateAndParseGitUrl('git@github.com:user/repo.git');
  
  expect(result.url).toBe('git@github.com:user/repo.git');
  expect(result.name).toBe('repo');
});

test('validateAndParseGitUrl - SSH URL without .git', () => {
  const result = validateAndParseGitUrl('git@github.com:user/myproject');
  
  expect(result.url).toBe('git@github.com:user/myproject');
  expect(result.name).toBe('myproject');
});

test('validateAndParseGitUrl - local file path', () => {
  const result = validateAndParseGitUrl('/path/to/repo.git');
  
  expect(result.url).toBe('/path/to/repo.git');
  expect(result.name).toBe('repo');
});

test('validateAndParseGitUrl - relative path', () => {
  const result = validateAndParseGitUrl('./myproject');
  
  expect(result.url).toBe('./myproject');
  expect(result.name).toBe('myproject');
});

test('validateAndParseGitUrl - empty string', () => {
  expect(() => validateAndParseGitUrl('')).toThrow(RepositoryInitError);
  expect(() => validateAndParseGitUrl('')).toThrow('Repository URL is required');
});

test('validateAndParseGitUrl - null/undefined', () => {
  expect(() => validateAndParseGitUrl(null as any)).toThrow(RepositoryInitError);
  expect(() => validateAndParseGitUrl(undefined as any)).toThrow(RepositoryInitError);
});

test('validateAndParseGitUrl - whitespace only', () => {
  expect(() => validateAndParseGitUrl('   ')).toThrow(RepositoryInitError);
  expect(() => validateAndParseGitUrl('   ')).toThrow('Repository URL cannot be empty');
});

test('validateAndParseGitUrl - complex GitHub URL', () => {
  const result = validateAndParseGitUrl('https://github.com/org/very-long-project-name.git');
  
  expect(result.url).toBe('https://github.com/org/very-long-project-name.git');
  expect(result.name).toBe('very-long-project-name');
});

test('validateAndParseGitUrl - invalid HTTP URL', () => {
  expect(() => validateAndParseGitUrl('https://github.com/')).toThrow(RepositoryInitError);
  expect(() => validateAndParseGitUrl('https://github.com/')).toThrow('Invalid repository path in URL');
});

test('validateAndParseGitUrl - invalid SSH format', () => {
  expect(() => validateAndParseGitUrl('git@github.com')).toThrow(RepositoryInitError);
  expect(() => validateAndParseGitUrl('git@github.com')).toThrow('Invalid repository name extracted from URL');
});

test('validateAndParseGitUrl - SSH URL without path', () => {
  expect(() => validateAndParseGitUrl('git@github.com:')).toThrow(RepositoryInitError);
  expect(() => validateAndParseGitUrl('git@github.com:')).toThrow('Invalid SSH URL format');
});

// Test RepositoryInitError class
test('RepositoryInitError - default code', () => {
  const error = new RepositoryInitError('Test message');
  
  expect(error.name).toBe('RepositoryInitError');
  expect(error.message).toBe('Test message');
  expect(error.code).toBe(EXIT_CODES.GENERAL_ERROR);
  expect(error).toBeInstanceOf(Error);
});

test('RepositoryInitError - custom code', () => {
  const error = new RepositoryInitError('Test message', EXIT_CODES.INVALID_ARGUMENTS);
  
  expect(error.code).toBe(EXIT_CODES.INVALID_ARGUMENTS);
});

// Test NetworkError class
test('NetworkError - inherits from RepositoryInitError', () => {
  const error = new NetworkError('Network test message');
  
  expect(error.name).toBe('NetworkError');
  expect(error.message).toBe('Network test message');
  expect(error.code).toBe(EXIT_CODES.NETWORK_ERROR);
  expect(error).toBeInstanceOf(RepositoryInitError);
  expect(error).toBeInstanceOf(Error);
});

// Test InitOperations class with service injection
test('InitOperations - default branch detection from HEAD file', async () => {
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
  
  const initOps = new InitOperations(services);
  
  // Resolve expected paths based on current working directory
  const expectedTargetDir = resolve(process.cwd(), 'repo');
  const expectedBareDir = join(expectedTargetDir, '.bare');
  
  // Mock file system responses
  mockFs.setFileContent(`${expectedBareDir}/HEAD`, 'ref: refs/heads/main\n');
  mockFs.setDirectory(expectedTargetDir);
  mockFs.setDirectory(expectedBareDir);
  
  // Mock git responses
  mockGit.setCommandResponse(['clone', '--bare', 'https://github.com/user/repo.git', expectedBareDir], '');
  mockGit.setCommandResponse(['config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*'], '');
  mockGit.setCommandResponse(['fetch', 'origin'], '');
  mockGit.setCommandResponse(['show-ref', '--verify', '--quiet', 'refs/remotes/origin/main'], { stdout: '', stderr: '', exitCode: 0 });
  mockGit.setCommandResponse(['for-each-ref', '--format=%(refname)', 'refs/remotes'], { stdout: 'refs/remotes/origin/main\n', stderr: '', exitCode: 0 });
  mockGit.setCommandResponse(['worktree', 'add', '-b', 'main', `${expectedTargetDir}/main`, 'origin/main'], '');
  mockGit.setCommandResponse(['branch', '--set-upstream-to', 'origin/main'], '');
  
  // Test initialization
  const result = await initOps.initializeRepository('https://github.com/user/repo.git', 'repo');
  
  expect(result.rootDir).toBe(expectedTargetDir);
  expect(result.gitDir).toBe(expectedBareDir);
  expect(result.type).toBe('bare');
  
  // Debug: check all logs
  console.log('All logs:', mockLogger.getLogsByLevel('log'));
  console.log('All warns:', mockLogger.getLogsByLevel('warn'));
  
  // Verify default branch detection and worktree creation occurred
  expect(mockLogger.hasLog('log', 'Detected default branch: main')).toBe(true);
  expect(mockLogger.hasLog('log', 'Created worktree for default branch \'main\' with upstream tracking')).toBe(true);
});

test('InitOperations - default branch detection fallback to symbolic-ref', async () => {
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
  
  const initOps = new InitOperations(services);
  
  const expectedTargetDir = resolve(process.cwd(), 'repo');
  const expectedBareDir = join(expectedTargetDir, '.bare');
  
  // Mock file system responses - HEAD file doesn't contain expected format
  mockFs.setFileContent(`${expectedBareDir}/HEAD`, 'invalid content\n');
  mockFs.setDirectory(expectedTargetDir);
  mockFs.setDirectory(expectedBareDir);
  
  // Mock git responses for fallback detection
  mockGit.setCommandResponse(['clone', '--bare', 'https://github.com/user/repo.git', expectedBareDir], '');
  mockGit.setCommandResponse(['config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*'], '');
  mockGit.setCommandResponse(['fetch', 'origin'], '');
  mockGit.setCommandResponse(['symbolic-ref', 'refs/remotes/origin/HEAD'], { 
    exitCode: 0, 
    stdout: 'refs/remotes/origin/develop\n',
    stderr: ''
  });
  mockGit.setCommandResponse(['show-ref', '--verify', '--quiet', 'refs/remotes/origin/develop'], { stdout: '', stderr: '', exitCode: 0 });
  mockGit.setCommandResponse(['for-each-ref', '--format=%(refname)', 'refs/remotes'], { stdout: 'refs/remotes/origin/develop\n', stderr: '', exitCode: 0 });
  mockGit.setCommandResponse(['worktree', 'add', '-b', 'develop', `${expectedTargetDir}/develop`, 'origin/develop'], '');
  mockGit.setCommandResponse(['branch', '--set-upstream-to', 'origin/develop'], '');
  
  const result = await initOps.initializeRepository('https://github.com/user/repo.git', 'repo');
  
  expect(result.rootDir).toBe(expectedTargetDir);
  expect(mockLogger.hasLog('log', 'Detected default branch: develop')).toBe(true);
});

test('InitOperations - default branch detection fallback to common defaults', async () => {
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
  
  const initOps = new InitOperations(services);
  
  const expectedTargetDir = resolve(process.cwd(), 'repo');
  const expectedBareDir = join(expectedTargetDir, '.bare');
  
  // Mock file system responses - HEAD file reading fails but directories exist
  mockFs.setDirectory(expectedTargetDir);
  mockFs.setDirectory(expectedBareDir);
  
  // Mock git responses
  mockGit.setCommandResponse(['clone', '--bare', 'https://github.com/user/repo.git', expectedBareDir], '');
  mockGit.setCommandResponse(['config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*'], '');
  mockGit.setCommandResponse(['fetch', 'origin'], '');
  mockGit.setCommandResponse(['symbolic-ref', 'refs/remotes/origin/HEAD'], { stdout: '', stderr: '', exitCode: 1 });
  
  // Mock fallback attempts - first 'main' fails, then 'master' succeeds
  mockGit.setCommandResponse(['show-ref', '--verify', '--quiet', 'refs/remotes/origin/main'], { stdout: '', stderr: '', exitCode: 1 });
  mockGit.setCommandResponse(['show-ref', '--verify', '--quiet', 'refs/remotes/origin/master'], { stdout: '', stderr: '', exitCode: 0 });
  mockGit.setCommandResponse(['for-each-ref', '--format=%(refname)', 'refs/remotes'], { stdout: 'refs/remotes/origin/master\n', stderr: '', exitCode: 0 });
  mockGit.setCommandResponse(['worktree', 'add', '-b', 'master', `${expectedTargetDir}/master`, 'origin/master'], '');
  mockGit.setCommandResponse(['branch', '--set-upstream-to', 'origin/master'], '');
  
  const result = await initOps.initializeRepository('https://github.com/user/repo.git', 'repo');
  
  expect(result.rootDir).toBe(expectedTargetDir);
  expect(mockLogger.hasLog('warn', 'Could not detect default branch from HEAD file, using found branch: master')).toBe(true);
  expect(mockLogger.hasLog('log', 'Detected default branch: master')).toBe(true);
});

test('InitOperations - default branch detection failure with graceful fallback', async () => {
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
  
  const initOps = new InitOperations(services);
  
  const expectedTargetDir = resolve(process.cwd(), 'repo');
  const expectedBareDir = join(expectedTargetDir, '.bare');
  
  // Mock file system responses
  mockFs.setDirectory(expectedTargetDir);
  mockFs.setDirectory(expectedBareDir);
  
  // Mock git responses - all detection methods fail
  mockGit.setCommandResponse(['clone', '--bare', 'https://github.com/user/repo.git', expectedBareDir], '');
  mockGit.setCommandResponse(['config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*'], '');
  mockGit.setCommandResponse(['fetch', 'origin'], '');
  mockGit.setCommandResponse(['symbolic-ref', 'refs/remotes/origin/HEAD'], { stdout: '', stderr: '', exitCode: 1 });
  
  // All common default branches fail
  mockGit.setCommandResponse(['show-ref', '--verify', '--quiet', 'refs/remotes/origin/main'], { stdout: '', stderr: '', exitCode: 1 });
  mockGit.setCommandResponse(['show-ref', '--verify', '--quiet', 'refs/remotes/origin/master'], { stdout: '', stderr: '', exitCode: 1 });
  mockGit.setCommandResponse(['show-ref', '--verify', '--quiet', 'refs/remotes/origin/develop'], { stdout: '', stderr: '', exitCode: 1 });
  mockGit.setCommandResponse(['show-ref', '--verify', '--quiet', 'refs/remotes/origin/development'], { stdout: '', stderr: '', exitCode: 1 });
  
  const result = await initOps.initializeRepository('https://github.com/user/repo.git', 'repo');
  
  // Should still succeed overall but show warning about worktree creation failure
  expect(result.rootDir).toBe(expectedTargetDir);
  expect(mockLogger.hasLogContaining('warn', 'Warning: Failed to create default branch worktree:')).toBe(true);
});

test('InitOperations - upstream tracking setup failure should warn but continue', async () => {
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
  
  const initOps = new InitOperations(services);
  
  const expectedTargetDir = resolve(process.cwd(), 'repo');
  const expectedBareDir = join(expectedTargetDir, '.bare');
  
  // Mock file system responses
  mockFs.setFileContent(`${expectedBareDir}/HEAD`, 'ref: refs/heads/main\n');
  mockFs.setDirectory(expectedTargetDir);
  mockFs.setDirectory(expectedBareDir);
  
  // Mock git responses - worktree creation succeeds but upstream setup fails
  mockGit.setCommandResponse(['clone', '--bare', 'https://github.com/user/repo.git', expectedBareDir], '');
  mockGit.setCommandResponse(['config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*'], '');
  mockGit.setCommandResponse(['fetch', 'origin'], '');
  mockGit.setCommandResponse(['show-ref', '--verify', '--quiet', 'refs/remotes/origin/main'], { stdout: '', stderr: '', exitCode: 0 });
  mockGit.setCommandResponse(['for-each-ref', '--format=%(refname)', 'refs/remotes'], { stdout: 'refs/remotes/origin/main\n', stderr: '', exitCode: 0 });
  mockGit.setCommandResponse(['worktree', 'add', '-b', 'main', `${expectedTargetDir}/main`, 'origin/main'], '');
  mockGit.setCommandResponse(['branch', '--set-upstream-to', 'origin/main'], { 
    exitCode: 1, 
    stderr: 'upstream setup failed',
    stdout: ''
  });
  
  const result = await initOps.initializeRepository('https://github.com/user/repo.git', 'repo');
  
  expect(result.rootDir).toBe(expectedTargetDir);
  expect(mockLogger.hasLog('log', 'Detected default branch: main')).toBe(true);
  expect(mockLogger.hasLogContaining('warn', 'Warning: Failed to set upstream tracking for branch \'main\':')).toBe(true);
});