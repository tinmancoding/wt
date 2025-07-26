import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { executeGitCommandInDir } from "../../src/git.ts";

describe("Run Command Integration Tests", () => {
  let tempDir: string;
  let repoDir: string;

  beforeEach(async () => {
    // Create temporary directory for test repository
    tempDir = await mkdtemp(join(tmpdir(), "wt-run-test-"));
    repoDir = join(tempDir, "test-repo");

    // Initialize a git repository
    await executeGitCommandInDir(tempDir, ["init", "test-repo"]);
    
    // Configure git for testing
    await executeGitCommandInDir(repoDir, ["config", "user.name", "Test User"]);
    await executeGitCommandInDir(repoDir, ["config", "user.email", "test@example.com"]);
    
    // Create initial commit
    await executeGitCommandInDir(repoDir, ["commit", "--allow-empty", "-m", "Initial commit"]);
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe("Basic command execution", () => {
    test("should run simple command in new worktree", async () => {
      const { spawn } = await import("node:child_process");
      const wtPath = resolve(process.cwd(), "src/index.ts");
      
      // Test running echo command in a new worktree
      const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
        const child = spawn("bun", ["run", wtPath, "run", "feature-branch", "echo", "hello-world"], {
          cwd: repoDir,
          stdio: ["ignore", "pipe", "pipe"]
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        child.on("close", (code) => {
          resolve({ code: code ?? -1, stdout, stderr });
        });
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toContain("hello-world");
    });

    test("should run command in existing worktree", async () => {
      const { spawn } = await import("node:child_process");
      const wtPath = resolve(process.cwd(), "src/index.ts");
      
      // First, create a worktree
      await new Promise<void>((resolve, reject) => {
        const child = spawn("bun", ["run", wtPath, "create", "test-branch"], {
          cwd: repoDir,
          stdio: "ignore"
        });

        child.on("close", (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Failed to create worktree: exit code ${code}`));
          }
        });
      });

      // Now run command in existing worktree
      const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
        const child = spawn("bun", ["run", wtPath, "run", "test-branch", "pwd"], {
          cwd: repoDir,
          stdio: ["ignore", "pipe", "pipe"]
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        child.on("close", (code) => {
          resolve({ code: code ?? -1, stdout, stderr });
        });
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toContain("test-branch");
    });

    test("should preserve command exit codes", async () => {
      const { spawn } = await import("node:child_process");
      const wtPath = resolve(process.cwd(), "src/index.ts");
      
      // Test running a command that fails (exit code 1)
      const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
        const child = spawn("bun", ["run", wtPath, "run", "test-branch", "--", "bash", "-c", "exit 42"], {
          cwd: repoDir,
          stdio: ["ignore", "pipe", "pipe"]
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        child.on("close", (code) => {
          resolve({ code: code ?? -1, stdout, stderr });
        });
      });

      expect(result.code).toBe(42);
    });
  });

  describe("Command with arguments", () => {
    test("should handle commands with multiple arguments", async () => {
      const { spawn } = await import("node:child_process");
      const wtPath = resolve(process.cwd(), "src/index.ts");
      
      // Test running ls with arguments
      const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
        const child = spawn("bun", ["run", wtPath, "run", "list-test", "--", "ls", "-la"], {
          cwd: repoDir,
          stdio: ["ignore", "pipe", "pipe"]
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        child.on("close", (code) => {
          resolve({ code: code ?? -1, stdout, stderr });
        });
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toContain(".");
      expect(result.stdout).toContain("..");
    });

    test("should handle complex shell commands", async () => {
      const { spawn } = await import("node:child_process");
      const wtPath = resolve(process.cwd(), "src/index.ts");
      
      // Test running a more complex command
      const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
        const child = spawn("bun", ["run", wtPath, "run", "shell-test", "--", "bash", "-c", "echo $PWD | grep shell-test"], {
          cwd: repoDir,
          stdio: ["ignore", "pipe", "pipe"]
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        child.on("close", (code) => {
          resolve({ code: code ?? -1, stdout, stderr });
        });
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toContain("shell-test");
    });
  });

  describe("Error handling", () => {
    test("should handle missing branch argument", async () => {
      const { spawn } = await import("node:child_process");
      const wtPath = resolve(process.cwd(), "src/index.ts");
      
      const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
        const child = spawn("bun", ["run", wtPath, "run"], {
          cwd: repoDir,
          stdio: ["ignore", "pipe", "pipe"]
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        child.on("close", (code) => {
          resolve({ code: code ?? -1, stdout, stderr });
        });
      });

      expect(result.code).toBe(2); // EXIT_CODES.INVALID_ARGUMENTS
      expect(result.stderr).toContain("Branch name is required");
    });

    test("should handle missing command argument", async () => {
      const { spawn } = await import("node:child_process");
      const wtPath = resolve(process.cwd(), "src/index.ts");
      
      const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
        const child = spawn("bun", ["run", wtPath, "run", "test-branch"], {
          cwd: repoDir,
          stdio: ["ignore", "pipe", "pipe"]
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        child.on("close", (code) => {
          resolve({ code: code ?? -1, stdout, stderr });
        });
      });

      expect(result.code).toBe(2); // EXIT_CODES.INVALID_ARGUMENTS
      expect(result.stderr).toContain("Command is required");
    });

    test("should handle non-existent command", async () => {
      const { spawn } = await import("node:child_process");
      const wtPath = resolve(process.cwd(), "src/index.ts");
      
      const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
        const child = spawn("bun", ["run", wtPath, "run", "test-branch", "non-existent-command-12345"], {
          cwd: repoDir,
          stdio: ["ignore", "pipe", "pipe"]
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        child.on("close", (code) => {
          resolve({ code: code ?? -1, stdout, stderr });
        });
      });

      expect(result.code).not.toBe(0);
    });
  });

  describe("Working directory context", () => {
    test("should execute command in correct worktree directory", async () => {
      const { spawn } = await import("node:child_process");
      const wtPath = resolve(process.cwd(), "src/index.ts");
      
      // Create a file in the worktree to verify we're in the right directory
      const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
        const child = spawn("bun", ["run", wtPath, "run", "dir-test", "--", "bash", "-c", "touch test-file && ls"], {
          cwd: repoDir,
          stdio: ["ignore", "pipe", "pipe"]
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        child.on("close", (code) => {
          resolve({ code: code ?? -1, stdout, stderr });
        });
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toContain("test-file");
    });

    test("should have access to git repository", async () => {
      const { spawn } = await import("node:child_process");
      const wtPath = resolve(process.cwd(), "src/index.ts");
      
      // Verify git commands work in the worktree
      const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
        const child = spawn("bun", ["run", wtPath, "run", "git-test", "git", "status"], {
          cwd: repoDir,
          stdio: ["ignore", "pipe", "pipe"]
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        child.on("close", (code) => {
          resolve({ code: code ?? -1, stdout, stderr });
        });
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toContain("On branch");
    });
  });

  describe("Environment inheritance", () => {
    test("should inherit environment variables", async () => {
      const { spawn } = await import("node:child_process");
      const wtPath = resolve(process.cwd(), "src/index.ts");
      
      // Test that environment variables are preserved
      const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
        const child = spawn("bun", ["run", wtPath, "run", "env-test", "env"], {
          cwd: repoDir,
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env, TEST_VAR: "test-value-12345" }
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        child.on("close", (code) => {
          resolve({ code: code ?? -1, stdout, stderr });
        });
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toContain("TEST_VAR=test-value-12345");
    });
  });

  describe("Command help and usage", () => {
    test("should show run command in help", async () => {
      const { spawn } = await import("node:child_process");
      const wtPath = resolve(process.cwd(), "src/index.ts");
      
      const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
        const child = spawn("bun", ["run", wtPath, "--help"], {
          cwd: repoDir,
          stdio: ["ignore", "pipe", "pipe"]
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        child.on("close", (code) => {
          resolve({ code: code ?? -1, stdout, stderr });
        });
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toContain("run");
      expect(result.stdout).toContain("Create worktree (if needed) and run command in it");
    });

    test("should show run command specific help", async () => {
      const { spawn } = await import("node:child_process");
      const wtPath = resolve(process.cwd(), "src/index.ts");
      
      const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
        const child = spawn("bun", ["run", wtPath, "run", "--help"], {
          cwd: repoDir,
          stdio: ["ignore", "pipe", "pipe"]
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        child.on("close", (code) => {
          resolve({ code: code ?? -1, stdout, stderr });
        });
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toContain("Create worktree (if needed) and run command in it");
      expect(result.stdout).toContain("branch");
      expect(result.stdout).toContain("command");
    });
  });
});