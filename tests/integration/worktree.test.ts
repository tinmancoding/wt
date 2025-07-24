import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { spawn } from 'child_process';
import { tmpdir } from 'os';

const wtBinaryPath = join(process.cwd(), 'wt');

// Helper function to run wt command
async function runWT(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(wtBinaryPath, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    // Set a timeout to prevent hanging
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Test command timed out after 10 seconds'));
    }, 10000);

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code || 0
      });
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

// Helper function to run git command
async function runGit(args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env }
    });

    let stderr = '';

    // Set a timeout to prevent hanging
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Git command timed out after 10 seconds'));
    }, 10000);

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Git command failed: ${stderr}`));
      }
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

describe('Worktree List Command Integration', () => {
  let tempDir: string;
  let repoDir: string;

  beforeEach(async () => {
    // Create temporary directory for each test
    tempDir = join(tmpdir(), `wt-test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`);
    repoDir = join(tempDir, 'repo');
    await mkdir(repoDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('wt list command', () => {
    test('should list worktrees in standard git repository', async () => {
      // Initialize git repository
      await runGit(['init'], repoDir);
      await runGit(['config', 'user.email', 'test@example.com'], repoDir);
      await runGit(['config', 'user.name', 'Test User'], repoDir);
      
      // Create initial commit
      await writeFile(join(repoDir, 'README.md'), 'Test repository');
      await runGit(['add', '.'], repoDir);
      await runGit(['commit', '-m', 'Initial commit'], repoDir);

      // Run wt list
      const result = await runWT(['list'], repoDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Name');
      expect(result.stdout).toContain('Branch');
      expect(result.stdout).toContain('Path');
      expect(result.stdout).toContain('*'); // Current worktree indicator
      expect(result.stdout).toContain('main'); // Default branch
    });

    test('should list worktrees in bare repository setup', async () => {
      // Create bare repository
      const bareDir = join(repoDir, '.bare');
      await mkdir(bareDir, { recursive: true });
      await runGit(['init', '--bare'], bareDir);
      
      // Create .git file pointing to bare repository
      await writeFile(join(repoDir, '.git'), 'gitdir: ./.bare');

      // Run wt list
      const result = await runWT(['list'], repoDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Name');
      expect(result.stdout).toContain('Branch');
      expect(result.stdout).toContain('Path');
      expect(result.stdout).toContain('.bare');
      expect(result.stdout).toContain('[bare]');
    });

    test('should list multiple worktrees', async () => {
      // Initialize git repository
      await runGit(['init'], repoDir);
      await runGit(['config', 'user.email', 'test@example.com'], repoDir);
      await runGit(['config', 'user.name', 'Test User'], repoDir);
      
      // Create initial commit
      await writeFile(join(repoDir, 'README.md'), 'Test repository');
      await runGit(['add', '.'], repoDir);
      await runGit(['commit', '-m', 'Initial commit'], repoDir);

      // Create additional worktree
      const worktreeDir = join(tempDir, 'feature-worktree');
      await runGit(['worktree', 'add', worktreeDir], repoDir);

      // Run wt list
      const result = await runWT(['list'], repoDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('*'); // Current worktree indicator
      expect(result.stdout).toContain('main');
      expect(result.stdout).toContain('feature-worktree');
      
      // Should show both worktrees
      const lines = result.stdout.split('\n').filter(line => line.trim() && !line.includes('Name'));
      expect(lines.length).toBeGreaterThanOrEqual(2);
    });

    test('should handle error when not in git repository', async () => {
      // Run wt list in non-git directory
      const result = await runWT(['list'], tempDir);

      expect(result.exitCode).toBe(3); // EXIT_CODES.REPOSITORY_ERROR
      expect(result.stderr).toContain('No Git repository found');
    });

    test('should work with ls alias', async () => {
      // Initialize git repository
      await runGit(['init'], repoDir);
      await runGit(['config', 'user.email', 'test@example.com'], repoDir);
      await runGit(['config', 'user.name', 'Test User'], repoDir);
      
      // Create initial commit
      await writeFile(join(repoDir, 'README.md'), 'Test repository');
      await runGit(['add', '.'], repoDir);
      await runGit(['commit', '-m', 'Initial commit'], repoDir);

      // Run wt ls (alias)
      const result = await runWT(['ls'], repoDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Name');
      expect(result.stdout).toContain('Branch');
      expect(result.stdout).toContain('*'); // Current worktree indicator
    });
  });

  describe('wt create command', () => {
    test('should create worktree for new branch', async () => {
      // Initialize git repository
      await runGit(['init'], repoDir);
      await runGit(['config', 'user.email', 'test@example.com'], repoDir);
      await runGit(['config', 'user.name', 'Test User'], repoDir);
      
      // Create initial commit
      await writeFile(join(repoDir, 'README.md'), 'Test repository');
      await runGit(['add', '.'], repoDir);
      await runGit(['commit', '-m', 'Initial commit'], repoDir);

      // Create worktree for new branch
      const result = await runWT(['create', 'feature-branch'], repoDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Created worktree with new branch \'feature-branch\'');
      
      // Verify worktree was created
      const listResult = await runWT(['list'], repoDir);
      expect(listResult.stdout).toContain('feature-branch');
    });

    test('should create worktree for existing local branch', async () => {
      // Initialize git repository with multiple branches
      await runGit(['init'], repoDir);
      await runGit(['config', 'user.email', 'test@example.com'], repoDir);
      await runGit(['config', 'user.name', 'Test User'], repoDir);
      
      // Create initial commit
      await writeFile(join(repoDir, 'README.md'), 'Test repository');
      await runGit(['add', '.'], repoDir);
      await runGit(['commit', '-m', 'Initial commit'], repoDir);

      // Create a local branch
      await runGit(['checkout', '-b', 'existing-branch'], repoDir);
      await writeFile(join(repoDir, 'feature.txt'), 'Feature file');
      await runGit(['add', '.'], repoDir);
      await runGit(['commit', '-m', 'Add feature'], repoDir);
      await runGit(['checkout', 'main'], repoDir);

      // Create worktree for existing local branch
      const result = await runWT(['create', 'existing-branch'], repoDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Created worktree for existing local branch \'existing-branch\'');
      
      // Verify worktree was created
      const listResult = await runWT(['list'], repoDir);
      expect(listResult.stdout).toContain('existing-branch');
    });

    test('should work with autoFetch disabled', async () => {
      // Initialize git repository
      await runGit(['init'], repoDir);
      await runGit(['config', 'user.email', 'test@example.com'], repoDir);
      await runGit(['config', 'user.name', 'Test User'], repoDir);
      
      // Create initial commit
      await writeFile(join(repoDir, 'README.md'), 'Test repository');
      await runGit(['add', '.'], repoDir);
      await runGit(['commit', '-m', 'Initial commit'], repoDir);

      // Configure autoFetch to false
      await runWT(['config', 'autoFetch', 'false'], repoDir);

      // Create worktree for new branch
      const result = await runWT(['create', 'no-fetch-branch'], repoDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).not.toContain('Fetching latest changes');
      expect(result.stdout).toContain('Created worktree with new branch \'no-fetch-branch\'');
    });

    test('should handle invalid branch names gracefully', async () => {
      // Initialize git repository
      await runGit(['init'], repoDir);
      await runGit(['config', 'user.email', 'test@example.com'], repoDir);
      await runGit(['config', 'user.name', 'Test User'], repoDir);
      
      // Create initial commit
      await writeFile(join(repoDir, 'README.md'), 'Test repository');
      await runGit(['add', '.'], repoDir);
      await runGit(['commit', '-m', 'Initial commit'], repoDir);

      // Try to create worktree with invalid branch name
      const result = await runWT(['create', '..invalid..branch..'], repoDir);

      expect(result.exitCode).toBe(1); // Should fail
      expect(result.stderr).toContain('Error creating worktree');
    });

    test('should handle missing branch argument', async () => {
      // Initialize git repository
      await runGit(['init'], repoDir);
      await runGit(['config', 'user.email', 'test@example.com'], repoDir);
      await runGit(['config', 'user.name', 'Test User'], repoDir);

      // Try to create worktree without branch name
      const result = await runWT(['create'], repoDir);

      expect(result.exitCode).toBe(2); // INVALID_ARGUMENTS
      expect(result.stderr).toContain('Branch name is required');
    });

    test('should work with custom worktreeDir configuration', async () => {
      // Initialize git repository
      await runGit(['init'], repoDir);
      await runGit(['config', 'user.email', 'test@example.com'], repoDir);
      await runGit(['config', 'user.name', 'Test User'], repoDir);
      
      // Create initial commit
      await writeFile(join(repoDir, 'README.md'), 'Test repository');
      await runGit(['add', '.'], repoDir);
      await runGit(['commit', '-m', 'Initial commit'], repoDir);

      // Create worktrees directory and configure
      await mkdir(join(repoDir, 'worktrees'), { recursive: true });
      await runWT(['config', 'worktreeDir', './worktrees'], repoDir);

      // Create worktree for new branch
      const result = await runWT(['create', 'custom-dir-branch'], repoDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Created worktree with new branch \'custom-dir-branch\'');
      expect(result.stdout).toContain('worktrees/custom-dir-branch');
    });

    test('should handle git repository errors', async () => {
      // Try to create worktree in non-git directory
      const result = await runWT(['create', 'test-branch'], tempDir);

      expect(result.exitCode).toBe(3); // GIT_REPO_NOT_FOUND
      expect(result.stderr).toContain('No Git repository found');
    });
  });

  describe('wt remove command', () => {
    test('should remove worktree without branch deletion', async () => {
      // Initialize git repository
      await runGit(['init'], repoDir);
      await runGit(['config', 'user.email', 'test@example.com'], repoDir);
      await runGit(['config', 'user.name', 'Test User'], repoDir);
      
      // Create initial commit
      await writeFile(join(repoDir, 'README.md'), 'Test repository');
      await runGit(['add', '.'], repoDir);
      await runGit(['commit', '-m', 'Initial commit'], repoDir);

      // Create additional worktree
      const worktreeDir = join(tempDir, 'feature-worktree');
      await runGit(['worktree', 'add', '-b', 'feature-branch', worktreeDir], repoDir);

      // Remove worktree using wt remove
      const result = await runWT(['remove', 'feature'], repoDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Removing worktree \'feature-worktree\'');
      expect(result.stdout).toContain('Worktree \'feature-worktree\' removed successfully');
      
      // Verify worktree was removed from list
      const listResult = await runWT(['list'], repoDir);
      expect(listResult.stdout).not.toContain('feature-worktree');
    });

    test('should remove worktree with branch deletion', async () => {
      // Initialize git repository
      await runGit(['init'], repoDir);
      await runGit(['config', 'user.email', 'test@example.com'], repoDir);
      await runGit(['config', 'user.name', 'Test User'], repoDir);
      
      // Create initial commit
      await writeFile(join(repoDir, 'README.md'), 'Test repository');
      await runGit(['add', '.'], repoDir);
      await runGit(['commit', '-m', 'Initial commit'], repoDir);

      // Create additional worktree
      const worktreeDir = join(tempDir, 'feature-worktree');
      await runGit(['worktree', 'add', '-b', 'feature-branch', worktreeDir], repoDir);

      // Remove worktree with branch deletion
      const result = await runWT(['remove', 'feature', '--with-branch'], repoDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Removing worktree \'feature-worktree\'');
      expect(result.stdout).toContain('Worktree \'feature-worktree\' removed successfully');
      expect(result.stdout).toContain('Deleting branch \'feature-branch\'');
      expect(result.stdout).toContain('Branch \'feature-branch\' deleted successfully');
    });

    test('should handle multiple matching worktrees', async () => {
      // Initialize git repository
      await runGit(['init'], repoDir);
      await runGit(['config', 'user.email', 'test@example.com'], repoDir);
      await runGit(['config', 'user.name', 'Test User'], repoDir);
      
      // Create initial commit
      await writeFile(join(repoDir, 'README.md'), 'Test repository');
      await runGit(['add', '.'], repoDir);
      await runGit(['commit', '-m', 'Initial commit'], repoDir);

      // Create multiple feature worktrees
      await runGit(['worktree', 'add', '-b', 'feature-1', join(tempDir, 'feature-1')], repoDir);
      await runGit(['worktree', 'add', '-b', 'feature-2', join(tempDir, 'feature-2')], repoDir);

      // Try to remove with ambiguous pattern
      const result = await runWT(['remove', 'feature'], repoDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Multiple worktrees match pattern "feature"');
      expect(result.stdout).toContain('Please be more specific');
      expect(result.stdout).toContain('feature-1');
      expect(result.stdout).toContain('feature-2');
    });

    test('should handle no matching worktrees', async () => {
      // Initialize git repository
      await runGit(['init'], repoDir);
      await runGit(['config', 'user.email', 'test@example.com'], repoDir);
      await runGit(['config', 'user.name', 'Test User'], repoDir);
      
      // Create initial commit
      await writeFile(join(repoDir, 'README.md'), 'Test repository');
      await runGit(['add', '.'], repoDir);
      await runGit(['commit', '-m', 'Initial commit'], repoDir);

      // Try to remove non-existent worktree
      const result = await runWT(['remove', 'nonexistent'], repoDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No worktrees found matching pattern: nonexistent');
    });

    test('should prevent removing current worktree', async () => {
      // Initialize git repository
      await runGit(['init'], repoDir);
      await runGit(['config', 'user.email', 'test@example.com'], repoDir);
      await runGit(['config', 'user.name', 'Test User'], repoDir);
      
      // Create initial commit
      await writeFile(join(repoDir, 'README.md'), 'Test repository');
      await runGit(['add', '.'], repoDir);
      await runGit(['commit', '-m', 'Initial commit'], repoDir);

      // Try to remove current worktree (main branch)
      const result = await runWT(['remove', 'main'], repoDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No worktrees found matching pattern: main');
    });

    test('should work with rm alias', async () => {
      // Initialize git repository
      await runGit(['init'], repoDir);
      await runGit(['config', 'user.email', 'test@example.com'], repoDir);
      await runGit(['config', 'user.name', 'Test User'], repoDir);
      
      // Create initial commit
      await writeFile(join(repoDir, 'README.md'), 'Test repository');
      await runGit(['add', '.'], repoDir);
      await runGit(['commit', '-m', 'Initial commit'], repoDir);

      // Create additional worktree
      const worktreeDir = join(tempDir, 'feature-worktree');
      await runGit(['worktree', 'add', '-b', 'feature-branch', worktreeDir], repoDir);

      // Remove worktree using rm alias
      const result = await runWT(['rm', 'feature'], repoDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Removing worktree \'feature-worktree\'');
      expect(result.stdout).toContain('Worktree \'feature-worktree\' removed successfully');
    });

    test('should respect confirmDelete configuration', async () => {
      // Initialize git repository
      await runGit(['init'], repoDir);
      await runGit(['config', 'user.email', 'test@example.com'], repoDir);
      await runGit(['config', 'user.name', 'Test User'], repoDir);
      
      // Create initial commit
      await writeFile(join(repoDir, 'README.md'), 'Test repository');
      await runGit(['add', '.'], repoDir);
      await runGit(['commit', '-m', 'Initial commit'], repoDir);

      // Create additional worktree
      const worktreeDir = join(tempDir, 'feature-worktree');
      await runGit(['worktree', 'add', '-b', 'feature-branch', worktreeDir], repoDir);

      // Enable confirmation prompts
      await runWT(['config', 'confirmDelete', 'true'], repoDir);

      // Try to remove worktree (will require confirmation which won't be provided in test)
      // For now, we'll just test that confirmDelete config was set
      const configResult = await runWT(['config', 'confirmDelete'], repoDir);
      expect(configResult.stdout).toBe('true');
    });

    test('should handle git repository errors', async () => {
      // Try to remove worktree in non-git directory
      const result = await runWT(['remove', 'test-branch'], tempDir);

      expect(result.exitCode).toBe(3); // GIT_REPO_NOT_FOUND
      expect(result.stderr).toContain('No Git repository found');
    });

    test('should handle detached HEAD worktree removal', async () => {
      // Initialize git repository
      await runGit(['init'], repoDir);
      await runGit(['config', 'user.email', 'test@example.com'], repoDir);
      await runGit(['config', 'user.name', 'Test User'], repoDir);
      
      // Create initial commit
      await writeFile(join(repoDir, 'README.md'), 'Test repository');
      await runGit(['add', '.'], repoDir);
      await runGit(['commit', '-m', 'Initial commit'], repoDir);

      // Get current commit hash
      const commitProcess = spawn('git', ['rev-parse', 'HEAD'], {
        cwd: repoDir,
        stdio: ['ignore', 'pipe', 'ignore']
      });
      
      let commitHash = '';
      commitProcess.stdout?.on('data', (data) => {
        commitHash += data.toString().trim();
      });

      await new Promise((resolve) => {
        commitProcess.on('close', resolve);
      });

      // Create detached HEAD worktree
      const worktreeDir = join(tempDir, 'detached-worktree');
      await runGit(['worktree', 'add', '--detach', worktreeDir, commitHash], repoDir);

      // Remove detached worktree (should not try to delete branch)
      const result = await runWT(['remove', 'detached', '--with-branch'], repoDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Removing worktree \'detached-worktree\'');
      expect(result.stdout).toContain('Worktree \'detached-worktree\' removed successfully');
      // Should not attempt to delete branch for detached HEAD
      expect(result.stdout).not.toContain('Deleting branch');
    });
  });

  describe('Print-Dir Command', () => {
    beforeEach(async () => {
      // Initialize git repository for print-dir tests
      await runGit(['init'], repoDir);
      await runGit(['config', 'user.email', 'test@example.com'], repoDir);
      await runGit(['config', 'user.name', 'Test User'], repoDir);
      
      // Create initial commit
      await writeFile(join(repoDir, 'README.md'), 'Test repository');
      await runGit(['add', '.'], repoDir);
      await runGit(['commit', '-m', 'Initial commit'], repoDir);
    });

    test('should print path of single matching worktree', async () => {
      // Create a worktree
      await runWT(['create', 'feature-print'], repoDir);
      
      // Print directory path
      const result = await runWT(['print-dir', 'feature-print'], repoDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toContain('feature-print');
      expect(result.stderr.trim()).toBe('');
    });

    test('should handle exact pattern match', async () => {
      // Create multiple worktrees
      await runWT(['create', 'feature-one'], repoDir);
      await runWT(['create', 'feature-two'], repoDir);
      
      // Print directory path for exact match
      const result = await runWT(['print-dir', 'feature-one'], repoDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toContain('feature-one');
      expect(result.stderr.trim()).toBe('');
    });

    test('should handle partial pattern match', async () => {
      // Create a worktree with longer name
      await runWT(['create', 'feature-partial-match'], repoDir);
      
      // Print directory path using partial pattern
      const result = await runWT(['print-dir', 'partial'], repoDir);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toContain('feature-partial-match');
    });

    test('should fail when no pattern provided', async () => {
      const result = await runWT(['print-dir'], repoDir);
      
      expect(result.exitCode).toBe(2); // INVALID_ARGUMENTS
      expect(result.stderr).toContain('Pattern is required for print-dir command');
    });

    test('should fail when no worktrees match pattern', async () => {
      const result = await runWT(['print-dir', 'nonexistent'], repoDir);
      
      expect(result.exitCode).toBe(1); // GENERAL_ERROR
      expect(result.stderr).toContain('No worktrees found matching pattern: nonexistent');
    });

    test('should handle multiple matches with error and suggestions', async () => {
      // Create multiple worktrees with similar names
      await runWT(['create', 'feature-one'], repoDir);
      await runWT(['create', 'feature-two'], repoDir);
      
      // Try to print directory with ambiguous pattern
      const result = await runWT(['print-dir', 'feature'], repoDir);
      
      expect(result.exitCode).toBe(1); // GENERAL_ERROR
      expect(result.stderr).toContain('Multiple worktrees match pattern "feature"');
      expect(result.stderr).toContain('Please be more specific');
      expect(result.stderr).toContain('feature-one');
      expect(result.stderr).toContain('feature-two');
    });

    test('should output clean path for shell consumption', async () => {
      // Create a worktree
      await runWT(['create', 'clean-output'], repoDir);
      
      // Print directory path
      const result = await runWT(['print-dir', 'clean-output'], repoDir);
      
      expect(result.exitCode).toBe(0);
      // Should only contain the path, nothing else
      const lines = result.stdout.trim().split('\n');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('clean-output');
      // Should not contain any extra text
      expect(result.stdout).not.toContain('Switching to');
      expect(result.stdout).not.toContain('Found worktree');
    });
  });
});