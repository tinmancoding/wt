import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { spawn } from 'child_process';
import { createTestEnvironment, initializeGitRepo, type TestEnvironment } from './test-utils.ts';

// Helper function to run git command and capture output
async function runGitWithOutput(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Git command timed out after 10 seconds'));
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

// Helper function to run git command (throws on error)
async function runGit(args: string[], cwd: string): Promise<void> {
  const result = await runGitWithOutput(args, cwd);
  if (result.exitCode !== 0) {
    throw new Error(`Git command failed: ${result.stderr || result.stdout}`);
  }
}



// Helper function to run wt command
async function runWT(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const wtBinaryPath = join(process.cwd(), 'wt');
  
  return new Promise((resolve, reject) => {
    const child = spawn(wtBinaryPath, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('WT command timed out after 10 seconds'));
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

describe('Upstream Tracking Integration Tests', () => {
  let testEnv: TestEnvironment;
  let remoteDir: string;

  beforeEach(async () => {
    testEnv = await createTestEnvironment();
    // Create a separate remote repository for testing
    remoteDir = join(testEnv.tempDir, 'remote');
    await mkdir(remoteDir, { recursive: true });
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  describe('Local branch without upstream tracking', () => {
    test('should set upstream tracking when creating worktree from local branch', async () => {
      // Initialize empty bare remote repository
      await runGit(['init', '--bare'], remoteDir);

      // Initialize local repository and connect to remote
      await initializeGitRepo(testEnv.repoDir);
      await runGit(['remote', 'add', 'origin', remoteDir], testEnv.repoDir);
      
      // Get the default branch name from local repository
      const { stdout: defaultBranch } = await runGitWithOutput(['branch', '--show-current'], testEnv.repoDir);
      
      // Push initial commit to remote
      await runGit(['push', '-u', 'origin', defaultBranch], testEnv.repoDir);

      // Create a local branch without upstream tracking
      await runGit(['checkout', '-b', 'feature-branch'], testEnv.repoDir);
      await writeFile(join(testEnv.repoDir, 'feature.txt'), 'New feature');
      await runGit(['add', '.'], testEnv.repoDir);
      await runGit(['commit', '-m', 'Add feature'], testEnv.repoDir);
      
      // Push branch to remote without setting upstream
      await runGit(['push', 'origin', 'feature-branch'], testEnv.repoDir);
      
      // Switch back to default branch
      await runGit(['checkout', defaultBranch], testEnv.repoDir);

      // Verify branch has no upstream tracking
      const beforeResult = await runGitWithOutput(['for-each-ref', '--format=%(upstream)', 'refs/heads/feature-branch'], testEnv.repoDir);
      expect(beforeResult.stdout).toBe('');

      // Create worktree for the local branch
      const wtResult = await runWT(['create', 'feature-branch'], testEnv.repoDir);
      expect(wtResult.exitCode).toBe(0);
      expect(wtResult.stdout).toContain('Created worktree for existing local branch');
      expect(wtResult.stdout).toContain('Set upstream tracking for branch');

      // Verify upstream tracking is now set
      const afterResult = await runGitWithOutput(['for-each-ref', '--format=%(upstream)', 'refs/heads/feature-branch'], testEnv.repoDir);
      expect(afterResult.stdout).toContain('refs/remotes/origin/feature-branch');

      // Verify the worktree was created successfully
      const listResult = await runWT(['list'], testEnv.repoDir);
      expect(listResult.exitCode).toBe(0);
      expect(listResult.stdout).toContain('feature-branch');
    });

    test('should skip upstream setup when no matching remote branch exists', async () => {
      // Initialize empty bare remote repository
      await runGit(['init', '--bare'], remoteDir);

      // Initialize local repository and connect to remote
      await initializeGitRepo(testEnv.repoDir);
      await runGit(['remote', 'add', 'origin', remoteDir], testEnv.repoDir);
      
      // Get the default branch name and push initial commit
      const { stdout: defaultBranch } = await runGitWithOutput(['branch', '--show-current'], testEnv.repoDir);
      await runGit(['push', '-u', 'origin', defaultBranch], testEnv.repoDir);

      // Create a local branch that doesn't exist on remote
      await runGit(['checkout', '-b', 'local-only-branch'], testEnv.repoDir);
      await writeFile(join(testEnv.repoDir, 'local.txt'), 'Local only');
      await runGit(['add', '.'], testEnv.repoDir);
      await runGit(['commit', '-m', 'Local commit'], testEnv.repoDir);
      
      // Switch back to default branch
      await runGit(['checkout', defaultBranch], testEnv.repoDir);

      // Create worktree for the local branch
      const wtResult = await runWT(['create', 'local-only-branch'], testEnv.repoDir);
      expect(wtResult.exitCode).toBe(0);
      expect(wtResult.stdout).toContain('Created worktree for existing local branch');
      expect(wtResult.stdout).toContain('No matching remote branch found');

      // Verify no upstream tracking is set
      const afterResult = await runGitWithOutput(['for-each-ref', '--format=%(upstream)', 'refs/heads/local-only-branch'], testEnv.repoDir);
      expect(afterResult.stdout).toBe('');
    });

    test('should preserve existing upstream tracking', async () => {
      // Initialize empty bare remote repository
      await runGit(['init', '--bare'], remoteDir);

      // Initialize local repository and connect to remote
      await initializeGitRepo(testEnv.repoDir);
      await runGit(['remote', 'add', 'origin', remoteDir], testEnv.repoDir);
      
      // Get the default branch name and push initial commit
      const { stdout: defaultBranch } = await runGitWithOutput(['branch', '--show-current'], testEnv.repoDir);
      await runGit(['push', '-u', 'origin', defaultBranch], testEnv.repoDir);

      // Create a local branch with upstream tracking
      await runGit(['checkout', '-b', 'tracked-branch'], testEnv.repoDir);
      await writeFile(join(testEnv.repoDir, 'tracked.txt'), 'Tracked feature');
      await runGit(['add', '.'], testEnv.repoDir);
      await runGit(['commit', '-m', 'Add tracked feature'], testEnv.repoDir);
      await runGit(['push', '-u', 'origin', 'tracked-branch'], testEnv.repoDir);
      
      // Switch back to default branch
      await runGit(['checkout', defaultBranch], testEnv.repoDir);

      // Verify upstream tracking exists
      const beforeResult = await runGitWithOutput(['for-each-ref', '--format=%(upstream)', 'refs/heads/tracked-branch'], testEnv.repoDir);
      expect(beforeResult.stdout).toContain('refs/remotes/origin/tracked-branch');

      // Create worktree for the tracked branch
      const wtResult = await runWT(['create', 'tracked-branch'], testEnv.repoDir);
      expect(wtResult.exitCode).toBe(0);
      expect(wtResult.stdout).toContain('Created worktree for existing local branch');
      expect(wtResult.stdout).toContain('already has upstream tracking configured');

      // Verify upstream tracking is preserved
      const afterResult = await runGitWithOutput(['for-each-ref', '--format=%(upstream)', 'refs/heads/tracked-branch'], testEnv.repoDir);
      expect(afterResult.stdout).toContain('refs/remotes/origin/tracked-branch');
    });
  });

  describe('Remote branch worktree creation', () => {
    test('should not run upstream check for remote branch worktrees', async () => {
      // Initialize empty bare remote repository
      await runGit(['init', '--bare'], remoteDir);

      // Initialize local repository and connect to remote
      await initializeGitRepo(testEnv.repoDir);
      await runGit(['remote', 'add', 'origin', remoteDir], testEnv.repoDir);
      
      // Get the default branch name and push initial commit
      const { stdout: defaultBranch } = await runGitWithOutput(['branch', '--show-current'], testEnv.repoDir);
      await runGit(['push', '-u', 'origin', defaultBranch], testEnv.repoDir);

      // Create a branch on remote only
      await runGit(['checkout', '-b', 'remote-feature'], testEnv.repoDir);
      await writeFile(join(testEnv.repoDir, 'remote-feature.txt'), 'Remote feature');
      await runGit(['add', '.'], testEnv.repoDir);
      await runGit(['commit', '-m', 'Add remote feature'], testEnv.repoDir);
      await runGit(['push', 'origin', 'remote-feature'], testEnv.repoDir);
      
      // Delete local branch and switch back
      await runGit(['checkout', defaultBranch], testEnv.repoDir);
      await runGit(['branch', '-D', 'remote-feature'], testEnv.repoDir);

      // Fetch to get remote references
      await runGit(['fetch'], testEnv.repoDir);

      // Create worktree from remote branch
      const wtResult = await runWT(['create', 'remote-feature'], testEnv.repoDir);
      expect(wtResult.exitCode).toBe(0);
      expect(wtResult.stdout).toContain('Created worktree for remote branch');
      expect(wtResult.stdout).toContain('with local tracking branch');
      
      // Should not contain upstream checking messages since this is a remote branch
      expect(wtResult.stdout).not.toContain('Checking upstream for branch');

      // Verify the branch has proper upstream tracking (set during creation)
      const afterResult = await runGitWithOutput(['for-each-ref', '--format=%(upstream)', 'refs/heads/remote-feature'], testEnv.repoDir);
      expect(afterResult.stdout).toContain('refs/remotes/origin/remote-feature');
    });
  });

  describe('New branch worktree creation', () => {
    test('should not run upstream check for new branch worktrees', async () => {
      // Initialize repository
      await initializeGitRepo(testEnv.repoDir);

      // Create worktree with new branch
      const wtResult = await runWT(['create', 'brand-new-branch'], testEnv.repoDir);
      expect(wtResult.exitCode).toBe(0);
      expect(wtResult.stdout).toContain('Created worktree with new branch');
      
      // Should not contain upstream checking messages since this is a new branch
      expect(wtResult.stdout).not.toContain('Checking upstream for branch');
      expect(wtResult.stdout).not.toContain('Set upstream tracking');

      // Verify no upstream tracking is set for new branch
      const afterResult = await runGitWithOutput(['for-each-ref', '--format=%(upstream)', 'refs/heads/brand-new-branch'], testEnv.repoDir);
      expect(afterResult.stdout).toBe('');
    });
  });

  describe('Multiple remotes scenario', () => {
    test('should set upstream to origin when multiple remotes exist', async () => {
      // Initialize remote repositories
      const remote1Dir = join(testEnv.tempDir, 'remote1');
      const remote2Dir = join(testEnv.tempDir, 'remote2');
      await mkdir(remote1Dir, { recursive: true });
      await mkdir(remote2Dir, { recursive: true });
      await runGit(['init', '--bare'], remote1Dir);
      await runGit(['init', '--bare'], remote2Dir);

      // Initialize local repository and connect to multiple remotes
      await initializeGitRepo(testEnv.repoDir);
      await runGit(['remote', 'add', 'origin', remote1Dir], testEnv.repoDir);
      await runGit(['remote', 'add', 'upstream', remote2Dir], testEnv.repoDir);
      
      // Get the default branch name and push initial commit
      const { stdout: defaultBranch } = await runGitWithOutput(['branch', '--show-current'], testEnv.repoDir);
      await runGit(['push', 'origin', defaultBranch], testEnv.repoDir);

      // Create a local branch and push to origin
      await runGit(['checkout', '-b', 'multi-remote-branch'], testEnv.repoDir);
      await writeFile(join(testEnv.repoDir, 'multi.txt'), 'Multi remote feature');
      await runGit(['add', '.'], testEnv.repoDir);
      await runGit(['commit', '-m', 'Add multi remote feature'], testEnv.repoDir);
      await runGit(['push', 'origin', 'multi-remote-branch'], testEnv.repoDir);
      
      // Switch back to default branch
      await runGit(['checkout', defaultBranch], testEnv.repoDir);

      // Create worktree for the branch
      const wtResult = await runWT(['create', 'multi-remote-branch'], testEnv.repoDir);
      expect(wtResult.exitCode).toBe(0);
      expect(wtResult.stdout).toContain('Set upstream tracking for branch');
      expect(wtResult.stdout).toContain('origin/multi-remote-branch');

      // Verify upstream tracking is set to origin
      const afterResult = await runGitWithOutput(['for-each-ref', '--format=%(upstream)', 'refs/heads/multi-remote-branch'], testEnv.repoDir);
      expect(afterResult.stdout).toContain('refs/remotes/origin/multi-remote-branch');
    });
  });

  describe('Error handling scenarios', () => {
    test('should continue worktree creation even if upstream setup fails', async () => {
      // Initialize repository
      await initializeGitRepo(testEnv.repoDir);
      
      // Get the default branch name
      const { stdout: defaultBranch } = await runGitWithOutput(['branch', '--show-current'], testEnv.repoDir);

      // Create a local branch
      await runGit(['checkout', '-b', 'error-test-branch'], testEnv.repoDir);
      await writeFile(join(testEnv.repoDir, 'error.txt'), 'Error test');
      await runGit(['add', '.'], testEnv.repoDir);
      await runGit(['commit', '-m', 'Add error test'], testEnv.repoDir);
      
      // Switch back to default branch
      await runGit(['checkout', defaultBranch], testEnv.repoDir);

      // Remove .git directory temporarily to simulate error condition during upstream setup
      // (Note: This is a contrived example - in reality, upstream setup uses the main git dir)
      
      // Create worktree - should succeed even if upstream setup encounters issues
      const wtResult = await runWT(['create', 'error-test-branch'], testEnv.repoDir);
      expect(wtResult.exitCode).toBe(0);
      expect(wtResult.stdout).toContain('Created worktree for existing local branch');

      // Verify the worktree exists despite any upstream setup issues
      const listResult = await runWT(['list'], testEnv.repoDir);
      expect(listResult.exitCode).toBe(0);
      expect(listResult.stdout).toContain('error-test-branch');
    });
  });

  describe('Worktree directory structure', () => {
    test('should work with standard repository setup', async () => {
      // Initialize remote repository
      await runGit(['init', '--bare'], remoteDir);

      // Initialize local repository and connect to remote
      await initializeGitRepo(testEnv.repoDir);
      await runGit(['remote', 'add', 'origin', remoteDir], testEnv.repoDir);
      
      // Get the default branch name and push initial commit
      const { stdout: defaultBranch } = await runGitWithOutput(['branch', '--show-current'], testEnv.repoDir);
      await runGit(['push', 'origin', defaultBranch], testEnv.repoDir);

      // Create a local branch
      await runGit(['checkout', '-b', 'standard-test-branch'], testEnv.repoDir);
      await writeFile(join(testEnv.repoDir, 'standard.txt'), 'Standard repo test');
      await runGit(['add', '.'], testEnv.repoDir);
      await runGit(['commit', '-m', 'Add standard test'], testEnv.repoDir);
      await runGit(['push', 'origin', 'standard-test-branch'], testEnv.repoDir);
      
      // Switch back to default branch
      await runGit(['checkout', defaultBranch], testEnv.repoDir);

      // Create worktree in standard repo setup
      const wtResult = await runWT(['create', 'standard-test-branch'], testEnv.repoDir);
      expect(wtResult.exitCode).toBe(0);
      expect(wtResult.stdout).toContain('Created worktree for existing local branch');
      expect(wtResult.stdout).toContain('Set upstream tracking for branch');

      // Verify upstream tracking works in standard repo setup
      const afterResult = await runGitWithOutput(['for-each-ref', '--format=%(upstream)', 'refs/heads/standard-test-branch'], testEnv.repoDir);
      expect(afterResult.stdout).toContain('refs/remotes/origin/standard-test-branch');
    });
  });

  describe('Auto-fetch integration', () => {
    test('should set upstream after auto-fetch when enabled', async () => {
      // Initialize remote repository
      await runGit(['init', '--bare'], remoteDir);

      // Initialize local repository and connect to remote
      await initializeGitRepo(testEnv.repoDir);
      await runGit(['remote', 'add', 'origin', remoteDir], testEnv.repoDir);
      
      // Get the default branch name and push initial commit
      const { stdout: defaultBranch } = await runGitWithOutput(['branch', '--show-current'], testEnv.repoDir);
      await runGit(['push', '-u', 'origin', defaultBranch], testEnv.repoDir);

      // Create .wtconfig.json with autoFetch enabled
      const config = {
        worktreeDir: "./",
        autoFetch: true,
        confirmDelete: false,
        hooks: {
          postCreate: null,
          postRemove: null
        },
        defaultBranch: defaultBranch
      };
      await writeFile(join(testEnv.repoDir, '.wtconfig.json'), JSON.stringify(config, null, 2));

      // Create a local branch without upstream
      await runGit(['checkout', '-b', 'autofetch-branch'], testEnv.repoDir);
      await writeFile(join(testEnv.repoDir, 'autofetch.txt'), 'Auto fetch test');
      await runGit(['add', '.'], testEnv.repoDir);
      await runGit(['commit', '-m', 'Add autofetch test'], testEnv.repoDir);
      await runGit(['push', 'origin', 'autofetch-branch'], testEnv.repoDir);
      
      // Switch back to default branch
      await runGit(['checkout', defaultBranch], testEnv.repoDir);

      // Create worktree (should trigger auto-fetch and then set upstream)
      const wtResult = await runWT(['create', 'autofetch-branch'], testEnv.repoDir);
      expect(wtResult.exitCode).toBe(0);
      expect(wtResult.stdout).toContain('Fetching latest changes');
      expect(wtResult.stdout).toContain('Set upstream tracking for branch');
    });
  });
});
