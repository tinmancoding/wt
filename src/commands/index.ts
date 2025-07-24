import type { Command } from '../cli/types.ts';
import { detectRepository, RepositoryError } from '../repository.ts';
import { loadConfig, updateConfigValue, getConfigValue, formatConfig, type WTConfig } from '../config.ts';
import { 
  listWorktrees, 
  formatWorktree, 
  formatWorktreeHeader, 
  createWorktreeWithBranch, 
  findWorktreesByPattern,
  removeWorktree,
  deleteBranch,
  promptConfirmation
} from '../worktree.ts';
import { EXIT_CODES } from '../cli/types.ts';
import { basename } from 'path';

/**
 * List command - lists all worktrees
 */
export const listCommand: Command = {
  name: 'list',
  description: 'List all worktrees',
  aliases: ['ls'],
  handler: async () => {
    try {
      const repoInfo = await detectRepository();
      const worktrees = await listWorktrees(repoInfo);
      
      if (worktrees.length === 0) {
        console.log('No worktrees found.');
        return;
      }
      
      console.log(formatWorktreeHeader());
      for (const worktree of worktrees) {
        console.log(formatWorktree(worktree));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`Error listing worktrees: ${message}`);
      
      // Use specific exit code for repository errors
      if (error instanceof RepositoryError) {
        process.exit(EXIT_CODES.GIT_REPO_NOT_FOUND);
      } else {
        process.exit(EXIT_CODES.GENERAL_ERROR);
      }
    }
  }
};

/**
 * Create command - creates a new worktree
 */
export const createCommand: Command = {
  name: 'create',
  description: 'Create a new worktree',
  args: [
    {
      name: 'branch',
      description: 'Branch name to create worktree for',
      required: true
    }
  ],
  handler: async ({ positional }) => {
    try {
      const branch = positional[0];
      if (!branch) {
        console.error('Error: Branch name is required');
        process.exit(EXIT_CODES.INVALID_ARGUMENTS);
      }

      const repoInfo = await detectRepository();
      const config = await loadConfig(repoInfo);
      
      await createWorktreeWithBranch(repoInfo, config, branch);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`Error creating worktree: ${message}`);
      
      // Use specific exit code for repository errors
      if (error instanceof RepositoryError) {
        process.exit(EXIT_CODES.GIT_REPO_NOT_FOUND);
      } else {
        process.exit(EXIT_CODES.GENERAL_ERROR);
      }
    }
  }
};

/**
 * Parses a boolean value from string input
 */
function parseBoolean(value: string): boolean {
  const lowercaseValue = value.toLowerCase();
  if (lowercaseValue === 'true' || lowercaseValue === '1' || lowercaseValue === 'yes') {
    return true;
  }
  if (lowercaseValue === 'false' || lowercaseValue === '0' || lowercaseValue === 'no') {
    return false;
  }
  throw new Error(`Invalid boolean value: ${value}. Use true/false, yes/no, or 1/0`);
}

/**
 * Config command - manages configuration settings
 */
export const configCommand: Command = {
  name: 'config',
  description: 'Show or set configuration values',
  args: [
    {
      name: 'key',
      description: 'Configuration key to get or set',
      required: false
    },
    {
      name: 'value',
      description: 'Value to set for the configuration key',
      required: false
    }
  ],
  handler: async ({ positional }) => {
    const repoInfo = await detectRepository();
    const [key, value] = positional;

    if (!key && !value) {
      // Show all configuration
      const config = await loadConfig(repoInfo);
      console.log(formatConfig(config));
      return;
    }

    if (key && !value) {
      // Show specific configuration value
      const config = await loadConfig(repoInfo);
      
      // Validate that the key exists
      if (!isValidConfigKey(key)) {
        console.error(`Error: Invalid configuration key: ${key}`);
        console.error('Valid keys: worktreeDir, autoFetch, confirmDelete, defaultBranch, hooks.postCreate, hooks.postRemove');
        process.exit(EXIT_CODES.INVALID_ARGUMENTS);
      }
      
      const configValue = getConfigValue(config, key as keyof WTConfig | `hooks.${keyof WTConfig['hooks']}`);
      console.log(configValue === null ? 'null' : String(configValue));
      return;
    }

    if (key && value) {
      // Set configuration value
      if (!isValidConfigKey(key)) {
        console.error(`Error: Invalid configuration key: ${key}`);
        console.error('Valid keys: worktreeDir, autoFetch, confirmDelete, defaultBranch, hooks.postCreate, hooks.postRemove');
        process.exit(EXIT_CODES.INVALID_ARGUMENTS);
      }

      try {
        let parsedValue: string | boolean | null;
        
        // Parse value based on key type
        if (key === 'autoFetch' || key === 'confirmDelete') {
          parsedValue = parseBoolean(value);
        } else if (key === 'hooks.postCreate' || key === 'hooks.postRemove') {
          parsedValue = value === 'null' ? null : value;
        } else {
          parsedValue = value;
        }

        await updateConfigValue(repoInfo, key as keyof WTConfig | `hooks.${keyof WTConfig['hooks']}`, parsedValue);
        console.log(`Set ${key} = ${parsedValue === null ? 'null' : String(parsedValue)}`);
      } catch (error) {
        console.error(`Error setting config: ${(error as Error).message}`);
        process.exit(EXIT_CODES.FILESYSTEM_ERROR);
      }
      return;
    }
  }
};

