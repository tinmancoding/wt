/**
 * Repository detection and management utilities
 */

import { resolve, dirname, join } from 'node:path';
import { EXIT_CODES } from './cli/types.ts';
import type { FileSystemService, LoggerService } from './services/types.ts';
import { createServiceContainer } from './services/container.ts';

export interface RepositoryInfo {
  /** Root directory of the repository */
  rootDir: string;
  /** Path to the git directory (.git or .bare) */
  gitDir: string;
  /** Type of repository detected */
  type: 'bare' | 'gitfile' | 'standard';
  /** Path to the .bare directory if applicable */
  bareDir?: string;
}

export class RepositoryError extends Error {
  constructor(message: string, public readonly code: number = EXIT_CODES.GIT_REPO_NOT_FOUND) {
    super(message);
    this.name = 'RepositoryError';
  }
}

/**
 * Detects Git repository by walking up the directory tree
 * 
 * Looks for repositories in this order:
 * 1. .bare/ directory (bare repo setup)
 * 2. .git file with gitdir: ./.bare
 * 3. Standard .git directory (fallback)
 */
export async function detectRepository(startPath?: string): Promise<RepositoryInfo> {
  const defaultServices = createServiceContainer();
  const repoOps = new RepositoryOperations(defaultServices.fs, defaultServices.logger);
  return repoOps.detectRepository(startPath);
}

/**
 * Validates that a detected repository is in a usable state
 */
export async function validateRepository(repoInfo: RepositoryInfo): Promise<void> {
  const defaultServices = createServiceContainer();
  const repoOps = new RepositoryOperations(defaultServices.fs, defaultServices.logger);
  return repoOps.validateRepository(repoInfo);
}

/**
 * Service-based repository operations class for dependency injection
 */
export class RepositoryOperations {
  constructor(
    private fs: FileSystemService,
    private logger: LoggerService
  ) {}

  async detectRepository(startPath?: string): Promise<RepositoryInfo> {
    const currentDir = startPath ? resolve(startPath) : resolve(process.cwd());
    this.logger.debug(`Starting repository detection from: ${currentDir}`);
    
    return await this.walkUpDirectoryTree(currentDir);
  }

  private async walkUpDirectoryTree(currentPath: string): Promise<RepositoryInfo> {
    this.logger.debug(`Checking directory: ${currentPath}`);
    
    // Prevent infinite loop by checking if we've reached the filesystem root
    const parentPath = dirname(currentPath);
    if (parentPath === currentPath) {
      const message = 'No Git repository found. Initialize a repository with "git init" or "wt init <git-url>".';
      this.logger.error(message);
      throw new RepositoryError(message, EXIT_CODES.GIT_REPO_NOT_FOUND);
    }

    // Check for .bare/ directory first (preferred setup)
    const bareDir = join(currentPath, '.bare');
    if (await this.fs.exists(bareDir) && await this.fs.isDirectory(bareDir)) {
      this.logger.debug(`Found bare repository at: ${bareDir}`);
      return {
        rootDir: currentPath,
        gitDir: bareDir,
        type: 'bare',
        bareDir: bareDir
      };
    }

    // Check for .git file that points to .bare directory
    const gitFile = join(currentPath, '.git');
    if (await this.fs.exists(gitFile) && await this.fs.isFile(gitFile)) {
      const gitFileContent = await this.fs.readFile(gitFile, 'utf-8');
      const gitdirMatch = gitFileContent.trim().match(/^gitdir:\s*(.+)$/);
      
      if (gitdirMatch && gitdirMatch[1]) {
        const gitdirPath = resolve(currentPath, gitdirMatch[1]);
        
        // Check if it points to a .bare directory
        if (gitdirPath.endsWith('.bare') || gitdirPath.endsWith('/.bare')) {
          this.logger.debug(`Found gitfile pointing to bare repository: ${gitdirPath}`);
          return {
            rootDir: currentPath,
            gitDir: gitdirPath,
            type: 'gitfile',
            bareDir: gitdirPath
          };
        }
        
        // Standard gitdir reference
        this.logger.debug(`Found gitfile pointing to: ${gitdirPath}`);
        return {
          rootDir: currentPath,
          gitDir: gitdirPath,
          type: 'gitfile'
        };
      }
    }

    // Check for standard .git directory (fallback)
    if (await this.fs.exists(gitFile) && await this.fs.isDirectory(gitFile)) {
      this.logger.debug(`Found standard git repository at: ${gitFile}`);
      return {
        rootDir: currentPath,
        gitDir: gitFile,
        type: 'standard'
      };
    }

    // Continue walking up the directory tree
    return await this.walkUpDirectoryTree(parentPath);
  }

  async validateRepository(repoInfo: RepositoryInfo): Promise<void> {
    this.logger.debug(`Validating repository: ${repoInfo.gitDir}`);
    
    // Ensure git directory exists and is accessible
    if (!await this.fs.exists(repoInfo.gitDir)) {
      const message = `Git directory not found: ${repoInfo.gitDir}`;
      this.logger.error(message);
      throw new RepositoryError(message, EXIT_CODES.FILESYSTEM_ERROR);
    }

    // Additional validation for bare repositories
    if (repoInfo.type === 'bare' && repoInfo.bareDir) {
      const configFile = join(repoInfo.bareDir, 'config');
      if (!await this.fs.exists(configFile)) {
        const message = `Invalid bare repository: missing config file at ${configFile}`;
        this.logger.error(message);
        throw new RepositoryError(message, EXIT_CODES.FILESYSTEM_ERROR);
      }
    }
    
    this.logger.debug(`Repository validation successful`);
  }
}