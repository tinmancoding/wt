/**
 * Integration tests for repository initialization functionality
 */

import { test, expect, beforeEach, afterEach } from 'bun:test';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm, readFile, access, stat, writeFile } from 'fs/promises';
import { constants } from 'fs';

const execAsync = promisify(exec);

// Path to the development binary
const wtBinary = path.join(process.cwd(), 'src/index.ts');
const runWt = async (args: string, cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
  try {
    const options = cwd ? { cwd } : {};
    const { stdout, stderr } = await execAsync(`bun run ${wtBinary} ${args}`, options);
    return { stdout, stderr, exitCode: 0 };
  } catch (error: any) {
    return { 
      stdout: error.stdout || '', 
      stderr: error.stderr || '', 
      exitCode: error.code || 1 
    };
  }
};

/**
 * Creates a local bare git repository for testing
 * Returns the file:// URL to the repository
 */
const createTestBareRepository = async (name: string, basePath: string): Promise<string> => {
  const repoPath = path.join(basePath, `${name}.git`);
  
  // Initialize bare repository
  await execAsync(`git init --bare "${repoPath}"`);
  
  // Create a temporary working directory to add some content
  const workingDir = path.join(basePath, `${name}-working`);
  await execAsync(`git clone "${repoPath}" "${workingDir}"`);
  
  // Add some initial content
  const readmePath = path.join(workingDir, 'README.md');
  await writeFile(readmePath, `# ${name}\n\nTest repository for integration tests.\n`);
  
  // Configure git user for the working directory
  await execAsync('git config user.name "Test User"', { cwd: workingDir });
  await execAsync('git config user.email "test@example.com"', { cwd: workingDir });
  
  // Commit and push the content
  await execAsync('git add README.md', { cwd: workingDir });
  await execAsync('git commit -m "Initial commit"', { cwd: workingDir });
  await execAsync('git push origin main', { cwd: workingDir });
  
  // Clean up working directory
  await rm(workingDir, { recursive: true, force: true });
  
  return `file://${repoPath}`;
};

let tempDir: string;
let testRepoUrl: string;

beforeEach(async () => {
  // Create a temporary directory for each test
  tempDir = await mkdtemp(path.join(tmpdir(), 'wt-init-test-'));
  
  // Create a test repository for each test
  testRepoUrl = await createTestBareRepository('test-repo', tempDir);
});

