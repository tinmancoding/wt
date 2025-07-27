import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn } from 'node:child_process';
import { createServiceContainer } from '../../src/services/container.ts';
import { createCommands } from '../../src/commands/index.ts';
import type { LoggerService } from '../../src/services/types.ts';

export class TestLoggerService implements LoggerService {
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

export interface TestEnvironment {
  tempDir: string;
  repoDir: string;
  cleanup: () => Promise<void>;
}

export async function createTestEnvironment(): Promise<TestEnvironment> {
  const tempDir = join(tmpdir(), `wt-cmd-test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`);
  const repoDir = join(tempDir, 'repo');
  await mkdir(repoDir, { recursive: true });

  const cleanup = async () => {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  };

  return { tempDir, repoDir, cleanup };
}

export async function initializeGitRepo(repoDir: string): Promise<void> {
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
      else reject(new Error(`git config user.email failed with code ${code}`));
    });
  });

  await new Promise<void>((resolve, reject) => {
    const child = spawn('git', ['config', 'user.name', 'Test User'], {
      cwd: repoDir,
      stdio: 'ignore'
    });
    
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`git config user.name failed with code ${code}`));
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
}

export function createTestServices() {
  const testLogger = new TestLoggerService();
  const testServices = createServiceContainer({ logger: testLogger });
  const commands = createCommands(testServices);
  
  return { testLogger, testServices, commands };
}