/**
 * Validates if a given key is a valid configuration key
 */
function isValidConfigKey(key: string): key is keyof WTConfig | `hooks.${keyof WTConfig['hooks']}` {
  const validKeys = [
    'worktreeDir',
    'autoFetch', 
    'confirmDelete',
    'defaultBranch',
    'hooks.postCreate',
    'hooks.postRemove'
  ];
  return validKeys.includes(key);
}

/**
 * Remove command - removes worktrees with optional branch deletion
 */
export const removeCommand: Command = {
  name: 'remove',
  description: 'Remove a worktree with optional branch deletion',
  aliases: ['rm'],
  args: [
    {
      name: 'pattern',
      description: 'Pattern to match worktree names, branches, or paths',
      required: false
    }
  ],
  flags: [
    {
      name: 'with-branch',
      description: 'Also delete the associated local branch',
      type: 'boolean'
    }
  ],
  handler: async ({ positional, flags }) => {
    try {
      const pattern = positional[0];
      const withBranch = !!flags['with-branch'];
      
      const repoInfo = await detectRepository();
      const config = await loadConfig(repoInfo);
      const worktrees = await listWorktrees(repoInfo);
      
      if (worktrees.length === 0) {
        console.log('No worktrees found.');
        return;
      }
      
      // Filter out the current worktree - can't remove current worktree
      const removableWorktrees = worktrees.filter(wt => !wt.isCurrent);
      
      // Find matching worktrees from removable ones
      const matchingWorktrees = findWorktreesByPattern(removableWorktrees, pattern);
      
      if (matchingWorktrees.length === 0) {
        if (pattern) {
          // If a pattern was provided, always report pattern-specific message
          console.log(`No worktrees found matching pattern: ${pattern}`);
        } else if (removableWorktrees.length === 0) {
          // If no pattern and no removable worktrees
          console.log('No removable worktrees found (current worktree cannot be removed).');
        } else {
          // If no pattern but there are removable worktrees (shouldn't happen in this case)
          console.log('No removable worktrees found.');
        }
        return;
      }
      
      // If multiple matches, show them and ask user to be more specific
      if (matchingWorktrees.length > 1 && pattern) {
        console.log(`Multiple worktrees match pattern "${pattern}":`);
        console.log(formatWorktreeHeader());
        for (const worktree of matchingWorktrees) {
          console.log(formatWorktree(worktree));
        }
        console.log('\nPlease be more specific with your pattern.');
        return;
      }
      
      // If no pattern given and multiple worktrees, show options
      if (!pattern && matchingWorktrees.length > 1) {
        console.log('Multiple worktrees available for removal:');
        console.log(formatWorktreeHeader());
        for (const worktree of matchingWorktrees) {
          console.log(formatWorktree(worktree));
        }
        console.log('\nPlease specify a pattern to select which worktree to remove.');
        return;
      }
      
      // At this point we should have exactly one worktree
      const worktreeToRemove = matchingWorktrees[0];
      if (!worktreeToRemove) {
        console.log('No worktree selected for removal.');
        return;
      }
      
      const worktreeName = basename(worktreeToRemove.path);
      
      // Show confirmation if required by config
      if (config.confirmDelete) {
        const confirmMessage = withBranch 
          ? `Remove worktree '${worktreeName}' and delete branch '${worktreeToRemove.branch}'?`
          : `Remove worktree '${worktreeName}'?`;
          
        const confirmed = await promptConfirmation(confirmMessage);
        if (!confirmed) {
          console.log('Removal cancelled.');
          return;
        }
      }
      
      // Remove the worktree
      console.log(`Removing worktree '${worktreeName}'...`);
      await removeWorktree(repoInfo, worktreeToRemove.path);
      console.log(`Worktree '${worktreeName}' removed successfully.`);
      
      // Delete branch if requested
      if (withBranch && !worktreeToRemove.isDetached) {
        try {
          console.log(`Deleting branch '${worktreeToRemove.branch}'...`);
          await deleteBranch(repoInfo, worktreeToRemove.branch);
          console.log(`Branch '${worktreeToRemove.branch}' deleted successfully.`);
        } catch (error) {
          console.warn(`Warning: Failed to delete branch '${worktreeToRemove.branch}': ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`Error removing worktree: ${message}`);
      
      // Use specific exit code for repository errors
      if (error instanceof RepositoryError) {
        process.exit(EXIT_CODES.GIT_REPO_NOT_FOUND);
      } else {
        process.exit(EXIT_CODES.GENERAL_ERROR);
      }
    }
  }
};