import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { createTestEnvironment, initializeGitRepo, createTestServices, type TestEnvironment } from './test-utils.ts';

describe("Create Command Integration", () => {
  let testEnv: TestEnvironment;

  beforeEach(async () => {
    testEnv = await createTestEnvironment();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  test("should create worktree for new branch with real services", async () => {
    await initializeGitRepo(testEnv.repoDir);
    
    // Change to repo directory
    const originalCwd = process.cwd();
    process.chdir(testEnv.repoDir);
    
    try {
      const { testLogger, commands } = createTestServices();
      
      // Find create command
      const createCommand = commands.find(cmd => cmd.name === 'create');
      expect(createCommand).toBeDefined();
      
      if (createCommand) {
        await createCommand.handler({
          args: {},
          flags: {},
          positional: ['feature-test']
        });
        
        // Should have logged creation messages
        const output = testLogger.logs.join('\n');
        expect(output).toContain('feature-test');
      }
      
    } finally {
      // Restore working directory
      process.chdir(originalCwd);
    }
  });

  test("should handle missing branch argument", async () => {
    await initializeGitRepo(testEnv.repoDir);
    
    // Change to repo directory
    const originalCwd = process.cwd();
    process.chdir(testEnv.repoDir);
    
    try {
      const { testLogger, commands } = createTestServices();
      
      // Find create command
      const createCommand = commands.find(cmd => cmd.name === 'create');
      expect(createCommand).toBeDefined();
      
      if (createCommand) {
        // Mock process.exit to prevent test termination
        const originalExit = process.exit;
        let exitCode: number | undefined;
        process.exit = ((code?: number) => {
          exitCode = code;
          throw new Error(`Process exit called with code ${code}`);
        }) as any;
        
        try {
          await createCommand.handler({
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
        expect(output).toContain('Branch name is required');
        expect(exitCode).toBeDefined();
      }
      
    } finally {
      // Restore working directory
      process.chdir(originalCwd);
    }
  });
});