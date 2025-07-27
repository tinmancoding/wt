import type { Command } from '../cli/types.ts';
import { detectRepository, RepositoryError } from '../repository.ts';
import { loadConfig, updateConfigValue, getConfigValue, formatConfig, type WTConfig } from '../config.ts';
import { 
  listWorktrees, 
  formatWorktree, 
  formatWorktreeHeader, 
  findWorktreesByPattern,
  removeWorktree,
  deleteBranch,
  promptConfirmation,
  runCommandInWorktree,
  WorktreeOperations
} from '../worktree.ts';
import { EXIT_CODES, ExitCodeError } from '../cli/types.ts';
import { basename } from 'path';
import type { SupportedShell } from '../shell.ts';
import { initializeRepository, RepositoryInitError, NetworkError } from '../init.ts';
import type { ServiceContainer } from '../services/types.ts';
import { createServiceContainer } from '../services/container.ts';

/**
 * Creates list command with service injection
 */
export function createListCommand(services: ServiceContainer): Command {
  return {
    name: 'list',
    description: 'List all worktrees',
    aliases: ['ls'],
    handler: async () => {
      try {
        const repoInfo = await detectRepository();
        const worktrees = await listWorktrees(repoInfo);
        
        if (worktrees.length === 0) {
          services.logger.log('No worktrees found.');
          return;
        }
        
        services.logger.log(formatWorktreeHeader());
        for (const worktree of worktrees) {
          services.logger.log(formatWorktree(worktree));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        services.logger.error(`Error listing worktrees: ${message}`);
        
        // Use specific exit code for repository errors
        if (error instanceof RepositoryError) {
          process.exit(EXIT_CODES.GIT_REPO_NOT_FOUND);
        } else {
          process.exit(EXIT_CODES.GENERAL_ERROR);
        }
      }
    }
  };
}

/**
 * Creates create command with service injection
 */
export function createCreateCommand(services: ServiceContainer): Command {
  return {
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
          services.logger.error('Error: Branch name is required');
          process.exit(EXIT_CODES.INVALID_ARGUMENTS);
        }

        const repoInfo = await detectRepository();
        const config = await loadConfig(repoInfo);
        
        const worktreeOps = new WorktreeOperations(services);
        await worktreeOps.createWorktreeWithBranch(repoInfo, config, branch);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        services.logger.error(`Error creating worktree: ${message}`);
        
        // Use specific exit code for repository errors
        if (error instanceof RepositoryError) {
          process.exit(EXIT_CODES.GIT_REPO_NOT_FOUND);
        } else {
          process.exit(EXIT_CODES.GENERAL_ERROR);
        }
      }
    }
  };
}

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
 * Creates config command with service injection
 */
export function createConfigCommand(services: ServiceContainer): Command {
  return {
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
        services.logger.log(formatConfig(config));
        return;
      }

      if (key && !value) {
        // Show specific configuration value
        const config = await loadConfig(repoInfo);
        
        // Validate that the key exists
        if (!isValidConfigKey(key)) {
          services.logger.error(`Error: Invalid configuration key: ${key}`);
          services.logger.error('Valid keys: worktreeDir, autoFetch, confirmDelete, defaultBranch, hooks.postCreate, hooks.postRemove');
          process.exit(EXIT_CODES.INVALID_ARGUMENTS);
        }
        
        const configValue = getConfigValue(config, key as keyof WTConfig | `hooks.${keyof WTConfig['hooks']}`);
        services.logger.log(configValue === null ? 'null' : String(configValue));
        return;
      }

      if (key && value) {
        // Set configuration value
        if (!isValidConfigKey(key)) {
          services.logger.error(`Error: Invalid configuration key: ${key}`);
          services.logger.error('Valid keys: worktreeDir, autoFetch, confirmDelete, defaultBranch, hooks.postCreate, hooks.postRemove');
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
          services.logger.log(`Set ${key} = ${parsedValue === null ? 'null' : String(parsedValue)}`);
        } catch (error) {
          services.logger.error(`Error setting config: ${(error as Error).message}`);
          process.exit(EXIT_CODES.FILESYSTEM_ERROR);
        }
        return;
      }
    }
  };
}

