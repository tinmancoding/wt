/**
 * Service interface definitions for dependency injection
 */

import type { Stats } from 'node:fs';
import type { GitCommandResult, CommandResult } from '../git.ts';

// Re-export types that services need
export type { GitCommandResult, CommandResult } from '../git.ts';

export interface LoggerService {
  log(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

export interface GitService {
  executeCommand(gitDir: string, args: string[]): Promise<string>;
  executeCommandWithResult(gitDir: string, args: string[]): Promise<GitCommandResult>;
  executeCommandInDir(workDir: string, args: string[]): Promise<string>;
  isAvailable(): Promise<boolean>;
  getVersion(): Promise<string>;
}

export interface FileSystemService {
  readFile(path: string, encoding?: BufferEncoding): Promise<string>;
  writeFile(path: string, data: string, encoding?: BufferEncoding): Promise<void>;
  access(path: string, mode?: number): Promise<void>;
  stat(path: string): Promise<Stats>;
  mkdir(path: string, options?: any): Promise<void>;
  exists(path: string): Promise<boolean>;
  isDirectory(path: string): Promise<boolean>;
  isFile(path: string): Promise<boolean>;
  chdir(path: string): void;
}

export interface CommandService {
  execute(command: string, args: string[], workDir: string, inheritStdio?: boolean): Promise<CommandResult>;
}

export interface ServiceContainer {
  logger: LoggerService;
  git: GitService;
  fs: FileSystemService;
  cmd: CommandService;
}