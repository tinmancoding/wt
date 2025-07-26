/**
 * Git command utilities and helpers
 */

import { EXIT_CODES } from './cli/types.ts';
import type { GitService, LoggerService } from './services/types.ts';
import { NodeGitService } from './services/implementations/NodeGitService.ts';
import { NodeCommandService } from './services/implementations/NodeCommandService.ts';

export interface GitCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class GitError extends Error {
  constructor(
    message: string,
    public readonly stderr: string,
    public readonly exitCode: number,
    public readonly code: number = EXIT_CODES.GENERAL_ERROR
  ) {
    super(message);
    this.name = 'GitError';
  }
}

/**
 * Executes a git command and returns the output
 * @param gitDir The git directory to use (can be .git or .bare)
 * @param args Array of arguments to pass to git
 * @returns Promise that resolves to the trimmed stdout
 * @throws GitError if the command fails
 */
export async function executeGitCommand(gitDir: string, args: string[]): Promise<string> {
  const defaultGit = new NodeGitService();
  return defaultGit.executeCommand(gitDir, args);
}

/**
 * Executes a git command and returns the full result including exit code
 * @param gitDir The git directory to use (can be .git or .bare)
 * @param args Array of arguments to pass to git
 * @returns Promise that resolves to GitCommandResult
 */
export async function executeGitCommandWithResult(gitDir: string, args: string[]): Promise<GitCommandResult> {
  const defaultGit = new NodeGitService();
  return defaultGit.executeCommandWithResult(gitDir, args);
}

/**
 * Executes a git command in a specific working directory
 * @param workDir The working directory to execute git in
 * @param args Array of arguments to pass to git
 * @returns Promise that resolves to the trimmed stdout
 * @throws GitError if the command fails
 */
export async function executeGitCommandInDir(workDir: string, args: string[]): Promise<string> {
  const defaultGit = new NodeGitService();
  return defaultGit.executeCommandInDir(workDir, args);
}

/**
 * Checks if git is available in the system
 * @returns Promise that resolves to true if git is available
 */
export async function isGitAvailable(): Promise<boolean> {
  const defaultGit = new NodeGitService();
  return defaultGit.isAvailable();
}

/**
 * Gets the git version
 * @returns Promise that resolves to the git version string
 * @throws GitError if git is not available
 */
export async function getGitVersion(): Promise<string> {
  const defaultGit = new NodeGitService();
  return defaultGit.getVersion();
}

/**
 * Service-based git operations class for dependency injection
 */
export class GitOperations {
  constructor(
    private git: GitService,
    private logger: LoggerService
  ) {}

  async executeCommand(gitDir: string, args: string[]): Promise<string> {
    try {
      return await this.git.executeCommand(gitDir, args);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Git command failed: ${message}`);
      throw error;
    }
  }

  async executeCommandWithResult(gitDir: string, args: string[]): Promise<GitCommandResult> {
    try {
      return await this.git.executeCommandWithResult(gitDir, args);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Git command failed: ${message}`);
      throw error;
    }
  }

  async executeCommandInDir(workDir: string, args: string[]): Promise<string> {
    try {
      return await this.git.executeCommandInDir(workDir, args);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Git command failed: ${message}`);
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      return await this.git.isAvailable();
    } catch (error) {
      this.logger.debug(`Git availability check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  async getVersion(): Promise<string> {
    try {
      return await this.git.getVersion();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Git version check failed: ${message}`);
      throw error;
    }
  }
}

/**
 * Result of executing a shell command
 */
export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Executes a shell command in a specific working directory with proper signal handling
 * @param command The command to execute
 * @param args Array of arguments to pass to the command
 * @param workDir The working directory to execute command in
 * @param inheritStdio Whether to inherit stdio (for interactive commands)
 * @returns Promise that resolves to CommandResult
 */
export async function executeCommand(
  command: string,
  args: string[],
  workDir: string,
  inheritStdio = false
): Promise<CommandResult> {
  const defaultCmd = new NodeCommandService();
  return defaultCmd.execute(command, args, workDir, inheritStdio);
}