afterEach(async () => {
  // Clean up temporary directory
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('integration: init command should show help', async () => {
  const { stdout, exitCode } = await runWt('init --help');
  
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Initialize a new repository with bare setup for worktrees');
  expect(stdout).toContain('git-url');
  expect(stdout).toContain('Git repository URL to clone');
});

test('integration: init command should fail with no arguments', async () => {
  const { stderr, exitCode } = await runWt('init');
  
  expect(exitCode).toBe(2); // INVALID_ARGUMENTS
  expect(stderr).toContain('Git repository URL is required');
});

test('integration: init command should fail with invalid URL', async () => {
  const { stderr, exitCode } = await runWt('init ""', tempDir);
  
  expect(exitCode).toBe(2); // INVALID_ARGUMENTS
  expect(stderr).toContain('Git repository URL is required');
});

test('integration: init command should fail with invalid target name', async () => {
  // Test with a name that contains invalid characters 
  const invalidName = 'test/invalid';
  const { stderr, exitCode } = await runWt(`init ${testRepoUrl} "${invalidName}"`, tempDir);
  
  expect(exitCode).toBe(2); // INVALID_ARGUMENTS
  expect(stderr).toContain('Error initializing repository');
});

// Test with a real public repository for actual cloning
test('integration: init command should initialize repository from local repo', async () => {
  // Use the local test repository
  const targetName = 'test-repo-clone';
  
  const { stdout, exitCode } = await runWt(`init ${testRepoUrl} ${targetName}`, tempDir);
  
  // Should succeed
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Cloning');
  expect(stdout).toContain('Repository initialized successfully');
  
  // Verify directory structure
  const targetPath = path.join(tempDir, targetName);
  const bareDir = path.join(targetPath, '.bare');
  const gitFile = path.join(targetPath, '.git');
  
  // Check that .bare directory exists and is a directory
  try {
    await access(bareDir, constants.F_OK);
    const bareStat = await stat(bareDir);
    expect(bareStat.isDirectory()).toBe(true);
  } catch {
    throw new Error(`Expected .bare directory to exist at ${bareDir}`);
  }
  
  // Check that .git file exists and points to .bare
  try {
    await access(gitFile, constants.F_OK);
    const gitFileContent = await readFile(gitFile, 'utf-8');
    expect(gitFileContent.trim()).toBe('gitdir: ./.bare');
  } catch {
    throw new Error(`Expected .git file to exist at ${gitFile}`);
  }
  
  // Check that bare repository has proper structure
  const configFile = path.join(bareDir, 'config');
  try {
    await access(configFile, constants.F_OK);
  } catch {
    throw new Error(`Expected config file to exist at ${configFile}`);
  }
  
  const refsDir = path.join(bareDir, 'refs');
  await access(refsDir, constants.F_OK);
});

test('integration: init command should use repository name from URL', async () => {
  const { stdout, exitCode } = await runWt(`init ${testRepoUrl}`, tempDir);
  
  expect(exitCode).toBe(0);
  expect(stdout).toContain('test-repo');
  
  // Verify directory was created with correct name
  const targetPath = path.join(tempDir, 'test-repo');
  try {
    await access(targetPath, constants.F_OK);
  } catch {
    throw new Error(`Expected directory to exist at ${targetPath}`);
  }
});

test('integration: init command should handle network errors gracefully', async () => {
  const invalidRepo = 'file:///nonexistent/repo/path.git';
  
  const { stderr, exitCode } = await runWt(`init ${invalidRepo}`, tempDir);
  
  expect(exitCode).toBe(1); // GENERAL_ERROR since it's a local file that doesn't exist
  expect(stderr).toContain('Error initializing repository');
});

test('integration: init command should handle invalid repository URLs', async () => {
  const invalidUrl = 'not-a-valid-url';
  
  const { stderr, exitCode } = await runWt(`init ${invalidUrl}`, tempDir);
  
  expect(exitCode).toBe(1); // GENERAL_ERROR (git clone fails)
  expect(stderr).toContain('Error initializing repository');
});

test('integration: init command should handle SSH URLs', async () => {
  // Create a fake SSH URL that will fail
  const sshRepo = 'git@nonexistent.example.com:user/repo.git';
  
  const { stderr, exitCode } = await runWt(`init ${sshRepo}`, tempDir);
  
  // Should fail due to invalid hostname
  expect(exitCode).not.toBe(0);
  expect(stderr).toContain('Error initializing repository');
});

// Test repository structure validation
test('integration: initialized repository should be detected correctly', async () => {
  const targetName = 'detection-test';
  
  // Initialize repository
  const { exitCode: initExitCode } = await runWt(`init ${testRepoUrl} ${targetName}`, tempDir);
  expect(initExitCode).toBe(0);
  
  // Try to run a command in the initialized repository to verify detection
  const targetPath = path.join(tempDir, targetName);
  const { stdout, exitCode } = await runWt('list', targetPath);
  
  expect(exitCode).toBe(0);
  // The bare repository itself appears as a worktree, so we expect to see it listed
  expect(stdout).toContain('.bare');
});

test('integration: init command should handle existing directory name conflicts', async () => {
  const targetName = 'conflict-test';
  
  // Initialize first repository
  const { exitCode: firstExitCode } = await runWt(`init ${testRepoUrl} ${targetName}`, tempDir);
  expect(firstExitCode).toBe(0);
  
  // Try to initialize again with same name - should handle gracefully
  const { stderr, exitCode } = await runWt(`init ${testRepoUrl} ${targetName}`, tempDir);
  
  // May succeed (git clone handles existing directories) or fail gracefully
  if (exitCode !== 0) {
    expect(stderr).toContain('Error initializing repository');
  }
});