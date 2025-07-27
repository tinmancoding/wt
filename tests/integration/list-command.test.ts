import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { createTestEnvironment, initializeGitRepo, createTestServices, type TestEnvironment } from './test-utils.ts';

describe("List Command Integration", () => {
  let testEnv: TestEnvironment;

  beforeEach(async () => {
    testEnv = await createTestEnvironment();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  test("should list worktrees in real git repository", async () => {
    await initializeGitRepo(testEnv.repoDir);
    
    // Change to repo directory
    const originalCwd = process.cwd();
    process.chdir(testEnv.repoDir);
    
    try {
      const { testLogger, commands } = createTestServices();
      
      // Find list command
      const listCommand = commands.find(cmd => cmd.name === 'list');
      expect(listCommand).toBeDefined();
      
      if (listCommand) {
        await listCommand.handler({
          args: {},
          flags: {},
          positional: []
        });
        
        // Should have logged worktree information
        const output = testLogger.logs.join('\n');
        expect(output).toContain('Name');
        expect(output).toContain('Branch');
        expect(output).toContain('Path');
      }
      
    } finally {
      // Restore working directory
      process.chdir(originalCwd);
    }
  });

  test("should handle repository not found error", async () => {
    // Change to temp directory (not a git repo)
    const originalCwd = process.cwd();
    process.chdir(testEnv.tempDir);
    
    try {
      const { testLogger, commands } = createTestServices();
      
      // Find list command
      const listCommand = commands.find(cmd => cmd.name === 'list');
      expect(listCommand).toBeDefined();
      
      if (listCommand) {
        // Mock process.exit to prevent test termination
        const originalExit = process.exit;
        let exitCode: number | undefined;
        process.exit = ((code?: number) => {
          exitCode = code;
          throw new Error(`Process exit called with code ${code}`);
        }) as any;
        
        try {
          await listCommand.handler({
            args: {},
            flags: {},
            positional: []
          });
        } catch (error) {
          // Expected to fail with process.exit
        } finally {
          process.exit = originalExit;
        }
        
        // Should have logged error message and attempted to exit
        const output = testLogger.logs.join('\n');
        expect(output).toContain('Error listing worktrees');
        expect(exitCode).toBeDefined();
      }
      
    } finally {
      // Restore working directory
      process.chdir(originalCwd);
    }
  });
});