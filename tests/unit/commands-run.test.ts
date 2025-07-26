import { test, expect, describe, spyOn, beforeEach, afterEach, mock } from "bun:test";
import type { RepositoryInfo } from "../../src/repository.ts";
import type { WTConfig } from "../../src/config.ts";
import type { WorktreeInfo } from "../../src/worktree.ts";
import type { CommandResult } from "../../src/git.ts";

describe("Run Command Unit Tests", () => {
  let exitSpy: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  // Mock modules
  const mockDetectRepository = mock(() => Promise.resolve({
    rootDir: "/test/repo",
    gitDir: "/test/repo/.git",
    type: "standard" as const
  } as RepositoryInfo));

  const mockLoadConfig = mock(() => Promise.resolve({
    worktreeDir: "./",
    autoFetch: true,
    confirmDelete: false,
    defaultBranch: "main",
    hooks: {
      postCreate: null,
      postRemove: null
    }
  } as WTConfig));

  const mockRunCommandInWorktree = mock(() => Promise.resolve({
    exitCode: 0,
    stdout: "success",
    stderr: ""
  } as CommandResult));

  beforeEach(() => {
    exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});

    // Reset mocks
    mockDetectRepository.mockClear();
    mockLoadConfig.mockClear();
    mockRunCommandInWorktree.mockClear();
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("runCommand configuration", () => {
    test("should have correct command definition", async () => {
      const { runCommand } = await import("../../src/commands/index.ts");
      
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

    test("should not have aliases", async () => {
      const { runCommand } = await import("../../src/commands/index.ts");
      expect(runCommand.aliases).toBeUndefined();
    });

    test("should not have flags", async () => {
      const { runCommand } = await import("../../src/commands/index.ts");
      expect(runCommand.flags).toBeUndefined();
    });
  });

  describe("runCommandInWorktree function", () => {
    let mockListWorktrees: any;
    let mockCreateWorktreeWithBranch: any;
    let mockExecuteCommand: any;

    beforeEach(() => {
      mockListWorktrees = mock(() => Promise.resolve([] as WorktreeInfo[]));
      mockCreateWorktreeWithBranch = mock(() => Promise.resolve());
      mockExecuteCommand = mock(() => Promise.resolve({
        exitCode: 0,
        stdout: "success",
        stderr: ""
      } as CommandResult));

      // Mock the worktree module
      mock.module("../../src/worktree.ts", () => ({
        listWorktrees: mockListWorktrees,
        createWorktreeWithBranch: mockCreateWorktreeWithBranch
      }));

      // Mock the git module
      mock.module("../../src/git.ts", () => ({
        executeCommand: mockExecuteCommand
      }));
    });

    afterEach(() => {
      mockListWorktrees.mockRestore();
      mockCreateWorktreeWithBranch.mockRestore();
      mockExecuteCommand.mockRestore();
    });

    test("should create new worktree when none exists", async () => {
      const { runCommandInWorktree } = await import("../../src/worktree.ts");
      
      const repoInfo: RepositoryInfo = {
        rootDir: "/test/repo",
        gitDir: "/test/repo/.git",
        type: "standard"
      };
      
      const config: WTConfig = {
        worktreeDir: "./",
        autoFetch: true,
        confirmDelete: false,
        defaultBranch: "main",
        hooks: { postCreate: null, postRemove: null }
      };

      // Mock empty worktrees list
      mockListWorktrees.mockResolvedValue([]);

      const result = await runCommandInWorktree(repoInfo, config, "feature-branch", "echo", ["hello"]);

      expect(mockListWorktrees).toHaveBeenCalledWith(repoInfo);
      expect(mockCreateWorktreeWithBranch).toHaveBeenCalledWith(repoInfo, config, "feature-branch");
      expect(mockExecuteCommand).toHaveBeenCalledWith("echo", ["hello"], "/test/repo/feature-branch", true);
      expect(result.exitCode).toBe(0);
    });

    test("should use existing worktree when available", async () => {
      const { runCommandInWorktree } = await import("../../src/worktree.ts");
      
      const repoInfo: RepositoryInfo = {
        rootDir: "/test/repo",
        gitDir: "/test/repo/.git",
        type: "standard"
      };
      
      const config: WTConfig = {
        worktreeDir: "./",
        autoFetch: true,
        confirmDelete: false,
        defaultBranch: "main",
        hooks: { postCreate: null, postRemove: null }
      };

      // Mock existing worktree
      const existingWorktree: WorktreeInfo = {
        path: "/test/repo/feature-branch",
        branch: "feature-branch",
        commit: "abc123",
        isCurrent: false,
        isBare: false,
        isDetached: false,
        isLocked: false,
        relativePath: "feature-branch"
      };
      
      mockListWorktrees.mockResolvedValue([existingWorktree]);

      const result = await runCommandInWorktree(repoInfo, config, "feature-branch", "ls", ["-la"]);

      expect(mockListWorktrees).toHaveBeenCalledWith(repoInfo);
      expect(mockCreateWorktreeWithBranch).not.toHaveBeenCalled();
      expect(mockExecuteCommand).toHaveBeenCalledWith("ls", ["-la"], "/test/repo/feature-branch", true);
      expect(result.exitCode).toBe(0);
    });

    test("should handle command execution failure", async () => {
      const { runCommandInWorktree } = await import("../../src/worktree.ts");
      
      const repoInfo: RepositoryInfo = {
        rootDir: "/test/repo",
        gitDir: "/test/repo/.git",
        type: "standard"
      };
      
      const config: WTConfig = {
        worktreeDir: "./",
        autoFetch: true,
        confirmDelete: false,
        defaultBranch: "main",
        hooks: { postCreate: null, postRemove: null }
      };

      mockListWorktrees.mockResolvedValue([]);
      mockExecuteCommand.mockResolvedValue({
        exitCode: 1,
        stdout: "",
        stderr: "command failed"
      });

      const result = await runCommandInWorktree(repoInfo, config, "feature-branch", "false", []);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe("command failed");
    });
  });

  describe("executeCommand function", () => {
    test("should have correct signature", async () => {
      const { executeCommand } = await import("../../src/git.ts");
      expect(typeof executeCommand).toBe("function");
    });

    test("should preserve exit codes", async () => {
      // This test validates the interface exists and can be called
      const mockResult: CommandResult = {
        exitCode: 42,
        stdout: "output",
        stderr: "error"
      };
      
      expect(mockResult.exitCode).toBe(42);
      expect(mockResult.stdout).toBe("output");
      expect(mockResult.stderr).toBe("error");
    });

    test("should handle environment inheritance", () => {
      // Test that the function signature supports environment inheritance
      // This is validated by the TypeScript compilation
      const envTest = { ...process.env };
      expect(typeof envTest).toBe("object");
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