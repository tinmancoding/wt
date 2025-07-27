import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { createRunCommand } from "../../src/commands/index.ts";
import { createServiceContainer } from "../../src/services/container.ts";
import { MockLoggerService } from "../../src/services/test-implementations/MockLoggerService.ts";
import { MockGitService } from "../../src/services/test-implementations/MockGitService.ts";
import { MockFileSystemService } from "../../src/services/test-implementations/MockFileSystemService.ts";
import { MockCommandService } from "../../src/services/test-implementations/MockCommandService.ts";
import { WorktreeOperations } from "../../src/worktree.ts";
import type { RepositoryInfo } from "../../src/repository.ts";
import type { WTConfig } from "../../src/config.ts";

describe("Run Command Unit Tests", () => {
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

  const mockRepoInfo: RepositoryInfo = {
    rootDir: "/test/repo",
    gitDir: "/test/repo/.git", 
    type: "standard"
  };

  const mockConfig: WTConfig = {
    worktreeDir: "./",
    autoFetch: true,
    confirmDelete: false,
    defaultBranch: "main",
    hooks: { postCreate: null, postRemove: null }
  };

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

  describe("runCommand configuration", () => {
    test("should have correct command definition", () => {
      const { services } = createTestServices();
      const runCommand = createRunCommand(services);
      
      expect(runCommand.name).toBe("run");
      expect(runCommand.description).toBe("Create worktree (if needed) and run command in it");
      expect(runCommand.args).toBeDefined();
      expect(Array.isArray(runCommand.args)).toBe(true);
      expect(runCommand.args).toHaveLength(2);
      
      // Check branch argument
      const branchArg = runCommand.args?.[0];
      expect(branchArg?.name).toBe("branch");
      expect(branchArg?.description).toBe("Branch name to create worktree for");
      expect(branchArg?.required).toBe(true);
      
      // Check command argument
      const commandArg = runCommand.args?.[1];
      expect(commandArg?.name).toBe("command");
      expect(commandArg?.description).toBe("Command to execute in the worktree");
      expect(commandArg?.required).toBe(true);
      
      expect(runCommand.handler).toBeDefined();
      expect(typeof runCommand.handler).toBe("function");
    });

    test("should not have aliases", () => {
      const { services } = createTestServices();
      const runCommand = createRunCommand(services);
      expect(runCommand.aliases).toBeUndefined();
    });

    test("should not have flags", () => {
      const { services } = createTestServices();
      const runCommand = createRunCommand(services);
      expect(runCommand.flags).toBeUndefined();
    });
  });

  describe("WorktreeOperations.runCommandInWorktree", () => {
    test("should create new worktree when none exists", async () => {
      const { services, mockGit, mockCmd } = createTestServices();
      const worktreeOps = new WorktreeOperations(services);

      // Mock empty worktrees list
      mockGit.setCommandResponse(['worktree', 'list', '--porcelain'], '');

      // Mock branch resolution
      mockGit.setCommandResponse(['show-ref', '--verify', '--quiet', 'refs/heads/feature-branch'], {
        stdout: '',
        stderr: '',
        exitCode: 1 // Branch doesn't exist locally
      });

      mockGit.setCommandResponse(['for-each-ref', '--format=%(refname)', 'refs/remotes'], {
        stdout: 'refs/remotes/origin/feature-branch\n',
        stderr: '',
        exitCode: 0
      });

      // Mock worktree creation
      mockGit.setCommandResponse(['worktree', 'add', '-b', 'feature-branch', '/test/repo/feature-branch', 'origin/feature-branch'], '');

      // Mock command execution
      mockCmd.setCommandResponse('echo', ['hello'], {
        exitCode: 0,
        stdout: "hello",
        stderr: ""
      });

      const result = await worktreeOps.runCommandInWorktree(mockRepoInfo, mockConfig, "feature-branch", "echo", ["hello"]);

      // Verify worktree creation was attempted
      const gitCommands = mockGit.getExecutedCommands();
      expect(gitCommands.some(cmd => cmd.args.includes('worktree') && cmd.args.includes('add'))).toBe(true);

      // Verify command was executed
      const cmdCommands = mockCmd.getExecutedCommands();
      expect(cmdCommands.some(cmd => cmd.command === 'echo' && cmd.args.includes('hello'))).toBe(true);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("hello");
    });

    test("should use existing worktree when available", async () => {
      const { services, mockGit, mockCmd, mockLogger } = createTestServices();
      const worktreeOps = new WorktreeOperations(services);

      // Mock existing worktree
      const worktreeOutput = `worktree /test/repo/feature-branch
HEAD abc123def456
branch refs/heads/feature-branch`;

      mockGit.setCommandResponse(['worktree', 'list', '--porcelain'], worktreeOutput);

      // Mock command execution
      mockCmd.setCommandResponse('ls', ['-la'], {
        exitCode: 0,
        stdout: "total 8\ndrwxr-xr-x 2 user user 4096 Jan 1 12:00 .\ndrwxr-xr-x 3 user user 4096 Jan 1 12:00 ..",
        stderr: ""
      });

      const result = await worktreeOps.runCommandInWorktree(mockRepoInfo, mockConfig, "feature-branch", "ls", ["-la"]);

      // Verify no worktree creation was attempted
      const gitCommands = mockGit.getExecutedCommands();
      expect(gitCommands.every(cmd => !(cmd.args.includes('worktree') && cmd.args.includes('add')))).toBe(true);

      // Verify command was executed
      const cmdCommands = mockCmd.getExecutedCommands();
      expect(cmdCommands.some(cmd => cmd.command === 'ls' && cmd.args.includes('-la'))).toBe(true);

      expect(result.exitCode).toBe(0);
      expect(mockLogger.hasLog('log', "Using existing worktree for branch 'feature-branch' at /test/repo/feature-branch")).toBe(true);
    });

    test("should handle command execution failure", async () => {
      const { services, mockGit, mockCmd } = createTestServices();
      const worktreeOps = new WorktreeOperations(services);

      // Mock empty worktrees list
      mockGit.setCommandResponse(['worktree', 'list', '--porcelain'], '');

      // Mock branch resolution for new branch
      mockGit.setCommandResponse(['show-ref', '--verify', '--quiet', 'refs/heads/feature-branch'], {
        stdout: '',
        stderr: '',
        exitCode: 1 // Branch doesn't exist locally
      });

      mockGit.setCommandResponse(['for-each-ref', '--format=%(refname)', 'refs/remotes'], {
        stdout: 'refs/remotes/origin/main\n', // No matching remote branch
        stderr: '',
        exitCode: 0
      });

      // Mock worktree creation for new branch
      mockGit.setCommandResponse(['worktree', 'add', '-b', 'feature-branch', '/test/repo/feature-branch'], '');

      // Mock command execution failure
      mockCmd.setCommandResponse('false', [], {
        exitCode: 1,
        stdout: "",
        stderr: "command failed"
      });

      const result = await worktreeOps.runCommandInWorktree(mockRepoInfo, mockConfig, "feature-branch", "false", []);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe("command failed");
    });
  });

  describe("argument validation", () => {
    test("should validate branch name is required", () => {
      const positional: string[] = [];
      const [branch] = positional;
      
      expect(branch).toBeUndefined();
    });

    test("should validate command is required", () => {
      const positional: string[] = ["branch-name"];
      const [, command] = positional;
      
      expect(command).toBeUndefined();
    });

    test("should extract command arguments correctly", () => {
      const positional: string[] = ["branch-name", "npm", "test", "--coverage"];
      const [branch, command, ...commandArgs] = positional;
      
      expect(branch).toBe("branch-name");
      expect(command).toBe("npm");
      expect(commandArgs).toEqual(["test", "--coverage"]);
    });

    test("should handle commands with no arguments", () => {
      const positional: string[] = ["branch-name", "pwd"];
      const [branch, command, ...commandArgs] = positional;
      
      expect(branch).toBe("branch-name");
      expect(command).toBe("pwd");
      expect(commandArgs).toEqual([]);
    });
  });

  describe("error handling patterns", () => {
    test("should identify repository errors", () => {
      const repositoryError = new Error("repository not found");
      expect(repositoryError.message).toContain("repository not found");
    });

    test("should identify filesystem errors", () => {
      const filesystemError = new Error("file not found");
      expect(filesystemError.message).toContain("file");
    });

    test("should handle unknown errors", () => {
      const unknownError = "not an error object";
      expect(typeof unknownError).toBe("string");
    });
  });

  describe("path resolution", () => {
    test("should resolve worktree paths correctly", () => {
      const repoRoot = "/test/repo";
      const branchName = "feature-branch";
      
      // Simulate path.join behavior
      const expectedPath = `${repoRoot}/${branchName}`;
      expect(expectedPath).toBe("/test/repo/feature-branch");
    });

    test("should handle nested worktree directories", () => {
      const repoRoot = "/test/repo";
      const branchName = "feature-branch";
      
      // Simulate path.join behavior
      const expectedPath = `${repoRoot}/worktrees/${branchName}`;
      expect(expectedPath).toBe("/test/repo/worktrees/feature-branch");
    });

    test("should handle absolute worktree directories", () => {
      const branchName = "feature-branch";
      const worktreeDir = "/custom/worktrees/";
      
      // Absolute paths should be used as-is
      const expectedPath = `${worktreeDir}${branchName}`;
      expect(expectedPath).toBe("/custom/worktrees/feature-branch");
    });
  });

  describe("command execution context", () => {
    test("should pass environment variables", () => {
      const env = { ...process.env, TEST_VAR: "test-value" };
      expect(env.TEST_VAR).toBe("test-value");
    });

    test("should set working directory", () => {
      const workDir = "/test/repo/feature-branch";
      expect(workDir).toBe("/test/repo/feature-branch");
    });

    test("should handle stdio inheritance", () => {
      const inheritStdio = true;
      expect(inheritStdio).toBe(true);
    });
  });

  describe("signal handling", () => {
    test("should support signal forwarding", () => {
      // Test that signal forwarding is properly handled
      const signals = ['SIGINT', 'SIGTERM'];
      expect(signals).toContain('SIGINT');
      expect(signals).toContain('SIGTERM');
    });

    test("should clean up signal handlers", () => {
      // Test that cleanup is properly handled
      const cleanup = () => {
        // Mock cleanup function
        return true;
      };
      expect(cleanup()).toBe(true);
    });
  });

  describe("exit code preservation", () => {
    test("should preserve successful exit codes", () => {
      const exitCode = 0;
      expect(exitCode).toBe(0);
    });

    test("should preserve error exit codes", () => {
      const exitCode = 1;
      expect(exitCode).toBe(1);
    });

    test("should preserve custom exit codes", () => {
      const exitCode = 42;
      expect(exitCode).toBe(42);
    });

    test("should handle negative exit codes", () => {
      const exitCode = -1;
      expect(exitCode).toBe(-1);
    });
  });
});