import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { createServiceContainer } from '../../src/services/container.ts';
import { createCommands } from '../../src/commands/index.ts';
import { CLI } from '../../src/cli/cli.ts';
import type { ServiceContainer } from '../../src/services/types.ts';
import type { CLIConfig } from '../../src/cli/types.ts';

describe("CLI Integration Tests", () => {
  let tempDir: string;
  let repoDir: string;
  let services: ServiceContainer;
  let cli: CLI;
  let cliConfig: CLIConfig;

  beforeEach(async () => {
    // Create temporary directory for each test
    tempDir = join(tmpdir(), `wt-cli-test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`);
    repoDir = join(tempDir, 'repo');
    await mkdir(repoDir, { recursive: true });

    // Create CLI config
    cliConfig = {
      name: 'wt',
      version: '1.0.0-test',
      description: 'Git Worktree Manager - Test Version'
    };

    // Create service container with real implementations
    services = createServiceContainer();
    
    // Create CLI instance with real services
    cli = new CLI(cliConfig, services.logger);
    
    // Register commands with real services
    const commands = createCommands(services);
    for (const command of commands) {
      cli.command(command);
    }
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("CLI Command Processing", () => {
    test("should process help command with real service container", async () => {
      // Test help command processing
      const result = await new Promise<{ output: string; exitCode: number }>((resolve) => {
        // Capture console output
        const originalLog = console.log;
        let output = '';
        console.log = (...args: any[]) => {
          output += args.join(' ') + '\n';
        };

        // Mock process.exit to capture exit code
        const originalExit = process.exit;
        let exitCode = 0;
        process.exit = ((code?: number) => {
          exitCode = code || 0;
        }) as any;

        // Run CLI with help
        cli.run(['--help']).finally(() => {
          // Restore original functions
          console.log = originalLog;
          process.exit = originalExit;
          
          resolve({ output, exitCode });
        });
      });

      expect(result.output).toContain('Commands:');
      expect(result.output).toContain('list');
      expect(result.output).toContain('create');
      expect(result.output).toContain('config');
    });

    test("should handle invalid commands with real service container", async () => {
      const result = await new Promise<{ output: string; exitCode: number }>((resolve) => {
        // Capture console error output
        const originalError = console.error;
        let output = '';
        console.error = (...args: any[]) => {
          output += args.join(' ') + '\n';
        };

        // Mock process.exit to capture exit code
        const originalExit = process.exit;
        let exitCode = 0;
        process.exit = ((code?: number) => {
          const actualCode = code ?? 0;
          if (exitCode === 0) { // Only capture the first exit code
            exitCode = actualCode;
          }
          // Don't actually exit, just capture the code
          throw new Error(`Process exit called with code ${actualCode}`);
        }) as any;

        // Run CLI with invalid command
        cli.run(['invalid-command']).catch(() => {
          // Expected to throw due to mocked process.exit
        }).finally(() => {
          // Restore original functions
          console.error = originalError;
          process.exit = originalExit;
          
          resolve({ output, exitCode });
        });
      });

      expect(result.exitCode).toBe(2); // INVALID_ARGUMENTS
      expect(result.output).toContain('Unknown command');
    });
  });

  describe("CLI Service Integration", () => {
    test("should use logger service for output", async () => {
      // Create a custom mock logger to capture output
      class TestLoggerService {
        public logs: string[] = [];
        
        log(message: string): void {
          this.logs.push(`LOG: ${message}`);
        }
        
        error(message: string): void {
          this.logs.push(`ERROR: ${message}`);
        }
        
        warn(message: string): void {
          this.logs.push(`WARN: ${message}`);
        }
        
        info(message: string): void {
          this.logs.push(`INFO: ${message}`);
        }
        
        debug(message: string): void {
          this.logs.push(`DEBUG: ${message}`);
        }
      }

      const testLogger = new TestLoggerService();
      const testServices = createServiceContainer({ logger: testLogger });
      
      const testCli = new CLI(cliConfig, testServices.logger);
      const testCommands = createCommands(testServices);
      for (const command of testCommands) {
        testCli.command(command);
      }

      // Mock process.exit to prevent actual exit
      const originalExit = process.exit;
      process.exit = (() => {}) as any;

      try {
        await testCli.run(['invalid-command']);
      } catch (error) {
        // Expected to throw or exit
      }

      // Restore process.exit
      process.exit = originalExit;

      // Verify logger was used
      expect(testLogger.logs.some(log => log.includes('ERROR:'))).toBe(true);
    });
  });

  describe("Real Git Repository Integration", () => {
    beforeEach(async () => {
      // Initialize a real git repository for these tests
      const { spawn } = await import('node:child_process');
      
      // Initialize git repository
      await new Promise<void>((resolve, reject) => {
        const child = spawn('git', ['init'], {
          cwd: repoDir,
          stdio: 'ignore'
        });
        
        child.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`git init failed with code ${code}`));
        });
      });
      
      // Configure git
      await new Promise<void>((resolve, reject) => {
        const child = spawn('git', ['config', 'user.email', 'test@example.com'], {
          cwd: repoDir,
          stdio: 'ignore'
        });
        
        child.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`git config failed with code ${code}`));
        });
      });
      
      await new Promise<void>((resolve, reject) => {
        const child = spawn('git', ['config', 'user.name', 'Test User'], {
          cwd: repoDir,
          stdio: 'ignore'
        });
        
        child.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`git config failed with code ${code}`));
        });
      });
      
      // Create initial commit
      await writeFile(join(repoDir, 'README.md'), 'Test repository');
      
      await new Promise<void>((resolve, reject) => {
        const child = spawn('git', ['add', '.'], {
          cwd: repoDir,
          stdio: 'ignore'
        });
        
        child.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`git add failed with code ${code}`));
        });
      });
      
      await new Promise<void>((resolve, reject) => {
        const child = spawn('git', ['commit', '-m', 'Initial commit'], {
          cwd: repoDir,
          stdio: 'ignore'
        });
        
        child.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`git commit failed with code ${code}`));
        });
      });
    });

    test("should execute list command in real git repository", async () => {
      // Change to repo directory and run list command
      const originalCwd = process.cwd();
      process.chdir(repoDir);
      
      // Create test logger to capture output
      class TestLoggerService {
        public logs: string[] = [];
        
        log(message: string): void {
          this.logs.push(message);
        }
        
        error(message: string): void {
          this.logs.push(`ERROR: ${message}`);
        }
        
        warn(message: string): void {
          this.logs.push(`WARN: ${message}`);
        }
        
        info(message: string): void {
          this.logs.push(`INFO: ${message}`);
        }
        
        debug(message: string): void {
          this.logs.push(`DEBUG: ${message}`);
        }
      }

      const testLogger = new TestLoggerService();
      const testServices = createServiceContainer({ logger: testLogger });
      
      const testCli = new CLI(cliConfig, testServices.logger);
      const testCommands = createCommands(testServices);
      for (const command of testCommands) {
        testCli.command(command);
      }

      try {
        await testCli.run(['list']);
        
        // Should have captured worktree list output
        const output = testLogger.logs.join('\n');
        expect(output).toContain('Name');
        expect(output).toContain('Branch');
        expect(output).toContain('Path');
        expect(output).toContain('main'); // Default branch
        
      } finally {
        // Restore working directory
        process.chdir(originalCwd);
      }
    });
  });
});