/**
 * Repository initialization utilities for wt init command
 */

import { resolve, join, basename } from 'path';
import { GitError } from './git.ts';
import { EXIT_CODES } from './cli/types.ts';
import type { RepositoryInfo } from './repository.ts';
import type { ServiceContainer } from './services/types.ts';
import { createServiceContainer } from './services/container.ts';

export class RepositoryInitError extends Error {
  constructor(message: string, public readonly code: number = EXIT_CODES.GENERAL_ERROR) {
    super(message);
    this.name = 'RepositoryInitError';
  }
}

export class NetworkError extends RepositoryInitError {
  constructor(message: string) {
    super(message, EXIT_CODES.NETWORK_ERROR);
    this.name = 'NetworkError';
  }
}

/**
 * Validates and parses a Git repository URL
 * Supports HTTP(S), SSH, and local file URLs
 */
export function validateAndParseGitUrl(url: string): { url: string; name: string } {
  if (!url || typeof url !== 'string') {
    throw new RepositoryInitError('Repository URL is required', EXIT_CODES.INVALID_ARGUMENTS);
  }

  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    throw new RepositoryInitError('Repository URL cannot be empty', EXIT_CODES.INVALID_ARGUMENTS);
  }

  // Extract repository name from URL
  let repoName = '';
  
  try {
    // Handle different URL formats
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      // HTTP(S) URL: https://github.com/user/repo.git
      const urlObj = new URL(trimmedUrl);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      if (pathParts.length === 0) {
        throw new Error('Invalid repository path in URL');
      }
      repoName = pathParts[pathParts.length - 1] || '';
    } else if (trimmedUrl.includes('@') && trimmedUrl.includes(':')) {
      // SSH URL: git@github.com:user/repo.git
      const parts = trimmedUrl.split(':');
      if (parts.length < 2) {
        throw new Error('Invalid SSH URL format');
      }
      const pathPart = parts[parts.length - 1];
      if (!pathPart || pathPart.trim() === '') {
        throw new Error('Invalid SSH URL format');
      }
      repoName = pathPart ? basename(pathPart) : '';
    } else if (trimmedUrl.startsWith('file://') || trimmedUrl.startsWith('/') || trimmedUrl.startsWith('./') || trimmedUrl.startsWith('../')) {
      // Local file path
      repoName = basename(trimmedUrl);
    } else {
      // Assume it's a repository name or path
      repoName = basename(trimmedUrl);
    }

    // Remove .git suffix if present
    if (repoName.endsWith('.git')) {
      repoName = repoName.slice(0, -4);
    }

    if (!repoName) {
      throw new Error('Could not extract repository name');
    }

    // Validate repository name
    if (repoName.includes('/') || repoName.includes('\\') || repoName.includes('@')) {
      throw new Error('Invalid repository name extracted from URL');
    }

    return { url: trimmedUrl, name: repoName };
  } catch (error) {
    throw new RepositoryInitError(
      `Invalid repository URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      EXIT_CODES.INVALID_ARGUMENTS
    );
  }
}

/**
 * Initializes a new repository with bare setup for worktrees
 */
export async function initializeRepository(gitUrl: string, targetName?: string): Promise<RepositoryInfo> {
  const defaultServices = createServiceContainer();
  const initOps = new InitOperations(defaultServices);
  return initOps.initializeRepository(gitUrl, targetName);
}

/**
 * Service-based initialization operations class for dependency injection
 */
export class InitOperations {
  constructor(private services: ServiceContainer) {}

  async initializeRepository(gitUrl: string, targetName?: string): Promise<RepositoryInfo> {
    const { url, name: defaultName } = validateAndParseGitUrl(gitUrl);
    
    // Handle targetName validation explicitly
    let repoName: string;
    if (targetName !== undefined) {
      const trimmedTarget = targetName.trim();
      if (trimmedTarget === '') {
        throw new RepositoryInitError('Repository name cannot be empty', EXIT_CODES.INVALID_ARGUMENTS);
      }
      
      // Validate targetName characters 
      if (trimmedTarget.includes('/') || trimmedTarget.includes('\\') || trimmedTarget.includes('@')) {
        throw new RepositoryInitError('Invalid repository name: contains invalid characters', EXIT_CODES.INVALID_ARGUMENTS);
      }
      
      repoName = trimmedTarget;
    } else {
      repoName = defaultName;
    }
    
    // Validate final name
    if (!repoName) {
      throw new RepositoryInitError('Repository name cannot be empty', EXIT_CODES.INVALID_ARGUMENTS);
    }

    const targetDir = resolve(process.cwd(), repoName);
    const bareDir = join(targetDir, '.bare');
    const gitFile = join(targetDir, '.git');

    try {
      // Create target directory
      await this.services.fs.mkdir(targetDir, { recursive: true });
      
      // Clone as bare repository
      this.services.logger.log(`Cloning ${url} as bare repository...`);
      await this.cloneBareRepository(url, bareDir);
      
      // Create .git file pointing to bare repository
      this.services.logger.log('Setting up .git file...');
      await this.createGitFile(gitFile, './.bare');
      
      // Configure remote for worktrees
      this.services.logger.log('Configuring remote for worktrees...');
      await this.configureRemoteForWorktrees(bareDir);
      
      // Perform initial fetch
      this.services.logger.log('Fetching all remote branches...');
      await this.fetchAllRemoteBranches(bareDir);
      
      this.services.logger.log(`Repository initialized successfully in ${targetDir}`);
      
      return {
        rootDir: targetDir,
        gitDir: bareDir,
        type: 'bare',
        bareDir: bareDir
      };
      
    } catch (error) {
      if (error instanceof GitError) {
        // Check if it's a network-related error
        if (isNetworkError(error)) {
          throw new NetworkError(`Network error while cloning repository: ${error.message}`);
        }
        throw new RepositoryInitError(`Git error: ${error.message}`);
      }
      
      if (error instanceof RepositoryInitError) {
        throw error;
      }
      
      throw new RepositoryInitError(`Failed to initialize repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async cloneBareRepository(url: string, bareDir: string): Promise<void> {
    try {
      await this.services.git.executeCommandInDir(process.cwd(), ['clone', '--bare', url, bareDir]);
    } catch (error) {
      if (error instanceof GitError) {
        throw error;
      }
      throw new GitError(`Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`, '', -1);
    }
  }

  private async createGitFile(gitFilePath: string, bareRelativePath: string): Promise<void> {
    const content = `gitdir: ${bareRelativePath}\n`;
    try {
      await this.services.fs.writeFile(gitFilePath, content, 'utf8');
    } catch (error) {
      throw new RepositoryInitError(
        `Failed to create .git file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        EXIT_CODES.FILESYSTEM_ERROR
      );
    }
  }

  private async configureRemoteForWorktrees(bareDir: string): Promise<void> {
    try {
      // Set the remote fetch refspec to fetch all branches
      await this.services.git.executeCommandInDir(bareDir, ['config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*']);
    } catch (error) {
      if (error instanceof GitError) {
        throw error;
      }
      throw new GitError(`Failed to configure remote: ${error instanceof Error ? error.message : 'Unknown error'}`, '', -1);
    }
  }

  private async fetchAllRemoteBranches(bareDir: string): Promise<void> {
    try {
      await this.services.git.executeCommandInDir(bareDir, ['fetch', 'origin']);
    } catch (error) {
      if (error instanceof GitError) {
        throw error;
      }
      throw new GitError(`Failed to fetch branches: ${error instanceof Error ? error.message : 'Unknown error'}`, '', -1);
    }
  }
}

/**
 * Checks if a GitError is network-related
 */
function isNetworkError(error: GitError): boolean {
  const networkErrorPatterns = [
    'could not resolve host',
    'connection refused',
    'network is unreachable',
    'timeout',
    'connection timed out',
    'no route to host',
    'temporary failure in name resolution',
    'could not connect to',
    'failed to connect',
    'repository not found'
  ];
  
  const errorMessage = error.message.toLowerCase();
  const stderrMessage = error.stderr.toLowerCase();
  
  return networkErrorPatterns.some(pattern => 
    errorMessage.includes(pattern) || stderrMessage.includes(pattern)
  );
}