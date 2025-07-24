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
});