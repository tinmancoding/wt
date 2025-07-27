/**
 * Default Node.js git service implementation using spawn
 */

import { spawn } from 'node:child_process';
import type { GitService, GitCommandResult } from '../types.ts';
import { GitError } from '../../git.ts';

export class NodeGitService implements GitService {
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

  async executeCommandInDir(workDir: string, args: string[]): Promise<string> {
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

  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.executeCommandWithResult('.', ['--version']);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string> {
    try {
      const result = await this.executeCommandWithResult('.', ['--version']);
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
}