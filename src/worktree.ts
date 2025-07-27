import { resolve, relative, basename, join } from 'path';
import type { CommandResult } from './git.ts';
import type { RepositoryInfo } from './repository.ts';
import type { WTConfig } from './config.ts';
import type { ServiceContainer } from './services/types.ts';
import { createServiceContainer } from './services/container.ts';

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

export interface BranchResolution {
  type: 'local' | 'remote' | 'new';
  branchName: string;
  remoteName?: string;
  needsTracking?: boolean;
  isOutdated?: boolean;
}

export class WorktreeOperations {
  constructor(private services: ServiceContainer) {}

  async listWorktrees(repoInfo: RepositoryInfo): Promise<WorktreeInfo[]> {
    try {
      const output = await this.services.git.executeCommand(repoInfo.gitDir, ['worktree', 'list', '--porcelain']);
      
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

  async isLocalBranchExists(repoInfo: RepositoryInfo, branchName: string): Promise<boolean> {
    try {
      const result = await this.services.git.executeCommandWithResult(repoInfo.gitDir, ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`]);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  async findRemoteBranch(repoInfo: RepositoryInfo, branchName: string): Promise<{ exists: boolean; remoteName?: string }> {
    try {
      // List all remote branches that match the branch name
      const result = await this.services.git.executeCommandWithResult(repoInfo.gitDir, ['for-each-ref', '--format=%(refname)', 'refs/remotes']);
      
      if (result.exitCode !== 0) {
        return { exists: false };
      }

      const remoteRefs = result.stdout.split('\n').filter(line => line.trim());
      
      // Look for a remote branch that matches our branch name
      for (const ref of remoteRefs) {
        if (ref.endsWith(`/${branchName}`)) {
          // Extract remote name from refs/remotes/origin/branch-name
          const match = ref.match(/^refs\/remotes\/([^/]+)\//);
          if (match) {
            return { exists: true, remoteName: match[1] };
          }
        }
      }
      
      return { exists: false };
    } catch {
      return { exists: false };
    }
  }

  async isLocalBranchOutdated(repoInfo: RepositoryInfo, branchName: string): Promise<boolean> {
    try {
      // First check if the local branch has a remote tracking branch
      const trackingResult = await this.services.git.executeCommandWithResult(repoInfo.gitDir, [
        'for-each-ref', 
        '--format=%(upstream)', 
        `refs/heads/${branchName}`
      ]);
      
      if (trackingResult.exitCode !== 0 || !trackingResult.stdout.trim()) {
        // No tracking branch configured
        return false;
      }
      
      const upstream = trackingResult.stdout.trim();
      
      // Get the commit hash of the local branch
      const localCommitResult = await this.services.git.executeCommandWithResult(repoInfo.gitDir, [
        'rev-parse', 
        `refs/heads/${branchName}`
      ]);
      
      if (localCommitResult.exitCode !== 0) {
        return false;
      }
      
      const localCommit = localCommitResult.stdout.trim();
      
      // Get the commit hash of the remote tracking branch
      const remoteCommitResult = await this.services.git.executeCommandWithResult(repoInfo.gitDir, [
        'rev-parse', 
        upstream
      ]);
      
      if (remoteCommitResult.exitCode !== 0) {
        return false;
      }
      
      const remoteCommit = remoteCommitResult.stdout.trim();
      
      // If commits are different, check if local is behind remote
      if (localCommit !== remoteCommit) {
        // Check if local commit is an ancestor of remote commit (meaning local is behind)
        const mergeBaseResult = await this.services.git.executeCommandWithResult(repoInfo.gitDir, [
          'merge-base', 
          '--is-ancestor', 
          localCommit, 
          remoteCommit
        ]);
        
        // If exit code is 0, local is an ancestor of remote (local is behind)
        return mergeBaseResult.exitCode === 0;
      }
      
      return false;
    } catch {
      // If any command fails, assume not outdated to avoid false positives
      return false;
    }
  }

  async performAutoFetch(repoInfo: RepositoryInfo, config: WTConfig): Promise<void> {
    if (!config.autoFetch) {
      return;
    }

    try {
      this.services.logger.log('Fetching latest changes...');
      await this.services.git.executeCommand(repoInfo.gitDir, ['fetch', '--all']);
    } catch (error) {
      // Auto-fetch failures are not fatal, just warn
      this.services.logger.warn(`Warning: Auto-fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async resolveBranch(repoInfo: RepositoryInfo, branchName: string, config: WTConfig): Promise<BranchResolution> {
    // First, perform auto-fetch if enabled
    await this.performAutoFetch(repoInfo, config);

    // Check if local branch exists
    const localExists = await this.isLocalBranchExists(repoInfo, branchName);
    
    if (localExists) {
      // Check if branch is outdated compared to remote
      const isOutdated = await this.isLocalBranchOutdated(repoInfo, branchName);
      return {
        type: 'local',
        branchName,
        isOutdated
      };
    }

    // Check if remote branch exists
    const remoteInfo = await this.findRemoteBranch(repoInfo, branchName);
    
    if (remoteInfo.exists && remoteInfo.remoteName) {
      return {
        type: 'remote',
        branchName,
        remoteName: remoteInfo.remoteName,
        needsTracking: true
      };
    }

    // Neither local nor remote exists - will create new branch
    return {
      type: 'new',
      branchName
    };
  }

  async createWorktree(
    repoInfo: RepositoryInfo,
    resolution: BranchResolution,
    worktreePath: string
  ): Promise<void> {
    const { type, branchName, remoteName } = resolution;

    try {
      switch (type) {
        case 'local': {
          // Create worktree from existing local branch
          if (resolution.isOutdated) {
            this.services.logger.warn(`Warning: Local branch '${branchName}' may be outdated. Consider fetching latest changes.`);
          }
          await this.services.git.executeCommand(repoInfo.gitDir, ['worktree', 'add', worktreePath, branchName]);
          this.services.logger.log(`Created worktree for existing local branch '${branchName}' at ${worktreePath}`);
          break;
        }

        case 'remote': {
          // Create worktree from remote branch with tracking
          const remoteBranchRef = `${remoteName}/${branchName}`;
          await this.services.git.executeCommand(repoInfo.gitDir, ['worktree', 'add', '-b', branchName, worktreePath, remoteBranchRef]);
          this.services.logger.log(`Created worktree for remote branch '${remoteBranchRef}' with local tracking branch '${branchName}' at ${worktreePath}`);
          break;
        }

        case 'new': {
          // Create worktree with new branch from current HEAD
          await this.services.git.executeCommand(repoInfo.gitDir, ['worktree', 'add', '-b', branchName, worktreePath]);
          this.services.logger.log(`Created worktree with new branch '${branchName}' at ${worktreePath}`);
          break;
        }

        default:
          throw new Error(`Unknown branch resolution type: ${type}`);
      }
    } catch (error) {
      throw new Error(`Failed to create worktree: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createWorktreeWithBranch(
    repoInfo: RepositoryInfo,
    config: WTConfig,
    branchName: string
  ): Promise<void> {
    // Resolve branch information
    const resolution = await this.resolveBranch(repoInfo, branchName, config);

    // Generate worktree path
    const worktreeBasePath = resolve(repoInfo.rootDir, config.worktreeDir);
    const worktreePath = join(worktreeBasePath, branchName);

    // Create the worktree
    await this.createWorktree(repoInfo, resolution, worktreePath);
  }

  async removeWorktree(repoInfo: RepositoryInfo, worktreePath: string): Promise<void> {
    try {
      await this.services.git.executeCommand(repoInfo.gitDir, ['worktree', 'remove', worktreePath]);
    } catch (error) {
      throw new Error(`Failed to remove worktree: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteBranch(repoInfo: RepositoryInfo, branchName: string): Promise<void> {
    try {
      await this.services.git.executeCommand(repoInfo.gitDir, ['branch', '-D', branchName]);
    } catch (error) {
      throw new Error(`Failed to delete branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async runCommandInWorktree(
    repoInfo: RepositoryInfo,
    config: WTConfig,
    branchName: string,
    command: string,
    args: string[]
  ): Promise<CommandResult> {
    // First, check if worktree already exists
    const worktrees = await this.listWorktrees(repoInfo);
    const existingWorktree = worktrees.find(wt => wt.branch === branchName);
    
    let worktreePath: string;
    
    if (existingWorktree) {
      worktreePath = existingWorktree.path;
      this.services.logger.log(`Using existing worktree for branch '${branchName}' at ${worktreePath}`);
    } else {
      // Create the worktree
      this.services.logger.log(`Creating worktree for branch '${branchName}'...`);
      await this.createWorktreeWithBranch(repoInfo, config, branchName);
      
      // Get the newly created worktree path
      const worktreeBasePath = resolve(repoInfo.rootDir, config.worktreeDir);
      worktreePath = join(worktreeBasePath, branchName);
    }
    
    this.services.logger.log(`Executing command in worktree: ${command} ${args.join(' ')}`);
    
    // Execute the command in the worktree directory with stdio inheritance for interactive commands
    return this.services.cmd.execute(command, args, worktreePath, true);
  }
}

/**
 * Lists all worktrees in the repository
 */
export async function listWorktrees(repoInfo: RepositoryInfo): Promise<WorktreeInfo[]> {
  const defaultServices = createServiceContainer();
  const worktreeOps = new WorktreeOperations(defaultServices);
  return worktreeOps.listWorktrees(repoInfo);
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

/**
 * Checks if a local branch exists
 */
export async function isLocalBranchExists(repoInfo: RepositoryInfo, branchName: string): Promise<boolean> {
  const defaultServices = createServiceContainer();
  const worktreeOps = new WorktreeOperations(defaultServices);
  return worktreeOps.isLocalBranchExists(repoInfo, branchName);
}

/**
 * Checks if a remote branch exists and returns the remote name
 */
export async function findRemoteBranch(repoInfo: RepositoryInfo, branchName: string): Promise<{ exists: boolean; remoteName?: string }> {
  const defaultServices = createServiceContainer();
  const worktreeOps = new WorktreeOperations(defaultServices);
  return worktreeOps.findRemoteBranch(repoInfo, branchName);
}

/**
 * Checks if a local branch is outdated compared to its remote tracking branch
 */
export async function isLocalBranchOutdated(repoInfo: RepositoryInfo, branchName: string): Promise<boolean> {
  const defaultServices = createServiceContainer();
  const worktreeOps = new WorktreeOperations(defaultServices);
  return worktreeOps.isLocalBranchOutdated(repoInfo, branchName);
}

export async function performAutoFetch(repoInfo: RepositoryInfo, config: WTConfig): Promise<void> {
  const defaultServices = createServiceContainer();
  const worktreeOps = new WorktreeOperations(defaultServices);
  return worktreeOps.performAutoFetch(repoInfo, config);
}

/**
 * Resolves branch information for worktree creation
 */
export async function resolveBranch(repoInfo: RepositoryInfo, branchName: string, config: WTConfig): Promise<BranchResolution> {
  const defaultServices = createServiceContainer();
  const worktreeOps = new WorktreeOperations(defaultServices);
  return worktreeOps.resolveBranch(repoInfo, branchName, config);
}

/**
 * Creates a worktree for the given branch resolution
 */
export async function createWorktree(
  repoInfo: RepositoryInfo,
  resolution: BranchResolution,
  worktreePath: string
): Promise<void> {
  const defaultServices = createServiceContainer();
  const worktreeOps = new WorktreeOperations(defaultServices);
  return worktreeOps.createWorktree(repoInfo, resolution, worktreePath);
}

/**
 * Creates a worktree with smart branch resolution
 */
export async function createWorktreeWithBranch(
  repoInfo: RepositoryInfo,
  config: WTConfig,
  branchName: string
): Promise<void> {
  const defaultServices = createServiceContainer();
  const worktreeOps = new WorktreeOperations(defaultServices);
  return worktreeOps.createWorktreeWithBranch(repoInfo, config, branchName);
}

/**
 * Finds worktrees matching a pattern
 */
export function findWorktreesByPattern(worktrees: WorktreeInfo[], pattern?: string): WorktreeInfo[] {
  if (!pattern) {
    return worktrees;
  }

  const normalizedPattern = pattern.toLowerCase();
  
  return worktrees.filter(worktree => {
    const name = basename(worktree.path).toLowerCase();
    const branch = worktree.branch.toLowerCase();
    const path = worktree.relativePath.toLowerCase();
    
    return name.includes(normalizedPattern) || 
           branch.includes(normalizedPattern) || 
           path.includes(normalizedPattern);
  });
}

/**
 * Removes a worktree
 */
export async function removeWorktree(repoInfo: RepositoryInfo, worktreePath: string): Promise<void> {
  const defaultServices = createServiceContainer();
  const worktreeOps = new WorktreeOperations(defaultServices);
  return worktreeOps.removeWorktree(repoInfo, worktreePath);
}

/**
 * Deletes a local branch
 */
export async function deleteBranch(repoInfo: RepositoryInfo, branchName: string): Promise<void> {
  const defaultServices = createServiceContainer();
  const worktreeOps = new WorktreeOperations(defaultServices);
  return worktreeOps.deleteBranch(repoInfo, branchName);
}

/**
 * Prompts user for confirmation
 */
export function promptConfirmation(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    process.stdout.write(`${message} (y/N): `);
    
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    
    const onData = (key: string) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      
      process.stdout.write('\n');
      
      const answer = key.toLowerCase();
      resolve(answer === 'y' || answer === 'yes');
    };
    
    stdin.on('data', onData);
  });
}

/**
 * Runs a command in a worktree directory, creating the worktree if it doesn't exist
 */
export async function runCommandInWorktree(
  repoInfo: RepositoryInfo,
  config: WTConfig,
  branchName: string,
  command: string,
  args: string[]
): Promise<CommandResult> {
  const defaultServices = createServiceContainer();
  const worktreeOps = new WorktreeOperations(defaultServices);
  return worktreeOps.runCommandInWorktree(repoInfo, config, branchName, command, args);
}