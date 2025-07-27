/**
 * Mock git service for testing with configurable responses
 */

import type { GitService, GitCommandResult } from '../types.ts';
import { GitError } from '../../git.ts';

export class MockGitService implements GitService {
  private commandResponses = new Map<string, GitCommandResult>();
  private executedCommands: Array<{gitDir: string, args: string[]}> = [];
  private executedInDirCommands: Array<{workDir: string, args: string[]}> = [];
  private gitAvailable = true;
  private gitVersion = 'git version 2.34.1';

  // Configuration methods for tests
  setCommandResponse(args: string[], response: GitCommandResult | string): void {
    const key = args.join(' ');
    if (typeof response === 'string') {
      this.commandResponses.set(key, {
        stdout: response,
        stderr: '',
        exitCode: 0
      });
    } else {
      this.commandResponses.set(key, response);
    }
  }

  setGitAvailable(available: boolean): void {
    this.gitAvailable = available;
  }

  setGitVersion(version: string): void {
    this.gitVersion = version;
  }

  getExecutedCommands(): Array<{gitDir: string, args: string[]}> {
    return [...this.executedCommands];
  }

  getExecutedInDirCommands(): Array<{workDir: string, args: string[]}> {
    return [...this.executedInDirCommands];
  }

  clear(): void {
    this.commandResponses.clear();
    this.executedCommands = [];
    this.executedInDirCommands = [];
  }

  // GitService implementation
  async executeCommand(gitDir: string, args: string[]): Promise<string> {
    const result = await this.executeCommandWithResult(gitDir, args);
    
    if (result.exitCode !== 0) {
      throw new GitError(
        `Git command failed: ${result.stderr.trim() || 'Unknown error'}`,
        result.stderr,
        result.exitCode
      );
    }
    
    return result.stdout.trim();
  }

  async executeCommandWithResult(gitDir: string, args: string[]): Promise<GitCommandResult> {
    this.executedCommands.push({gitDir, args});
    
    const key = args.join(' ');
    const response = this.commandResponses.get(key);
    
    if (response) {
      return response;
    }
    
    // Default responses for common commands
    if (args.includes('--version')) {
      return {
        stdout: this.gitVersion,
        stderr: '',
        exitCode: this.gitAvailable ? 0 : 1
      };
    }
    
    // Default success response
    return {
      stdout: '',
      stderr: '',
      exitCode: 0
    };
  }

  async executeCommandInDir(workDir: string, args: string[]): Promise<string> {
    this.executedInDirCommands.push({workDir, args});
    
    const key = args.join(' ');
    const response = this.commandResponses.get(key);
    
    if (response) {
      if (response.exitCode !== 0) {
        throw new GitError(
          `Git command failed: ${response.stderr.trim() || 'Unknown error'}`,
          response.stderr,
          response.exitCode
        );
      }
      return response.stdout.trim();
    }
    
    // Default responses for common commands
    if (args.includes('--version')) {
      if (!this.gitAvailable) {
        throw new GitError('Git is not available', 'command not found', 1);
      }
      return this.gitVersion;
    }
    
    // Default success response
    return '';
  }

  async isAvailable(): Promise<boolean> {
    return this.gitAvailable;
  }

  async getVersion(): Promise<string> {
    if (!this.gitAvailable) {
      throw new GitError('Git is not available', 'command not found', 1);
    }
    return this.gitVersion;
  }
}