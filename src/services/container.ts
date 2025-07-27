/**
 * Service container factory for dependency injection
 */

import type { ServiceContainer, LoggerService, GitService, FileSystemService, CommandService } from './types.ts';
import { NodeLoggerService } from './implementations/NodeLoggerService.ts';
import { NodeGitService } from './implementations/NodeGitService.ts';
import { NodeFileSystemService } from './implementations/NodeFileSystemService.ts';
import { NodeCommandService } from './implementations/NodeCommandService.ts';

export interface ServiceContainerOptions {
  logger?: LoggerService;
  git?: GitService;
  fs?: FileSystemService;
  cmd?: CommandService;
}

export function createServiceContainer(options: ServiceContainerOptions = {}): ServiceContainer {
  return {
    logger: options.logger ?? new NodeLoggerService(),
    git: options.git ?? new NodeGitService(),
    fs: options.fs ?? new NodeFileSystemService(),
    cmd: options.cmd ?? new NodeCommandService()
  };
}

export async function createTestServiceContainer(options: ServiceContainerOptions = {}): Promise<ServiceContainer> {
  // Import test implementations
  const { MockLoggerService } = await import('./test-implementations/MockLoggerService.ts');
  const { MockGitService } = await import('./test-implementations/MockGitService.ts');
  const { MockFileSystemService } = await import('./test-implementations/MockFileSystemService.ts');
  const { MockCommandService } = await import('./test-implementations/MockCommandService.ts');

  return {
    logger: options.logger ?? new MockLoggerService(),
    git: options.git ?? new MockGitService(),
    fs: options.fs ?? new MockFileSystemService(),
    cmd: options.cmd ?? new MockCommandService()
  };
}