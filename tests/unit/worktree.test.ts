import { test, expect, describe, mock } from 'bun:test';
import { 
  formatWorktree, 
  formatWorktreeHeader, 
  isLocalBranchExists,
  findRemoteBranch,
  isLocalBranchOutdated,
  performAutoFetch,
  resolveBranch,
  createWorktree,
  createWorktreeWithBranch,
  findWorktreesByPattern,
  removeWorktree,
  deleteBranch,
  promptConfirmation,
  type WorktreeInfo,
  type BranchResolution
} from '../../src/worktree.ts';
import type { RepositoryInfo } from '../../src/repository.ts';
import type { WTConfig } from '../../src/config.ts';

describe('Worktree Module', () => {
  describe('formatWorktreeHeader', () => {
    test('should return properly formatted header', () => {
      const header = formatWorktreeHeader();
      expect(header).toBe('  Name                 Branch                    Path');
    });
  });

  describe('formatWorktree', () => {
    test('should format current worktree with asterisk', () => {
      const worktree: WorktreeInfo = {
        path: '/project/main',
        branch: 'main',
        commit: 'abc123def456',
        isCurrent: true,
        isBare: false,
        isDetached: false,
        isLocked: false,
        relativePath: '.'
      };

      const formatted = formatWorktree(worktree);
      expect(formatted).toBe('* main                 main                      .');
    });

    test('should format non-current worktree with space', () => {
      const worktree: WorktreeInfo = {
        path: '/project/feature',
        branch: 'feature-branch',
        commit: 'def456abc123',
        isCurrent: false,
        isBare: false,
        isDetached: false,
        isLocked: false,
        relativePath: '../feature'
      };

      const formatted = formatWorktree(worktree);
      expect(formatted).toBe('  feature              feature-branch            ../feature');
    });

    test('should format bare worktree with [bare] status', () => {
      const worktree: WorktreeInfo = {
        path: '/project/.bare',
        branch: 'unknown',
        commit: '',
        isCurrent: false,
        isBare: true,
        isDetached: false,
        isLocked: false,
        relativePath: '.bare'
      };

      const formatted = formatWorktree(worktree);
      expect(formatted).toBe('  .bare                unknown                   .bare [bare]');
    });

    test('should format detached worktree with commit hash and [detached] status', () => {
      const worktree: WorktreeInfo = {
        path: '/project/detached',
        branch: 'HEAD',
        commit: 'abc123def456789',
        isCurrent: false,
        isBare: false,
        isDetached: true,
        isLocked: false,
        relativePath: '../detached'
      };

      const formatted = formatWorktree(worktree);
      expect(formatted).toBe('  detached             (abc123d)                 ../detached [detached]');
    });

    test('should format locked worktree with [locked] status', () => {
      const worktree: WorktreeInfo = {
        path: '/project/locked',
        branch: 'feature',
        commit: 'def456abc123',
        isCurrent: false,
        isBare: false,
        isDetached: false,
        isLocked: true,
        relativePath: '../locked'
      };

      const formatted = formatWorktree(worktree);
      expect(formatted).toBe('  locked               feature                   ../locked [locked]');
    });

    test('should format worktree with multiple status indicators', () => {
      const worktree: WorktreeInfo = {
        path: '/project/complex',
        branch: 'HEAD',
        commit: 'abc123def456',
        isCurrent: false,
        isBare: false,
        isDetached: true,
        isLocked: true,
        relativePath: '../complex'
      };

      const formatted = formatWorktree(worktree);
      expect(formatted).toBe('  complex              (abc123d)                 ../complex [locked] [detached]');
    });

    test('should handle long branch names properly', () => {
      const worktree: WorktreeInfo = {
        path: '/project/very-long-feature-branch-name',
        branch: 'very-long-feature-branch-name-that-exceeds-normal-length',
        commit: 'abc123def456',
        isCurrent: false,
        isBare: false,
        isDetached: false,
        isLocked: false,
        relativePath: '../very-long-feature-branch-name'
      };

      const formatted = formatWorktree(worktree);
      expect(formatted).toContain('very-long-feature-branch-name-that-exceeds-normal-length');
      expect(formatted).toContain('../very-long-feature-branch-name');
    });
  });

  // Mock git command functions for testing
  const mockGitCommand = mock(() => Promise.resolve(''));
  const mockGitCommandWithResult = mock(() => Promise.resolve({ stdout: '', stderr: '', exitCode: 0 }));

  // Mock the git module
  mock.module('../../src/git.ts', () => ({
    executeGitCommand: mockGitCommand,
    executeGitCommandWithResult: mockGitCommandWithResult
  }));

  // Test data
  const mockRepoInfo: RepositoryInfo = {
    type: 'bare',
    rootDir: '/test/project',
    gitDir: '/test/project/.bare'
  };

  const mockConfig: WTConfig = {
    worktreeDir: './',
    autoFetch: true,
    confirmDelete: false,
    hooks: { postCreate: null, postRemove: null },
    defaultBranch: 'main'
  };

  describe('Branch Existence Checking', () => {
    test('isLocalBranchExists should return true for existing local branch', async () => {
      mockGitCommandWithResult.mockResolvedValue({ 
        stdout: '', 
        stderr: '', 
        exitCode: 0 
      });

      const exists = await isLocalBranchExists(mockRepoInfo, 'feature-branch');
      expect(exists).toBe(true);
      expect(mockGitCommandWithResult).toHaveBeenCalledWith(
        '/test/project/.bare',
        ['show-ref', '--verify', '--quiet', 'refs/heads/feature-branch']
      );
    });

    test('isLocalBranchExists should return false for non-existing local branch', async () => {
      mockGitCommandWithResult.mockResolvedValue({ 
        stdout: '', 
        stderr: '', 
        exitCode: 1 
      });

      const exists = await isLocalBranchExists(mockRepoInfo, 'non-existing');
      expect(exists).toBe(false);
    });

    test('isLocalBranchExists should handle git command errors gracefully', async () => {
      mockGitCommandWithResult.mockRejectedValue(new Error('Git error'));

      const exists = await isLocalBranchExists(mockRepoInfo, 'error-branch');
      expect(exists).toBe(false);
    });

    test('findRemoteBranch should find existing remote branch', async () => {
      mockGitCommandWithResult.mockResolvedValue({
        stdout: 'refs/remotes/origin/feature-branch\nrefs/remotes/origin/main\n',
        stderr: '',
        exitCode: 0
      });

      const result = await findRemoteBranch(mockRepoInfo, 'feature-branch');
      expect(result.exists).toBe(true);
      expect(result.remoteName).toBe('origin');
    });

    test('findRemoteBranch should return false for non-existing remote branch', async () => {
      mockGitCommandWithResult.mockResolvedValue({
        stdout: 'refs/remotes/origin/main\nrefs/remotes/origin/develop\n',
        stderr: '',
        exitCode: 0
      });

      const result = await findRemoteBranch(mockRepoInfo, 'non-existing');
      expect(result.exists).toBe(false);
      expect(result.remoteName).toBeUndefined();
    });

    test('findRemoteBranch should handle git command errors gracefully', async () => {
      mockGitCommandWithResult.mockResolvedValue({
        stdout: '',
        stderr: 'Error',
        exitCode: 1
      });

      const result = await findRemoteBranch(mockRepoInfo, 'error-branch');
      expect(result.exists).toBe(false);
    });
  });

  describe('Branch Outdated Detection', () => {
    test('isLocalBranchOutdated should return false when no tracking branch exists', async () => {
      mockGitCommandWithResult.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0
      });

      const isOutdated = await isLocalBranchOutdated(mockRepoInfo, 'feature-branch');
      expect(isOutdated).toBe(false);
    });

    test('isLocalBranchOutdated should return true when local branch is behind remote', async () => {
      mockGitCommandWithResult
        .mockResolvedValueOnce({ // for-each-ref call
          stdout: 'refs/remotes/origin/feature-branch',
          stderr: '',
          exitCode: 0
        })
        .mockResolvedValueOnce({ // local commit hash
          stdout: 'abc123',
          stderr: '',
          exitCode: 0
        })
        .mockResolvedValueOnce({ // remote commit hash
          stdout: 'def456',
          stderr: '',
          exitCode: 0
        })
        .mockResolvedValueOnce({ // merge-base check
          stdout: '',
          stderr: '',
          exitCode: 0 // local is ancestor of remote
        });

      const isOutdated = await isLocalBranchOutdated(mockRepoInfo, 'feature-branch');
      expect(isOutdated).toBe(true);
    });

    test('isLocalBranchOutdated should return false when local branch is up to date', async () => {
      mockGitCommandWithResult
        .mockResolvedValueOnce({ // for-each-ref call
          stdout: 'refs/remotes/origin/feature-branch',
          stderr: '',
          exitCode: 0
        })
        .mockResolvedValueOnce({ // local commit hash
          stdout: 'abc123',
          stderr: '',
          exitCode: 0
        })
        .mockResolvedValueOnce({ // remote commit hash
          stdout: 'abc123', // Same as local
          stderr: '',
          exitCode: 0
        });

      const isOutdated = await isLocalBranchOutdated(mockRepoInfo, 'feature-branch');
      expect(isOutdated).toBe(false);
    });

    test('isLocalBranchOutdated should handle git command errors gracefully', async () => {
      mockGitCommandWithResult.mockRejectedValue(new Error('Git error'));

      const isOutdated = await isLocalBranchOutdated(mockRepoInfo, 'error-branch');
      expect(isOutdated).toBe(false);
    });
  });

  describe('Auto-fetch Functionality', () => {
    test('performAutoFetch should fetch when autoFetch is enabled', async () => {
      mockGitCommand.mockClear();
      mockGitCommand.mockResolvedValue('');

      await performAutoFetch(mockRepoInfo, mockConfig);
      expect(mockGitCommand).toHaveBeenCalledWith('/test/project/.bare', ['fetch', '--all']);
    });

    test('performAutoFetch should skip fetch when autoFetch is disabled', async () => {
      mockGitCommand.mockClear();
      const configNoFetch = { ...mockConfig, autoFetch: false };

      await performAutoFetch(mockRepoInfo, configNoFetch);
      expect(mockGitCommand).not.toHaveBeenCalled();
    });

    test('performAutoFetch should handle fetch errors gracefully', async () => {
      mockGitCommand.mockClear();
      mockGitCommand.mockRejectedValue(new Error('Network error'));
      const consoleSpy = mock();
      console.warn = consoleSpy;

      await performAutoFetch(mockRepoInfo, mockConfig);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Auto-fetch failed'));
    });
  });

  describe('Branch Resolution', () => {
    test('resolveBranch should resolve to local branch when it exists', async () => {
      // Mock auto-fetch (no fetch because we're testing with disabled fetch)
      const configNoFetch = { ...mockConfig, autoFetch: false };
      
      // Mock local branch exists
      mockGitCommandWithResult.mockResolvedValueOnce({ 
        stdout: '', 
        stderr: '', 
        exitCode: 0 
      });

      // Mock outdated check - not outdated
      mockGitCommandWithResult.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0
      });

      const resolution = await resolveBranch(mockRepoInfo, 'feature-branch', configNoFetch);
      
      expect(resolution.type).toBe('local');
      expect(resolution.branchName).toBe('feature-branch');
      expect(resolution.isOutdated).toBe(false);
    });

    test('resolveBranch should resolve to remote branch when local does not exist but remote does', async () => {
      const configNoFetch = { ...mockConfig, autoFetch: false };
      
      // Mock local branch does not exist
      mockGitCommandWithResult.mockResolvedValueOnce({ 
        stdout: '', 
        stderr: '', 
        exitCode: 1 
      });

      // Mock remote branch exists
      mockGitCommandWithResult.mockResolvedValueOnce({
        stdout: 'refs/remotes/origin/feature-branch\n',
        stderr: '',
        exitCode: 0
      });

      const resolution = await resolveBranch(mockRepoInfo, 'feature-branch', configNoFetch);
      
      expect(resolution.type).toBe('remote');
      expect(resolution.branchName).toBe('feature-branch');
      expect(resolution.remoteName).toBe('origin');
      expect(resolution.needsTracking).toBe(true);
    });

    test('resolveBranch should resolve to new branch when neither local nor remote exists', async () => {
      const configNoFetch = { ...mockConfig, autoFetch: false };
      
      // Mock local branch does not exist
      mockGitCommandWithResult.mockResolvedValueOnce({ 
        stdout: '', 
        stderr: '', 
        exitCode: 1 
      });

      // Mock remote branch does not exist
      mockGitCommandWithResult.mockResolvedValueOnce({
        stdout: 'refs/remotes/origin/main\n',
        stderr: '',
        exitCode: 0
      });

      const resolution = await resolveBranch(mockRepoInfo, 'new-feature', configNoFetch);
      
      expect(resolution.type).toBe('new');
      expect(resolution.branchName).toBe('new-feature');
    });
  });

  describe('Worktree Creation', () => {
    test('createWorktree should create worktree for local branch', async () => {
      const resolution: BranchResolution = {
        type: 'local',
        branchName: 'feature-branch',
        isOutdated: false
      };

      mockGitCommand.mockResolvedValue('');

      await createWorktree(mockRepoInfo, resolution, '/test/worktree');
      
      expect(mockGitCommand).toHaveBeenCalledWith(
        '/test/project/.bare',
        ['worktree', 'add', '/test/worktree', 'feature-branch']
      );
    });

    test('createWorktree should create worktree for remote branch with tracking', async () => {
      const resolution: BranchResolution = {
        type: 'remote',
        branchName: 'feature-branch',
        remoteName: 'origin',
        needsTracking: true
      };

      mockGitCommand.mockResolvedValue('');

      await createWorktree(mockRepoInfo, resolution, '/test/worktree');
      
      expect(mockGitCommand).toHaveBeenCalledWith(
        '/test/project/.bare',
        ['worktree', 'add', '-b', 'feature-branch', '/test/worktree', 'origin/feature-branch']
      );
    });

    test('createWorktree should create worktree for new branch', async () => {
      const resolution: BranchResolution = {
        type: 'new',
        branchName: 'new-feature'
      };

      mockGitCommand.mockResolvedValue('');

      await createWorktree(mockRepoInfo, resolution, '/test/worktree');
      
      expect(mockGitCommand).toHaveBeenCalledWith(
        '/test/project/.bare',
        ['worktree', 'add', '-b', 'new-feature', '/test/worktree']
      );
    });

    test('createWorktree should show warning for outdated local branch', async () => {
      const resolution: BranchResolution = {
        type: 'local',
        branchName: 'feature-branch',
        isOutdated: true
      };

      mockGitCommand.mockResolvedValue('');
      const consoleSpy = mock();
      console.warn = consoleSpy;

      await createWorktree(mockRepoInfo, resolution, '/test/worktree');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Local branch 'feature-branch' may be outdated")
      );
    });

    test('createWorktree should handle git command errors', async () => {
      const resolution: BranchResolution = {
        type: 'local',
        branchName: 'feature-branch'
      };

      mockGitCommand.mockRejectedValue(new Error('Git worktree add failed'));

      expect(createWorktree(mockRepoInfo, resolution, '/test/worktree'))
        .rejects.toThrow('Failed to create worktree');
    });

    test('createWorktree should handle unknown resolution type', async () => {
      const resolution = {
        type: 'unknown',
        branchName: 'feature-branch'
      } as any;

      expect(createWorktree(mockRepoInfo, resolution, '/test/worktree'))
        .rejects.toThrow('Unknown branch resolution type: unknown');
    });
  });

  describe('End-to-End Worktree Creation', () => {
    test('createWorktreeWithBranch should work end-to-end for local branch', async () => {
      const configNoFetch = { ...mockConfig, autoFetch: false };
      
      // Mock branch resolution (local branch exists)
      mockGitCommandWithResult.mockResolvedValueOnce({ 
        stdout: '', 
        stderr: '', 
        exitCode: 0 
      });

      // Mock outdated check
      mockGitCommandWithResult.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0
      });

      // Mock worktree creation
      mockGitCommand.mockResolvedValue('');

      await createWorktreeWithBranch(mockRepoInfo, configNoFetch, 'feature-branch');
      
      expect(mockGitCommand).toHaveBeenCalledWith(
        '/test/project/.bare',
        ['worktree', 'add', '/test/project/feature-branch', 'feature-branch']
      );
    });
  });

  describe('Worktree Pattern Matching', () => {
    const worktrees: WorktreeInfo[] = [
      {
        path: '/project/main',
        branch: 'main',
        commit: 'abc123',
        isCurrent: true,
        isBare: false,
        isDetached: false,
        isLocked: false,
        relativePath: '.'
      },
      {
        path: '/project/feature-login',
        branch: 'feature/login',
        commit: 'def456',
        isCurrent: false,
        isBare: false,
        isDetached: false,
        isLocked: false,
        relativePath: '../feature-login'
      },
      {
        path: '/project/bugfix-auth',
        branch: 'bugfix/auth',
        commit: 'ghi789',
        isCurrent: false,
        isBare: false,
        isDetached: false,
        isLocked: false,
        relativePath: '../bugfix-auth'
      }
    ];

    test('findWorktreesByPattern should return all worktrees when no pattern provided', () => {
      const result = findWorktreesByPattern(worktrees);
      expect(result).toHaveLength(3);
      expect(result).toEqual(worktrees);
    });

    test('findWorktreesByPattern should match by worktree name', () => {
      const result = findWorktreesByPattern(worktrees, 'feature');
      expect(result).toHaveLength(1);
      expect(result[0]?.path).toBe('/project/feature-login');
    });

    test('findWorktreesByPattern should match by branch name', () => {
      const result = findWorktreesByPattern(worktrees, 'login');
      expect(result).toHaveLength(1);
      expect(result[0]?.branch).toBe('feature/login');
    });

    test('findWorktreesByPattern should match by relative path', () => {
      const result = findWorktreesByPattern(worktrees, 'bugfix');
      expect(result).toHaveLength(1);
      expect(result[0]?.relativePath).toBe('../bugfix-auth');
    });

    test('findWorktreesByPattern should return empty array for no matches', () => {
      const result = findWorktreesByPattern(worktrees, 'nonexistent');
      expect(result).toHaveLength(0);
    });

    test('findWorktreesByPattern should be case insensitive', () => {
      const result = findWorktreesByPattern(worktrees, 'MAIN');
      expect(result).toHaveLength(1);
      expect(result[0]?.branch).toBe('main');
    });

    test('findWorktreesByPattern should match partial strings', () => {
      const result = findWorktreesByPattern(worktrees, 'auth');
      expect(result).toHaveLength(1);
      expect(result[0]?.branch).toBe('bugfix/auth');
    });
  });

  describe('Worktree Removal', () => {
    test('removeWorktree should call git worktree remove with correct path', async () => {
      mockGitCommand.mockClear();
      mockGitCommand.mockResolvedValue('');

      await removeWorktree(mockRepoInfo, '/test/project/feature-branch');

      expect(mockGitCommand).toHaveBeenCalledWith(
        '/test/project/.bare',
        ['worktree', 'remove', '/test/project/feature-branch']
      );
    });

    test('removeWorktree should handle git command errors', async () => {
      mockGitCommand.mockClear();
      mockGitCommand.mockRejectedValue(new Error('Git worktree remove failed'));

      expect(removeWorktree(mockRepoInfo, '/test/project/feature-branch'))
        .rejects.toThrow('Failed to remove worktree: Git worktree remove failed');
    });

    test('removeWorktree should handle unknown errors', async () => {
      mockGitCommand.mockClear();
      mockGitCommand.mockRejectedValue('Unknown error');

      expect(removeWorktree(mockRepoInfo, '/test/project/feature-branch'))
        .rejects.toThrow('Failed to remove worktree: Unknown error');
    });
  });

  describe('Branch Deletion', () => {
    test('deleteBranch should call git branch -D with correct branch name', async () => {
      mockGitCommand.mockClear();
      mockGitCommand.mockResolvedValue('');

      await deleteBranch(mockRepoInfo, 'feature-branch');

      expect(mockGitCommand).toHaveBeenCalledWith(
        '/test/project/.bare',
        ['branch', '-D', 'feature-branch']
      );
    });

    test('deleteBranch should handle git command errors', async () => {
      mockGitCommand.mockClear();
      mockGitCommand.mockRejectedValue(new Error('Git branch delete failed'));

      expect(deleteBranch(mockRepoInfo, 'feature-branch'))
        .rejects.toThrow('Failed to delete branch: Git branch delete failed');
    });

    test('deleteBranch should handle unknown errors', async () => {
      mockGitCommand.mockClear();
      mockGitCommand.mockRejectedValue('Unknown error');

      expect(deleteBranch(mockRepoInfo, 'feature-branch'))
        .rejects.toThrow('Failed to delete branch: Unknown error');
    });
  });

  describe('Confirmation Prompts', () => {
    // Note: For unit tests, we'll just test the basic logic
    // Integration tests will cover the full interactive behavior
    test('promptConfirmation function exists and is callable', () => {
      expect(typeof promptConfirmation).toBe('function');
    });
  });
});