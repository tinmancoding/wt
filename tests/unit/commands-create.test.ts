import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { createCreateCommand } from "../../src/commands/index.ts";
import { createServiceContainer } from "../../src/services/container.ts";
import { MockLoggerService } from "../../src/services/test-implementations/MockLoggerService.ts";
import { MockGitService } from "../../src/services/test-implementations/MockGitService.ts";
import { MockFileSystemService } from "../../src/services/test-implementations/MockFileSystemService.ts";
import { MockCommandService } from "../../src/services/test-implementations/MockCommandService.ts";

describe("Create Command Unit Tests", () => {
  let exitSpy: any;
  let originalProcessExit: any;

  // Helper to create test services
  function createTestServices() {
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
    
    return { services, mockLogger, mockGit, mockFs, mockCmd };
  }



  beforeEach(() => {
    originalProcessExit = process.exit;
    exitSpy = mock((code?: number) => {
      throw new Error(`Process exit called with code ${code ?? 0}`);
    });
    process.exit = exitSpy as any;
  });

  afterEach(() => {
    process.exit = originalProcessExit;
  });

  describe("createCommand configuration", () => {
    test("should have correct command definition", () => {
      const { services } = createTestServices();
      const createCommand = createCreateCommand(services);
      
      expect(createCommand.name).toBe("create");
      expect(createCommand.description).toBe("Create a new worktree");
      expect(createCommand.args).toBeDefined();
      expect(Array.isArray(createCommand.args)).toBe(true);
      expect(createCommand.args).toHaveLength(2);
      
      // Check branch argument
      const branchArg = createCommand.args?.[0];
      expect(branchArg?.name).toBe("branch");
      expect(branchArg?.description).toBe("Branch name to create worktree for");
      expect(branchArg?.required).toBe(true);
      
      // Check commit-ish argument
      const commitIshArg = createCommand.args?.[1];
      expect(commitIshArg?.name).toBe("commit-ish");
      expect(commitIshArg?.description).toBe("Optional commit, branch, or tag to checkout in the worktree (defaults to current HEAD)");
      expect(commitIshArg?.required).toBe(false);
      
      expect(createCommand.handler).toBeDefined();
      expect(typeof createCommand.handler).toBe("function");
    });

    test("should not have aliases", () => {
      const { services } = createTestServices();
      const createCommand = createCreateCommand(services);
      expect(createCommand.aliases).toBeUndefined();
    });

    test("should not have flags", () => {
      const { services } = createTestServices();
      const createCommand = createCreateCommand(services);
      expect(createCommand.flags).toBeUndefined();
    });
  });

  describe("createCommand handler", () => {
    test("should create worktree without commit-ish when only branch is provided", async () => {
      const { services, mockGit } = createTestServices();
      const createCommand = createCreateCommand(services);

      // Mock repository detection
      mockGit.setCommandResponse(['rev-parse', '--git-dir'], { stdout: '/test/repo/.git', stderr: '', exitCode: 0 });
      mockGit.setCommandResponse(['rev-parse', '--show-toplevel'], { stdout: '/test/repo', stderr: '', exitCode: 0 });
      
      // Mock config loading
      mockGit.setCommandResponse(['config', '--get', 'wt.worktreeDir'], { stdout: './', stderr: '', exitCode: 0 });
      mockGit.setCommandResponse(['config', '--get', 'wt.autoFetch'], { stdout: 'true', stderr: '', exitCode: 0 });
      mockGit.setCommandResponse(['config', '--get', 'wt.confirmDelete'], { stdout: 'false', stderr: '', exitCode: 0 });
      mockGit.setCommandResponse(['config', '--get', 'wt.defaultBranch'], { stdout: 'main', stderr: '', exitCode: 0 });
      
      // Mock branch resolution (new branch)
      mockGit.setCommandResponse(['show-ref', '--verify', '--quiet', 'refs/heads/feature'], { stdout: '', stderr: '', exitCode: 1 });
      mockGit.setCommandResponse(['for-each-ref', '--format=%(refname)', 'refs/remotes'], { stdout: '', stderr: '', exitCode: 0 });
      
      // Mock worktree creation
      mockGit.setCommandResponse(['worktree', 'add', '-b', 'feature', '/test/repo/feature'], { stdout: '', stderr: '', exitCode: 0 });

      const context = {
        args: {},
        flags: {},
        positional: ['feature']
      };

      await createCommand.handler(context);

      // Since we're using the real repository, check for the actual git commands
      const commands = mockGit.getExecutedCommands();
      const worktreeCommand = commands.find(cmd => cmd.args[0] === 'worktree' && cmd.args[1] === 'add');
      expect(worktreeCommand).toBeDefined();
      expect(worktreeCommand?.args).toContain('-b');
      expect(worktreeCommand?.args).toContain('feature');
    });

    test("should create worktree with commit-ish when both branch and commit-ish are provided", async () => {
      const { services, mockGit } = createTestServices();
      const createCommand = createCreateCommand(services);

      // Mock repository detection
      mockGit.setCommandResponse(['rev-parse', '--git-dir'], { stdout: '/test/repo/.git', stderr: '', exitCode: 0 });
      mockGit.setCommandResponse(['rev-parse', '--show-toplevel'], { stdout: '/test/repo', stderr: '', exitCode: 0 });
      
      // Mock config loading
      mockGit.setCommandResponse(['config', '--get', 'wt.worktreeDir'], { stdout: './', stderr: '', exitCode: 0 });
      mockGit.setCommandResponse(['config', '--get', 'wt.autoFetch'], { stdout: 'true', stderr: '', exitCode: 0 });
      mockGit.setCommandResponse(['config', '--get', 'wt.confirmDelete'], { stdout: 'false', stderr: '', exitCode: 0 });
      mockGit.setCommandResponse(['config', '--get', 'wt.defaultBranch'], { stdout: 'main', stderr: '', exitCode: 0 });
      
      // Mock branch resolution (new branch)
      mockGit.setCommandResponse(['show-ref', '--verify', '--quiet', 'refs/heads/feature'], { stdout: '', stderr: '', exitCode: 1 });
      mockGit.setCommandResponse(['for-each-ref', '--format=%(refname)', 'refs/remotes'], { stdout: '', stderr: '', exitCode: 0 });
      
      // Mock worktree creation with commit-ish
      mockGit.setCommandResponse(['worktree', 'add', '-b', 'feature', '/test/repo/feature', 'abc123'], { stdout: '', stderr: '', exitCode: 0 });

      const context = {
        args: {},
        flags: {},
        positional: ['feature', 'abc123']
      };

      await createCommand.handler(context);

      // Since we're using the real repository, check for the actual git commands
      const commands = mockGit.getExecutedCommands();
      const worktreeCommand = commands.find(cmd => cmd.args[0] === 'worktree' && cmd.args[1] === 'add');
      expect(worktreeCommand).toBeDefined();
      expect(worktreeCommand?.args).toContain('-b');
      expect(worktreeCommand?.args).toContain('feature');
      expect(worktreeCommand?.args).toContain('abc123');
    });

    test("should create worktree with tag as commit-ish", async () => {
      const { services, mockGit } = createTestServices();
      const createCommand = createCreateCommand(services);

      // Mock repository detection
      mockGit.setCommandResponse(['rev-parse', '--git-dir'], { stdout: '/test/repo/.git', stderr: '', exitCode: 0 });
      mockGit.setCommandResponse(['rev-parse', '--show-toplevel'], { stdout: '/test/repo', stderr: '', exitCode: 0 });
      
      // Mock config loading
      mockGit.setCommandResponse(['config', '--get', 'wt.worktreeDir'], { stdout: './', stderr: '', exitCode: 0 });
      mockGit.setCommandResponse(['config', '--get', 'wt.autoFetch'], { stdout: 'true', stderr: '', exitCode: 0 });
      mockGit.setCommandResponse(['config', '--get', 'wt.confirmDelete'], { stdout: 'false', stderr: '', exitCode: 0 });
      mockGit.setCommandResponse(['config', '--get', 'wt.defaultBranch'], { stdout: 'main', stderr: '', exitCode: 0 });
      
      // Mock branch resolution (new branch)
      mockGit.setCommandResponse(['show-ref', '--verify', '--quiet', 'refs/heads/feature'], { stdout: '', stderr: '', exitCode: 1 });
      mockGit.setCommandResponse(['for-each-ref', '--format=%(refname)', 'refs/remotes'], { stdout: '', stderr: '', exitCode: 0 });
      
      // Mock worktree creation with tag
      mockGit.setCommandResponse(['worktree', 'add', '-b', 'feature', '/test/repo/feature', 'v1.0.0'], { stdout: '', stderr: '', exitCode: 0 });

      const context = {
        args: {},
        flags: {},
        positional: ['feature', 'v1.0.0']
      };

      await createCommand.handler(context);

      // Since we're using the real repository, check for the actual git commands
      const commands = mockGit.getExecutedCommands();
      const worktreeCommand = commands.find(cmd => cmd.args[0] === 'worktree' && cmd.args[1] === 'add');
      expect(worktreeCommand).toBeDefined();
      expect(worktreeCommand?.args).toContain('-b');
      expect(worktreeCommand?.args).toContain('feature');
      expect(worktreeCommand?.args).toContain('v1.0.0');
    });

    test("should create worktree with commit hash as commit-ish", async () => {
      const { services, mockGit } = createTestServices();
      const createCommand = createCreateCommand(services);

      // Mock repository detection
      mockGit.setCommandResponse(['rev-parse', '--git-dir'], { stdout: '/test/repo/.git', stderr: '', exitCode: 0 });
      mockGit.setCommandResponse(['rev-parse', '--show-toplevel'], { stdout: '/test/repo', stderr: '', exitCode: 0 });
      
      // Mock config loading
      mockGit.setCommandResponse(['config', '--get', 'wt.worktreeDir'], { stdout: './', stderr: '', exitCode: 0 });
      mockGit.setCommandResponse(['config', '--get', 'wt.autoFetch'], { stdout: 'true', stderr: '', exitCode: 0 });
      mockGit.setCommandResponse(['config', '--get', 'wt.confirmDelete'], { stdout: 'false', stderr: '', exitCode: 0 });
      mockGit.setCommandResponse(['config', '--get', 'wt.defaultBranch'], { stdout: 'main', stderr: '', exitCode: 0 });
      
      // Mock branch resolution (new branch)
      mockGit.setCommandResponse(['show-ref', '--verify', '--quiet', 'refs/heads/feature'], { stdout: '', stderr: '', exitCode: 1 });
      mockGit.setCommandResponse(['for-each-ref', '--format=%(refname)', 'refs/remotes'], { stdout: '', stderr: '', exitCode: 0 });
      
      // Mock worktree creation with commit hash
      const commitHash = 'a1b2c3d4e5f6789012345678901234567890abcd';
      mockGit.setCommandResponse(['worktree', 'add', '-b', 'feature', '/test/repo/feature', commitHash], { stdout: '', stderr: '', exitCode: 0 });

      const context = {
        args: {},
        flags: {},
        positional: ['feature', commitHash]
      };

      await createCommand.handler(context);

      // Since we're using the real repository, check for the actual git commands
      const commands = mockGit.getExecutedCommands();
      const worktreeCommand = commands.find(cmd => cmd.args[0] === 'worktree' && cmd.args[1] === 'add');
      expect(worktreeCommand).toBeDefined();
      expect(worktreeCommand?.args).toContain('-b');
      expect(worktreeCommand?.args).toContain('feature');
      expect(worktreeCommand?.args).toContain(commitHash);
    });

    test("should create worktree with remote branch as commit-ish", async () => {
      const { services, mockGit } = createTestServices();
      const createCommand = createCreateCommand(services);

      // Mock repository detection
      mockGit.setCommandResponse(['rev-parse', '--git-dir'], { stdout: '/test/repo/.git', stderr: '', exitCode: 0 });
      mockGit.setCommandResponse(['rev-parse', '--show-toplevel'], { stdout: '/test/repo', stderr: '', exitCode: 0 });
      
      // Mock config loading
      mockGit.setCommandResponse(['config', '--get', 'wt.worktreeDir'], { stdout: './', stderr: '', exitCode: 0 });
      mockGit.setCommandResponse(['config', '--get', 'wt.autoFetch'], { stdout: 'true', stderr: '', exitCode: 0 });
      mockGit.setCommandResponse(['config', '--get', 'wt.confirmDelete'], { stdout: 'false', stderr: '', exitCode: 0 });
      mockGit.setCommandResponse(['config', '--get', 'wt.defaultBranch'], { stdout: 'main', stderr: '', exitCode: 0 });
      
      // Mock branch resolution (new branch)
      mockGit.setCommandResponse(['show-ref', '--verify', '--quiet', 'refs/heads/feature'], { stdout: '', stderr: '', exitCode: 1 });
      mockGit.setCommandResponse(['for-each-ref', '--format=%(refname)', 'refs/remotes'], { stdout: '', stderr: '', exitCode: 0 });
      
      // Mock worktree creation with remote branch
      mockGit.setCommandResponse(['worktree', 'add', '-b', 'feature', '/test/repo/feature', 'origin/develop'], { stdout: '', stderr: '', exitCode: 0 });

      const context = {
        args: {},
        flags: {},
        positional: ['feature', 'origin/develop']
      };

      await createCommand.handler(context);

      // Since we're using the real repository, check for the actual git commands
      const commands = mockGit.getExecutedCommands();
      const worktreeCommand = commands.find(cmd => cmd.args[0] === 'worktree' && cmd.args[1] === 'add');
      expect(worktreeCommand).toBeDefined();
      expect(worktreeCommand?.args).toContain('-b');
      expect(worktreeCommand?.args).toContain('feature');
      expect(worktreeCommand?.args).toContain('origin/develop');
    });

    test("should handle missing branch argument", async () => {
      const { services, mockLogger } = createTestServices();
      const createCommand = createCreateCommand(services);

      const context = {
        args: {},
        flags: {},
        positional: []
      };

      await expect(createCommand.handler(context)).rejects.toThrow('Process exit called with code 1');
      expect(mockLogger.hasLog('error', 'Error: Branch name is required')).toBe(true);
    });

    test("should handle empty branch argument", async () => {
      const { services, mockLogger } = createTestServices();
      const createCommand = createCreateCommand(services);

      const context = {
        args: {},
        flags: {},
        positional: ['']
      };

      await expect(createCommand.handler(context)).rejects.toThrow('Process exit called with code 1');
      expect(mockLogger.hasLog('error', 'Error: Branch name is required')).toBe(true);
    });
  });
});
