/**
 * Repository detection and management utilities
 */

import { resolve, dirname, join } from 'node:path';
import { access, readFile, stat, constants } from 'node:fs/promises';
import { EXIT_CODES } from './cli/types.ts';

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
  const currentDir = startPath ? resolve(startPath) : resolve(process.cwd());
  
  return await walkUpDirectoryTree(currentDir);
}

/**
 * Walks up the directory tree to find a Git repository
 */
async function walkUpDirectoryTree(currentPath: string): Promise<RepositoryInfo> {
  // Prevent infinite loop by checking if we've reached the filesystem root
  const parentPath = dirname(currentPath);
  if (parentPath === currentPath) {
    throw new RepositoryError(
      'No Git repository found. Initialize a repository with "git init" or "wt init <git-url>".',
      EXIT_CODES.GIT_REPO_NOT_FOUND
    );
  }

  // Check for .bare/ directory first (preferred setup)
  const bareDir = join(currentPath, '.bare');
  if (await pathExists(bareDir) && await isDirectory(bareDir)) {
    return {
      rootDir: currentPath,
      gitDir: bareDir,
      type: 'bare',
      bareDir: bareDir
    };
  }

  // Check for .git file that points to .bare directory
  const gitFile = join(currentPath, '.git');
  if (await pathExists(gitFile) && await isFile(gitFile)) {
    const gitFileContent = await readFile(gitFile, 'utf-8');
    const gitdirMatch = gitFileContent.trim().match(/^gitdir:\s*(.+)$/);
    
    if (gitdirMatch && gitdirMatch[1]) {
      const gitdirPath = resolve(currentPath, gitdirMatch[1]);
      
      // Check if it points to a .bare directory
      if (gitdirPath.endsWith('.bare') || gitdirPath.endsWith('/.bare')) {
        return {
          rootDir: currentPath,
          gitDir: gitdirPath,
          type: 'gitfile',
          bareDir: gitdirPath
        };
      }
      
      // Standard gitdir reference
      return {
        rootDir: currentPath,
        gitDir: gitdirPath,
        type: 'gitfile'
      };
    }
  }

  // Check for standard .git directory (fallback)
  if (await pathExists(gitFile) && await isDirectory(gitFile)) {
    return {
      rootDir: currentPath,
      gitDir: gitFile,
      type: 'standard'
    };
  }

  // Continue walking up the directory tree
  return await walkUpDirectoryTree(parentPath);
}

/**
 * Checks if a path exists
 */
async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a path is a directory
 */
async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Checks if a path is a file
 */
async function isFile(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * Validates that a detected repository is in a usable state
 */
export async function validateRepository(repoInfo: RepositoryInfo): Promise<void> {
  // Ensure git directory exists and is accessible
  if (!await pathExists(repoInfo.gitDir)) {
    throw new RepositoryError(
      `Git directory not found: ${repoInfo.gitDir}`,
      EXIT_CODES.FILESYSTEM_ERROR
    );
  }

  // Additional validation for bare repositories
  if (repoInfo.type === 'bare' && repoInfo.bareDir) {
    const configFile = join(repoInfo.bareDir, 'config');
    if (!await pathExists(configFile)) {
      throw new RepositoryError(
        `Invalid bare repository: missing config file at ${configFile}`,
        EXIT_CODES.FILESYSTEM_ERROR
      );
    }
  }
}