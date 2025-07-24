/**
 * Git command utilities and helpers
 */

import { spawn } from 'node:child_process';
import { EXIT_CODES } from './cli/types.ts';

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
  const result = await executeGitCommandWithResult(gitDir, args);
  
  if (result.exitCode !== 0) {
    throw new GitError(
      `Git command failed: ${result.stderr.trim() || 'Unknown error'}`,
      result.stderr,
      result.exitCode
    );
  }
  
  return result.stdout.trim();
}

/**
 * Executes a git command and returns the full result including exit code
 * @param gitDir The git directory to use (can be .git or .bare)
 * @param args Array of arguments to pass to git
 * @returns Promise that resolves to GitCommandResult
 */
export async function executeGitCommandWithResult(gitDir: string, args: string[]): Promise<GitCommandResult> {
  return new Promise((resolve) => {
    const childProcess = spawn('git', ['--git-dir', gitDir, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env } // Explicitly pass environment
    });

    let stdout = '';
    let stderr = '';

    childProcess.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    childProcess.on('close', (code: number | null) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? -1
      });
    });

    childProcess.on('error', (error: Error) => {
      resolve({
        stdout,
        stderr: `Process error: ${error.message}`,
        exitCode: -1
      });
    });
  });
}

/**
 * Executes a git command in a specific working directory
 * @param workDir The working directory to execute git in
 * @param args Array of arguments to pass to git
 * @returns Promise that resolves to the trimmed stdout
 * @throws GitError if the command fails
 */
export async function executeGitCommandInDir(workDir: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const childProcess = spawn('git', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: workDir,
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    childProcess.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    childProcess.on('close', (code: number | null) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new GitError(
          `Git command failed: ${stderr.trim() || 'Unknown error'}`,
          stderr,
          code ?? -1
        ));
      }
    });

    childProcess.on('error', (error: Error) => {
      reject(new GitError(
        `Process error: ${error.message}`,
        error.message,
        -1
      ));
    });
  });
}

/**
 * Checks if git is available in the system
 * @returns Promise that resolves to true if git is available
 */
export async function isGitAvailable(): Promise<boolean> {
  try {
    const result = await executeGitCommandWithResult('.', ['--version']);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Gets the git version
 * @returns Promise that resolves to the git version string
 * @throws GitError if git is not available
 */
export async function getGitVersion(): Promise<string> {
  try {
    const result = await executeGitCommandWithResult('.', ['--version']);
    if (result.exitCode !== 0) {
      throw new GitError('Git is not available', result.stderr, result.exitCode);
    }
    return result.stdout.trim();
  } catch (error) {
    if (error instanceof GitError) {
      throw error;
    }
    throw new GitError('Failed to get git version', String(error), -1);
  }
}