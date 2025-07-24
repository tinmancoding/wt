import { resolve, relative, basename } from 'path';
import { executeGitCommand } from './git.ts';
import type { RepositoryInfo } from './repository.ts';

export interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  isCurrent: boolean;
  isBare: boolean;
  isDetached: boolean;
  isLocked: boolean;
  relativePath: string;
}

/**
 * Lists all worktrees in the repository
 */
export async function listWorktrees(repoInfo: RepositoryInfo): Promise<WorktreeInfo[]> {
  try {
    const output = await executeGitCommand(repoInfo.gitDir, ['worktree', 'list', '--porcelain']);
    
    if (!output.trim()) {
      return [];
    }

    return parseWorktreeList(output, repoInfo);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not a git repository')) {
      return [];
    }
    throw error;
  }
}

/**
 * Parses the output of 'git worktree list --porcelain'
 */
function parseWorktreeList(output: string, repoInfo: RepositoryInfo): WorktreeInfo[] {
  const worktrees: WorktreeInfo[] = [];
  const lines = output.split('\n');
  
  let currentWorktree: Partial<WorktreeInfo> = {};
  
  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      // If we have a previous worktree, finalize it
      if (currentWorktree.path) {
        worktrees.push(finalizeWorktree(currentWorktree, repoInfo));
      }
      
      // Start new worktree
      const path = line.substring(9); // Remove 'worktree ' prefix
      currentWorktree = {
        path: resolve(path),
        isCurrent: false,
        isBare: false,
        isDetached: false,
        isLocked: false
      };
    } else if (line.startsWith('HEAD ')) {
      currentWorktree.commit = line.substring(5);
    } else if (line.startsWith('branch ')) {
      const branchRef = line.substring(7);
      // Remove refs/heads/ prefix if present
      currentWorktree.branch = branchRef.startsWith('refs/heads/') 
        ? branchRef.substring(11) 
        : branchRef;
      currentWorktree.isDetached = false;
    } else if (line === 'detached') {
      currentWorktree.isDetached = true;
      currentWorktree.branch = 'HEAD'; // Default for detached state
    } else if (line === 'bare') {
      currentWorktree.isBare = true;
    } else if (line.startsWith('locked')) {
      currentWorktree.isLocked = true;
    }
  }
  
  // Don't forget the last worktree
  if (currentWorktree.path) {
    worktrees.push(finalizeWorktree(currentWorktree, repoInfo));
  }
  
  return worktrees;
}

/**
 * Finalizes a worktree object and determines if it's current
 */
function finalizeWorktree(worktree: Partial<WorktreeInfo>, repoInfo: RepositoryInfo): WorktreeInfo {
  const path = worktree.path!;
  const relativePath = relative(repoInfo.rootDir, path) || '.';
  
  // Determine if this is the current worktree by comparing with the repository root
  const isCurrent = resolve(path) === resolve(repoInfo.rootDir);
  
  return {
    path,
    branch: worktree.branch || 'unknown',
    commit: worktree.commit || '',
    isCurrent,
    isBare: worktree.isBare || false,
    isDetached: worktree.isDetached || false,
    isLocked: worktree.isLocked || false,
    relativePath
  };
}

/**
 * Formats worktree information for display
 */
export function formatWorktree(worktree: WorktreeInfo): string {
  const indicator = worktree.isCurrent ? '*' : ' ';
  const name = basename(worktree.path);
  const branch = worktree.isDetached ? `(${worktree.commit.substring(0, 7)})` : worktree.branch;
  const status = getWorktreeStatus(worktree);
  
  return `${indicator} ${name.padEnd(20)} ${branch.padEnd(25)} ${worktree.relativePath}${status}`;
}

/**
 * Gets status indicators for a worktree
 */
function getWorktreeStatus(worktree: WorktreeInfo): string {
  const statusParts: string[] = [];
  
  if (worktree.isBare) {
    statusParts.push('[bare]');
  }
  if (worktree.isLocked) {
    statusParts.push('[locked]');
  }
  if (worktree.isDetached) {
    statusParts.push('[detached]');
  }
  
  return statusParts.length > 0 ? ` ${statusParts.join(' ')}` : '';
}

/**
 * Formats the header for worktree listing
 */
export function formatWorktreeHeader(): string {
  return `  ${'Name'.padEnd(20)} ${'Branch'.padEnd(25)} Path`;
}