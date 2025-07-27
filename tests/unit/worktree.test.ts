import { test, expect, describe } from 'bun:test';
import { 
  WorktreeOperations,
  formatWorktree, 
  formatWorktreeHeader, 
  findWorktreesByPattern,
  promptConfirmation,
  type WorktreeInfo
} from '../../src/worktree.ts';
import type { RepositoryInfo } from '../../src/repository.ts';
import type { WTConfig } from '../../src/config.ts';
import { createServiceContainer } from '../../src/services/container.ts';
import { MockLoggerService } from '../../src/services/test-implementations/MockLoggerService.ts';
import { MockGitService } from '../../src/services/test-implementations/MockGitService.ts';

describe('Worktree Module', () => {
  // Helper to create test services
  function createTestServices() {
    const mockLogger = new MockLoggerService();
    const mockGit = new MockGitService();
    
    const services = createServiceContainer({
      logger: mockLogger,
      git: mockGit
    });
    
    return { services, mockLogger, mockGit };
  }

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

  describe('WorktreeOperations with Services', () => {
    describe('isLocalBranchExists', () => {
      test('should return true for existing local branch', async () => {
        const { services, mockGit } = createTestServices();
        const worktreeOps = new WorktreeOperations(services);

        mockGit.setCommandResponse(['show-ref', '--verify', '--quiet', 'refs/heads/feature-branch'], {
          stdout: '',
          stderr: '',
          exitCode: 0
        });

        const exists = await worktreeOps.isLocalBranchExists(mockRepoInfo, 'feature-branch');
        expect(exists).toBe(true);
      });

      test('should return false for non-existing local branch', async () => {
        const { services, mockGit } = createTestServices();
        const worktreeOps = new WorktreeOperations(services);

        mockGit.setCommandResponse(['show-ref', '--verify', '--quiet', 'refs/heads/non-existing'], {
          stdout: '',
          stderr: '',
          exitCode: 1
        });

        const exists = await worktreeOps.isLocalBranchExists(mockRepoInfo, 'non-existing');
        expect(exists).toBe(false);
      });

      test('should handle git command errors gracefully', async () => {
        const { services, mockGit } = createTestServices();
        const worktreeOps = new WorktreeOperations(services);

        mockGit.setCommandResponse(['show-ref', '--verify', '--quiet', 'refs/heads/error-branch'], {
          stdout: '',
          stderr: 'Git error',
          exitCode: 1
        });

        const exists = await worktreeOps.isLocalBranchExists(mockRepoInfo, 'error-branch');
        expect(exists).toBe(false);
      });
    });

    describe('findRemoteBranch', () => {
      test('should find existing remote branch', async () => {
        const { services, mockGit } = createTestServices();
        const worktreeOps = new WorktreeOperations(services);

        mockGit.setCommandResponse(['for-each-ref', '--format=%(refname)', 'refs/remotes'], {
          stdout: 'refs/remotes/origin/feature-branch\nrefs/remotes/origin/main\n',
          stderr: '',
          exitCode: 0
        });

        const result = await worktreeOps.findRemoteBranch(mockRepoInfo, 'feature-branch');
        expect(result.exists).toBe(true);
        expect(result.remoteName).toBe('origin');
      });

      test('should return false for non-existing remote branch', async () => {
        const { services, mockGit } = createTestServices();
        const worktreeOps = new WorktreeOperations(services);

        mockGit.setCommandResponse(['for-each-ref', '--format=%(refname)', 'refs/remotes'], {
          stdout: 'refs/remotes/origin/main\nrefs/remotes/origin/develop\n',
          stderr: '',
          exitCode: 0
        });

        const result = await worktreeOps.findRemoteBranch(mockRepoInfo, 'non-existing');
        expect(result.exists).toBe(false);
        expect(result.remoteName).toBeUndefined();
      });

      test('should handle git command errors gracefully', async () => {
        const { services, mockGit } = createTestServices();
        const worktreeOps = new WorktreeOperations(services);

        mockGit.setCommandResponse(['for-each-ref', '--format=%(refname)', 'refs/remotes'], {
          stdout: '',
          stderr: 'Error',
          exitCode: 1
        });

        const result = await worktreeOps.findRemoteBranch(mockRepoInfo, 'error-branch');
        expect(result.exists).toBe(false);
      });
    });

    describe('isLocalBranchOutdated', () => {
      test('should return false when no tracking branch exists', async () => {
        const { services, mockGit } = createTestServices();
        const worktreeOps = new WorktreeOperations(services);

        mockGit.setCommandResponse(['for-each-ref', '--format=%(upstream)', 'refs/heads/feature-branch'], {
          stdout: '',
          stderr: '',
          exitCode: 0
        });

        const isOutdated = await worktreeOps.isLocalBranchOutdated(mockRepoInfo, 'feature-branch');
        expect(isOutdated).toBe(false);
      });

      test('should return true when local branch is behind remote', async () => {
        const { services, mockGit } = createTestServices();
        const worktreeOps = new WorktreeOperations(services);

        mockGit
          .setCommandResponse(['for-each-ref', '--format=%(upstream)', 'refs/heads/feature-branch'], {
            stdout: 'refs/remotes/origin/feature-branch',
            stderr: '',
            exitCode: 0
          });
        mockGit.setCommandResponse(['rev-parse', 'refs/heads/feature-branch'], {
            stdout: 'abc123',
            stderr: '',
            exitCode: 0
          });
        mockGit.setCommandResponse(['rev-parse', 'refs/remotes/origin/feature-branch'], {
            stdout: 'def456',
            stderr: '',
            exitCode: 0
          });
        mockGit.setCommandResponse(['merge-base', '--is-ancestor', 'abc123', 'def456'], {
            stdout: '',
            stderr: '',
            exitCode: 0 // local is ancestor of remote
          });

        const isOutdated = await worktreeOps.isLocalBranchOutdated(mockRepoInfo, 'feature-branch');
        expect(isOutdated).toBe(true);
      });

      test('should return false when local branch is up to date', async () => {
        const { services, mockGit } = createTestServices();
        const worktreeOps = new WorktreeOperations(services);

        mockGit
          .setCommandResponse(['for-each-ref', '--format=%(upstream)', 'refs/heads/feature-branch'], {
            stdout: 'refs/remotes/origin/feature-branch',
            stderr: '',
            exitCode: 0
          });
        mockGit.setCommandResponse(['rev-parse', 'refs/heads/feature-branch'], {
            stdout: 'abc123',
            stderr: '',
            exitCode: 0
          });
        mockGit.setCommandResponse(['rev-parse', 'refs/remotes/origin/feature-branch'], {
            stdout: 'abc123', // Same as local
            stderr: '',
            exitCode: 0
          });

        const isOutdated = await worktreeOps.isLocalBranchOutdated(mockRepoInfo, 'feature-branch');
        expect(isOutdated).toBe(false);
      });

      test('should handle git command errors gracefully', async () => {
        const { services, mockGit } = createTestServices();
        const worktreeOps = new WorktreeOperations(services);

        mockGit.setCommandResponse(['for-each-ref', '--format=%(upstream)', 'refs/heads/error-branch'], {
          stdout: '',
          stderr: 'Git error',
          exitCode: 1
        });

        const isOutdated = await worktreeOps.isLocalBranchOutdated(mockRepoInfo, 'error-branch');
        expect(isOutdated).toBe(false);
      });
    });

    describe('performAutoFetch', () => {
      test('should fetch when autoFetch is enabled', async () => {
        const { services, mockGit } = createTestServices();
        const worktreeOps = new WorktreeOperations(services);

        mockGit.setCommandResponse(['fetch', '--all'], '');

        await worktreeOps.performAutoFetch(mockRepoInfo, mockConfig);
        
        const executedCommands = mockGit.getExecutedCommands();
        expect(executedCommands.some(cmd => cmd.args.join(' ') === 'fetch --all')).toBe(true);
      });

      test('should skip fetch when autoFetch is disabled', async () => {
        const { services, mockGit } = createTestServices();
        const worktreeOps = new WorktreeOperations(services);
        const configNoFetch = { ...mockConfig, autoFetch: false };

        await worktreeOps.performAutoFetch(mockRepoInfo, configNoFetch);
        
        const executedCommands = mockGit.getExecutedCommands();
        expect(executedCommands.some(cmd => cmd.args.join(' ') === 'fetch --all')).toBe(false);
      });

      test('should handle fetch errors gracefully', async () => {
        const { services, mockGit, mockLogger } = createTestServices();
        const worktreeOps = new WorktreeOperations(services);

        mockGit.setCommandResponse(['fetch', '--all'], {
          stdout: '',
          stderr: 'Network error',
          exitCode: 1
        });

        await worktreeOps.performAutoFetch(mockRepoInfo, mockConfig);
        
        // Check for warning message
        const warningLogs = mockLogger.getLogsByLevel('warn');
        expect(warningLogs.length).toBeGreaterThan(0);
        expect(warningLogs[0]?.message).toContain('Auto-fetch failed');
      });
    });

    describe('listWorktrees', () => {
      test('should return empty array when no worktrees exist', async () => {
        const { services, mockGit } = createTestServices();
        const worktreeOps = new WorktreeOperations(services);

        mockGit.setCommandResponse(['worktree', 'list', '--porcelain'], '');

        const worktrees = await worktreeOps.listWorktrees(mockRepoInfo);
        expect(worktrees).toEqual([]);
      });

      test('should parse worktree list correctly', async () => {
        const { services, mockGit } = createTestServices();
        const worktreeOps = new WorktreeOperations(services);

        const worktreeOutput = `worktree /test/project/main
HEAD abc123def456
branch refs/heads/main

worktree /test/project/feature
HEAD def456abc123
branch refs/heads/feature`;

        mockGit.setCommandResponse(['worktree', 'list', '--porcelain'], worktreeOutput);

        const worktrees = await worktreeOps.listWorktrees(mockRepoInfo);
        expect(worktrees).toHaveLength(2);
        expect(worktrees[0]?.branch).toBe('main');
        expect(worktrees[1]?.branch).toBe('feature');
      });
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

  describe('Confirmation Prompts', () => {
    // Note: For unit tests, we'll just test the basic logic
    // Integration tests will cover the full interactive behavior
    test('promptConfirmation function exists and is callable', () => {
      expect(typeof promptConfirmation).toBe('function');
    });
  });
});