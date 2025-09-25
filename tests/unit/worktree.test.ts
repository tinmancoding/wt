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

  describe('Upstream Tracking', () => {
    describe('checkAndSetUpstream', () => {
      test('should skip when upstream tracking already exists', async () => {
        const { services, mockLogger, mockGit } = createTestServices();
        const worktreeOps = new WorktreeOperations(services);

        // Mock git command to return existing upstream
        mockGit.setCommandResponse(['for-each-ref', '--format=%(upstream)', 'refs/heads/feature-branch'], {
          stdout: 'refs/remotes/origin/feature-branch',
          stderr: '',
          exitCode: 0
        });

        await worktreeOps.checkAndSetUpstream(mockRepoInfo, 'feature-branch');

        // Should log that upstream is already configured
        expect(mockLogger.hasLogContaining('log', 'already has upstream tracking configured')).toBe(true);
        
        // Should only call for-each-ref to check upstream
        const commands = mockGit.getExecutedCommands();
        expect(commands).toContainEqual({
          gitDir: mockRepoInfo.gitDir,
          args: ['for-each-ref', '--format=%(upstream)', 'refs/heads/feature-branch']
        });
      });

      test('should set upstream when branch exists on remote but no upstream configured', async () => {
        const { services, mockLogger, mockGit } = createTestServices();
        const worktreeOps = new WorktreeOperations(services);

        // Mock sequence of git commands
        mockGit.setCommandResponse(['for-each-ref', '--format=%(upstream)', 'refs/heads/feature-branch'], {
          stdout: '',
          stderr: '',
          exitCode: 0
        });
        mockGit.setCommandResponse(['for-each-ref', '--format=%(refname)', 'refs/remotes'], {
          stdout: 'refs/remotes/origin/feature-branch',
          stderr: '',
          exitCode: 0
        });
        mockGit.setCommandResponse(['branch', '--set-upstream-to', 'origin/feature-branch', 'feature-branch'], {
          stdout: '',
          stderr: '',
          exitCode: 0
        });

        await worktreeOps.checkAndSetUpstream(mockRepoInfo, 'feature-branch');

        // Should log the upstream setup process
        expect(mockLogger.hasLogContaining('log', "Set upstream tracking for branch 'feature-branch' to 'origin/feature-branch'")).toBe(true);
        
        // Should have called branch --set-upstream-to
        const commands = mockGit.getExecutedCommands();
        expect(commands).toContainEqual({
          gitDir: mockRepoInfo.gitDir,
          args: ['branch', '--set-upstream-to', 'origin/feature-branch', 'feature-branch']
        });
      });

      test('should skip when no matching remote branch exists', async () => {
        const { services, mockLogger, mockGit } = createTestServices();
        const worktreeOps = new WorktreeOperations(services);

        mockGit.setCommandResponse(['for-each-ref', '--format=%(upstream)', 'refs/heads/feature-branch'], {
          stdout: '',
          stderr: '',
          exitCode: 0
        });
        mockGit.setCommandResponse(['for-each-ref', '--format=%(refname)', 'refs/remotes'], {
          stdout: 'refs/remotes/origin/main\nrefs/remotes/origin/develop',
          stderr: '',
          exitCode: 0
        });

        await worktreeOps.checkAndSetUpstream(mockRepoInfo, 'feature-branch');

        // Should log that no matching remote branch was found
        expect(mockLogger.hasLogContaining('log', "No matching remote branch found for 'feature-branch', skipping upstream setup")).toBe(true);
        
        // Should not call branch --set-upstream-to
        const commands = mockGit.getExecutedCommands();
        expect(commands).not.toContainEqual(expect.objectContaining({
          args: expect.arrayContaining(['branch', '--set-upstream-to'])
        }));
      });

      test('should handle git command failure gracefully', async () => {
        const { services, mockLogger, mockGit } = createTestServices();
        const worktreeOps = new WorktreeOperations(services);

        // Mock successful upstream check (no tracking set)
        mockGit.setCommandResponse(['for-each-ref', '--format=%(upstream)', 'refs/heads/feature-branch'], {
          stdout: '',
          stderr: '',
          exitCode: 0
        });

        // Mock successful remote branch finding
        mockGit.setCommandResponse(['for-each-ref', '--format=%(refname)', 'refs/remotes'], {
          stdout: 'refs/remotes/origin/feature-branch',
          stderr: '',
          exitCode: 0
        });

        // Mock the set-upstream command failure 
        mockGit.setCommandResponse(['branch', '--set-upstream-to', 'origin/feature-branch', 'feature-branch'], {
          stdout: '',
          stderr: 'Git command failed',
          exitCode: 1
        });

        await worktreeOps.checkAndSetUpstream(mockRepoInfo, 'feature-branch');

        // Should log warning but not throw
        expect(mockLogger.hasLogContaining('warn', "Warning: Failed to set upstream for branch 'feature-branch': Git command failed")).toBe(true);
      });

      test('should handle multiple remotes and choose first match', async () => {
        const { services, mockLogger, mockGit } = createTestServices();
        const worktreeOps = new WorktreeOperations(services);

        mockGit.setCommandResponse(['for-each-ref', '--format=%(upstream)', 'refs/heads/feature-branch'], {
          stdout: '',
          stderr: '',
          exitCode: 0
        });
        mockGit.setCommandResponse(['for-each-ref', '--format=%(refname)', 'refs/remotes'], {
          stdout: 'refs/remotes/origin/feature-branch\nrefs/remotes/upstream/feature-branch\nrefs/remotes/origin/main',
          stderr: '',
          exitCode: 0
        });
        mockGit.setCommandResponse(['branch', '--set-upstream-to', 'origin/feature-branch', 'feature-branch'], {
          stdout: '',
          stderr: '',
          exitCode: 0
        });

        await worktreeOps.checkAndSetUpstream(mockRepoInfo, 'feature-branch');

        // Should set upstream to first matching remote (origin)
        const commands = mockGit.getExecutedCommands();
        expect(commands).toContainEqual({
          gitDir: mockRepoInfo.gitDir,
          args: ['branch', '--set-upstream-to', 'origin/feature-branch', 'feature-branch']
        });
        expect(mockLogger.hasLogContaining('log', "'origin/feature-branch'")).toBe(true);
      });
    });

    describe('createWorktree with upstream tracking', () => {
      test('should call checkAndSetUpstream for local branch resolution', async () => {
        const { services, mockGit } = createTestServices();
        const worktreeOps = new WorktreeOperations(services);

        const resolution = {
          type: 'local' as const,
          branchName: 'feature-branch',
          isOutdated: false
        };

        // Mock successful worktree creation and upstream check
        mockGit.setCommandResponse(['worktree', 'add', '/test/project/feature-branch', 'feature-branch'], {
          stdout: '',
          stderr: '',
          exitCode: 0
        });
        mockGit.setCommandResponse(['for-each-ref', '--format=%(upstream)', 'refs/heads/feature-branch'], {
          stdout: 'refs/remotes/origin/feature-branch',
          stderr: '',
          exitCode: 0
        });

        await worktreeOps.createWorktree(mockRepoInfo, resolution, '/test/project/feature-branch');

        // Should call git worktree add
        const commands = mockGit.getExecutedCommands();
        expect(commands).toContainEqual({
          gitDir: mockRepoInfo.gitDir,
          args: ['worktree', 'add', '/test/project/feature-branch', 'feature-branch']
        });
        
        // Should also call upstream checking commands
        expect(commands).toContainEqual({
          gitDir: mockRepoInfo.gitDir,
          args: ['for-each-ref', '--format=%(upstream)', 'refs/heads/feature-branch']
        });
      });

      test('should not call checkAndSetUpstream for remote branch resolution', async () => {
        const { services, mockGit } = createTestServices();
        const worktreeOps = new WorktreeOperations(services);

        const resolution = {
          type: 'remote' as const,
          branchName: 'feature-branch',
          remoteName: 'origin',
          needsTracking: true
        };

        // Mock successful worktree creation
        mockGit.setCommandResponse(['worktree', 'add', '-b', 'feature-branch', '/test/project/feature-branch', 'origin/feature-branch'], {
          stdout: '',
          stderr: '',
          exitCode: 0
        });

        await worktreeOps.createWorktree(mockRepoInfo, resolution, '/test/project/feature-branch');

        // Should call git worktree add with -b flag for remote branch
        const commands = mockGit.getExecutedCommands();
        expect(commands).toContainEqual({
          gitDir: mockRepoInfo.gitDir,
          args: ['worktree', 'add', '-b', 'feature-branch', '/test/project/feature-branch', 'origin/feature-branch']
        });
        
        // Should not call upstream checking commands (tracking set during creation)
        expect(commands).not.toContainEqual({
          gitDir: mockRepoInfo.gitDir,
          args: ['for-each-ref', '--format=%(upstream)', 'refs/heads/feature-branch']
        });
      });

      test('should not call checkAndSetUpstream for new branch resolution', async () => {
        const { services, mockGit } = createTestServices();
        const worktreeOps = new WorktreeOperations(services);

        const resolution = {
          type: 'new' as const,
          branchName: 'new-feature'
        };

        // Mock successful worktree creation
        mockGit.setCommandResponse(['worktree', 'add', '-b', 'new-feature', '/test/project/new-feature'], {
          stdout: '',
          stderr: '',
          exitCode: 0
        });

        await worktreeOps.createWorktree(mockRepoInfo, resolution, '/test/project/new-feature');

        // Should call git worktree add with -b flag for new branch
        const commands = mockGit.getExecutedCommands();
        expect(commands).toContainEqual({
          gitDir: mockRepoInfo.gitDir,
          args: ['worktree', 'add', '-b', 'new-feature', '/test/project/new-feature']
        });
        
        // Should not call upstream checking commands (no upstream for new branch)
        expect(commands).not.toContainEqual({
          gitDir: mockRepoInfo.gitDir,
          args: ['for-each-ref', '--format=%(upstream)', 'refs/heads/new-feature']
        });
      });

      test('should continue worktree creation even if upstream setup fails', async () => {
        const { services, mockLogger, mockGit } = createTestServices();
        const worktreeOps = new WorktreeOperations(services);

        const resolution = {
          type: 'local' as const,
          branchName: 'feature-branch',
          isOutdated: false
        };

        // Mock worktree creation success, but upstream setup failure
        mockGit.setCommandResponse(['worktree', 'add', '/test/project/feature-branch', 'feature-branch'], {
          stdout: '',
          stderr: '',
          exitCode: 0
        });
        
        // Mock successful upstream check (no upstream set)
        mockGit.setCommandResponse(['for-each-ref', '--format=%(upstream)', 'refs/heads/feature-branch'], {
          stdout: '',
          stderr: '',
          exitCode: 0
        });

        // Mock successful remote branch finding
        mockGit.setCommandResponse(['for-each-ref', '--format=%(refname)', 'refs/remotes'], {
          stdout: 'refs/remotes/origin/feature-branch',
          stderr: '',
          exitCode: 0
        });

        // Mock the set-upstream command failure
        mockGit.setCommandResponse(['branch', '--set-upstream-to', 'origin/feature-branch', 'feature-branch'], {
          stdout: '',
          stderr: 'Git command failed',
          exitCode: 1
        });

        // Should not throw error
        await expect(worktreeOps.createWorktree(mockRepoInfo, resolution, '/test/project/feature-branch')).resolves.toBeUndefined();

        // Should log worktree creation success
        expect(mockLogger.hasLogContaining('log', "Created worktree for existing local branch")).toBe(true);
        
        // Should log upstream setup warning
        expect(mockLogger.hasLogContaining('warn', "Warning: Failed to set upstream for branch 'feature-branch': Git command failed")).toBe(true);
      });
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