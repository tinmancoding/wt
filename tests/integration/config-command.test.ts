import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { createTestEnvironment, initializeGitRepo, createTestServices, type TestEnvironment } from './test-utils.ts';

describe("Config Command Integration", () => {
  let testEnv: TestEnvironment;

  beforeEach(async () => {
    testEnv = await createTestEnvironment();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  test("should show all config with real services", async () => {
    await initializeGitRepo(testEnv.repoDir);
    
    // Change to repo directory
    const originalCwd = process.cwd();
    process.chdir(testEnv.repoDir);
    
    try {
      const { testLogger, commands } = createTestServices();
      
      // Find config command
      const configCommand = commands.find(cmd => cmd.name === 'config');
      expect(configCommand).toBeDefined();
      
      if (configCommand) {
        await configCommand.handler({
          args: {},
          flags: {},
          positional: []
        });
        
        // Should have logged config information
        const output = testLogger.logs.join('\n');
        expect(output).toContain('worktreeDir');
        expect(output).toContain('autoFetch');
      }
      
    } finally {
      // Restore working directory
      process.chdir(originalCwd);
    }
  });

  test("should set and get config values with real services", async () => {
    await initializeGitRepo(testEnv.repoDir);
    
    // Change to repo directory
    const originalCwd = process.cwd();
    process.chdir(testEnv.repoDir);
    
    try {
      const { testLogger, commands } = createTestServices();
      
      // Find config command
      const configCommand = commands.find(cmd => cmd.name === 'config');
      expect(configCommand).toBeDefined();
      
      if (configCommand) {
        // Set autoFetch to false
        await configCommand.handler({
          args: {},
          flags: {},
          positional: ['autoFetch', 'false']
        });
        
        // Should have logged the set operation
        let output = testLogger.logs.join('\n');
        expect(output).toContain('Set autoFetch = false');
        
        // Clear logs
        testLogger.logs = [];
        
        // Get autoFetch value
        await configCommand.handler({
          args: {},
          flags: {},
          positional: ['autoFetch']
        });
        
        // Should have logged the value
        output = testLogger.logs.join('\n');
        expect(output).toContain('false');
      }
      
    } finally {
      // Restore working directory
      process.chdir(originalCwd);
    }
  });
});