/**
 * Creates remove command with service injection
 */
export function createRemoveCommand(services: ServiceContainer): Command {
  return {
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
          services.logger.log('No worktrees found.');
          return;
        }
        
        // Filter out the current worktree - can't remove current worktree
        const removableWorktrees = worktrees.filter(wt => !wt.isCurrent);
        
        // Find matching worktrees from removable ones
        const matchingWorktrees = findWorktreesByPattern(removableWorktrees, pattern);
        
        if (matchingWorktrees.length === 0) {
          if (pattern) {
            // If a pattern was provided, always report pattern-specific message
            services.logger.log(`No worktrees found matching pattern: ${pattern}`);
          } else if (removableWorktrees.length === 0) {
            // If no pattern and no removable worktrees
            services.logger.log('No removable worktrees found (current worktree cannot be removed).');
          } else {
            // If no pattern but there are removable worktrees (shouldn't happen in this case)
            services.logger.log('No removable worktrees found.');
          }
          return;
        }
        
        // If multiple matches, show them and ask user to be more specific
        if (matchingWorktrees.length > 1 && pattern) {
          services.logger.log(`Multiple worktrees match pattern "${pattern}":`);
          services.logger.log(formatWorktreeHeader());
          for (const worktree of matchingWorktrees) {
            services.logger.log(formatWorktree(worktree));
          }
          services.logger.log('\nPlease be more specific with your pattern.');
          return;
        }
        
        // If no pattern given and multiple worktrees, show options
        if (!pattern && matchingWorktrees.length > 1) {
          services.logger.log('Multiple worktrees available for removal:');
          services.logger.log(formatWorktreeHeader());
          for (const worktree of matchingWorktrees) {
            services.logger.log(formatWorktree(worktree));
          }
          services.logger.log('\nPlease specify a pattern to select which worktree to remove.');
          return;
        }
        
        // At this point we should have exactly one worktree
        const worktreeToRemove = matchingWorktrees[0];
        if (!worktreeToRemove) {
          services.logger.log('No worktree selected for removal.');
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
            services.logger.log('Removal cancelled.');
            return;
          }
        }
        
        // Remove the worktree
        services.logger.log(`Removing worktree '${worktreeName}'...`);
        await removeWorktree(repoInfo, worktreeToRemove.path);
        services.logger.log(`Worktree '${worktreeName}' removed successfully.`);
        
        // Delete branch if requested
        if (withBranch && !worktreeToRemove.isDetached) {
          try {
            services.logger.log(`Deleting branch '${worktreeToRemove.branch}'...`);
            await deleteBranch(repoInfo, worktreeToRemove.branch);
            services.logger.log(`Branch '${worktreeToRemove.branch}' deleted successfully.`);
          } catch (error) {
            services.logger.warn(`Warning: Failed to delete branch '${worktreeToRemove.branch}': ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
        
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        services.logger.error(`Error removing worktree: ${message}`);
        
        // Use specific exit code for repository errors
        if (error instanceof RepositoryError) {
          process.exit(EXIT_CODES.GIT_REPO_NOT_FOUND);
        } else {
          process.exit(EXIT_CODES.GENERAL_ERROR);
        }
      }
    }
  };
}

/**
 * Creates print-dir command with service injection
 */
export function createPrintDirCommand(services: ServiceContainer): Command {
  return {
    name: 'print-dir',
    description: 'Print directory path of matching worktree',
    args: [
      {
        name: 'pattern',
        description: 'Pattern to match worktree names, branches, or paths',
        required: false
      }
    ],
    handler: async ({ positional }) => {
      try {
        const pattern = positional[0];
        const repoInfo = await detectRepository();
        const worktrees = await listWorktrees(repoInfo);
        
        if (worktrees.length === 0) {
          services.logger.error('No worktrees found.');
          process.exit(EXIT_CODES.GENERAL_ERROR);
        }
        
        // If no pattern provided, show error
        if (!pattern) {
          services.logger.error('Error: Pattern is required for print-dir command');
          process.exit(EXIT_CODES.INVALID_ARGUMENTS);
        }
        
        // Find matching worktrees
        const matchingWorktrees = findWorktreesByPattern(worktrees, pattern);
        
        if (matchingWorktrees.length === 0) {
          services.logger.error(`No worktrees found matching pattern: ${pattern}`);
          process.exit(EXIT_CODES.GENERAL_ERROR);
        }
        
        if (matchingWorktrees.length === 1) {
          // Single match, print path to stdout
          const worktree = matchingWorktrees[0];
          if (worktree) {
            services.logger.log(worktree.path);
          }
          return;
        }
        
        // Multiple matches - show options and error
        services.logger.error(`Multiple worktrees match pattern "${pattern}":`);
        services.logger.error(formatWorktreeHeader());
        for (const worktree of matchingWorktrees) {
          services.logger.error(formatWorktree(worktree));
        }
        services.logger.error('\nPlease be more specific with your pattern.');
        process.exit(EXIT_CODES.GENERAL_ERROR);
        
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        services.logger.error(`Error finding worktree: ${message}`);
        
        // Use specific exit code for repository errors
        if (error instanceof RepositoryError) {
          process.exit(EXIT_CODES.GIT_REPO_NOT_FOUND);
        } else {
          process.exit(EXIT_CODES.GENERAL_ERROR);
        }
      }
    }
  };
}

/**
 * Creates setup command with service injection
 */
export function createSetupCommand(services: ServiceContainer): Command {
  return {
    name: 'setup',
    description: 'Generate shell wrapper functions for enhanced integration',
    flags: [
      {
        name: 'bash',
        description: 'Generate bash wrapper functions',
        type: 'boolean'
      },
      {
        name: 'zsh', 
        description: 'Generate zsh wrapper functions',
        type: 'boolean'
      },
      {
        name: 'fish',
        description: 'Generate fish wrapper functions',
        type: 'boolean'
      },
      {
        name: 'auto',
        description: 'Auto-detect shell and generate appropriate wrapper functions',
        type: 'boolean'
      }
    ],
    handler: async ({ flags }) => {
      // Import shell utilities
      const { detectShell, generateShellWrapper, getShellSetupInstructions } = await import('../shell.ts');
      
      let targetShell: SupportedShell | null = null;
      
      // Check for specific shell flags
      if (flags.bash) {
        targetShell = 'bash';
      } else if (flags.zsh) {
        targetShell = 'zsh';
      } else if (flags.fish) {
        targetShell = 'fish';
      } else if (flags.auto) {
        targetShell = detectShell();
        if (!targetShell) {
          services.logger.error('Error: Could not auto-detect shell from $SHELL environment variable');
          services.logger.error('Please specify a shell explicitly: --bash, --zsh, or --fish');
          process.exit(EXIT_CODES.GENERAL_ERROR);
        }
      } else {
        // No flags provided, show help
        services.logger.error('Error: Please specify a shell option');
        services.logger.error('Usage: wt setup --bash|--zsh|--fish|--auto');
        services.logger.error('');
        services.logger.error('Examples:');
        services.logger.error('  wt setup --auto          # Auto-detect shell');
        services.logger.error('  wt setup --bash          # Generate bash functions');
        services.logger.error('  wt setup --zsh           # Generate zsh functions');
        services.logger.error('  wt setup --fish          # Generate fish functions');
        services.logger.error('');
        services.logger.error('To install the wrapper functions:');
        
        const detectedShell = detectShell();
        if (detectedShell) {
          services.logger.error(getShellSetupInstructions(detectedShell));
        } else {
          services.logger.error('# For bash: source <(wt setup --bash)');
          services.logger.error('# For zsh:  source <(wt setup --zsh)');
          services.logger.error('# For fish: wt setup --fish | source');
        }
        
        process.exit(EXIT_CODES.INVALID_ARGUMENTS);
      }
      
      try {
        // Generate wrapper functions for the target shell
        const wrapperScript = generateShellWrapper(targetShell);
        services.logger.log(wrapperScript);
        
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        services.logger.error(`Error generating shell wrapper: ${message}`);
        process.exit(EXIT_CODES.GENERAL_ERROR);
      }
    }
  };
}

/**
 * Creates run command with service injection
 */
export function createRunCommand(services: ServiceContainer): Command {
  return {
    name: 'run',
    description: 'Create worktree (if needed) and run command in it',
    args: [
      {
        name: 'branch',
        description: 'Branch name to create worktree for',
        required: true
      },
      {
        name: 'command',
        description: 'Command to execute in the worktree',
        required: true
      }
    ],
    handler: async ({ positional }) => {
      try {
        const [branch, command, ...commandArgs] = positional;
        
        if (!branch) {
          services.logger.error('Error: Branch name is required');
          process.exit(EXIT_CODES.INVALID_ARGUMENTS);
        }
        
        if (!command) {
          services.logger.error('Error: Command is required');
          process.exit(EXIT_CODES.INVALID_ARGUMENTS);
        }
        
        const repoInfo = await detectRepository();
        const config = await loadConfig(repoInfo);
        
        // Run command in worktree (creates worktree if it doesn't exist)
        const result = await runCommandInWorktree(repoInfo, config, branch, command, commandArgs);
        
        // Exit with the same code as the executed command
        if (result.exitCode !== 0) {
          throw new ExitCodeError(result.exitCode);
        }
        
      } catch (error) {
        // Re-throw ExitCodeError to let CLI handle it
        if (error instanceof Error && error.name === 'ExitCodeError') {
          throw error;
        }
        
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        services.logger.error(`Error running command: ${message}`);
        
        // Use specific exit code for repository errors
        if (error instanceof RepositoryError) {
          process.exit(EXIT_CODES.GIT_REPO_NOT_FOUND);
        } else {
          process.exit(EXIT_CODES.GENERAL_ERROR);
        }
      }
    }
  };
}

/**
 * Creates init command with service injection
 */
export function createInitCommand(services: ServiceContainer): Command {
  return {
    name: 'init',
    description: 'Initialize a new repository with bare setup for worktrees',
    args: [
      {
        name: 'git-url',
        description: 'Git repository URL to clone',
        required: true
      },
      {
        name: 'name',
        description: 'Target directory name (optional, defaults to repository name)',
        required: false
      }
    ],
    handler: async ({ positional }) => {
      try {
        const [gitUrl, targetName] = positional;
        
        if (!gitUrl) {
          services.logger.error('Error: Git repository URL is required');
          process.exit(EXIT_CODES.INVALID_ARGUMENTS);
        }
        
        // Initialize the repository
        await initializeRepository(gitUrl, targetName);
        
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        services.logger.error(`Error initializing repository: ${message}`);
        
        // Use specific exit codes for different error types
        if (error instanceof NetworkError) {
          process.exit(EXIT_CODES.NETWORK_ERROR);
        } else if (error instanceof RepositoryInitError) {
          process.exit(error.code);
        } else {
          process.exit(EXIT_CODES.GENERAL_ERROR);
        }
      }
    }
  };
}

/**
 * Factory function to create all commands with service injection
 */
export function createCommands(services: ServiceContainer): Command[] {
  return [
    createListCommand(services),
    createCreateCommand(services),
    createConfigCommand(services),
    createRemoveCommand(services),
    createPrintDirCommand(services),
    createSetupCommand(services),
    createRunCommand(services),
    createInitCommand(services)
  ];
}

// Backward compatibility exports with default services
const defaultServices = createServiceContainer();

export const listCommand: Command = createListCommand(defaultServices);
export const createCommand: Command = createCreateCommand(defaultServices);
export const configCommand: Command = createConfigCommand(defaultServices);
export const removeCommand: Command = createRemoveCommand(defaultServices);
export const printDirCommand: Command = createPrintDirCommand(defaultServices);
export const setupCommand: Command = createSetupCommand(defaultServices);
export const runCommand: Command = createRunCommand(defaultServices);
export const initCommand: Command = createInitCommand(defaultServices);