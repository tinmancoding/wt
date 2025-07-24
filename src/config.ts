/**
 * Configuration management for WT
 */

import { join, resolve } from 'node:path';
import { readFile, writeFile, access, constants } from 'node:fs/promises';
import { EXIT_CODES } from './cli/types.ts';
import type { RepositoryInfo } from './repository.ts';

export interface WTConfig {
  /** Directory where worktrees are created, relative to .bare parent */
  worktreeDir: string;
  /** Whether to auto-fetch before create operations */
  autoFetch: boolean;
  /** Whether to confirm before removing worktrees */
  confirmDelete: boolean;
  /** Hook system configuration */
  hooks: {
    /** Executable to run after creating a worktree */
    postCreate: string | null;
    /** Executable to run after removing a worktree */
    postRemove: string | null;
  };
  /** Fallback default branch name */
  defaultBranch: string;
}

export interface PartialWTConfig {
  worktreeDir?: string;
  autoFetch?: boolean;
  confirmDelete?: boolean;
  hooks?: {
    postCreate?: string | null;
    postRemove?: string | null;
  };
  defaultBranch?: string;
}

export class ConfigError extends Error {
  constructor(message: string, public readonly code: number = EXIT_CODES.FILESYSTEM_ERROR) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: WTConfig = Object.freeze({
  worktreeDir: './',
  autoFetch: true,
  confirmDelete: false,
  hooks: Object.freeze({
    postCreate: null,
    postRemove: null
  }),
  defaultBranch: 'main'
});

/**
 * Creates a deep copy of the default configuration
 */
function createDefaultConfig(): WTConfig {
  return {
    worktreeDir: './',
    autoFetch: true,
    confirmDelete: false,
    hooks: {
      postCreate: null,
      postRemove: null
    },
    defaultBranch: 'main'
  };
}

/**
 * Configuration file name
 */
export const CONFIG_FILE_NAME = '.wtconfig.json';

/**
 * Loads and parses .wtconfig.json from the repository root
 */
export async function loadConfig(repoInfo: RepositoryInfo): Promise<WTConfig> {
  const configPath = join(repoInfo.rootDir, CONFIG_FILE_NAME);
  
  try {
    // Check if config file exists
    await access(configPath, constants.F_OK);
    
    // Read and parse the config file
    const configContent = await readFile(configPath, 'utf-8');
    const parsedConfig = JSON.parse(configContent) as PartialWTConfig;
    
    // Validate and merge with defaults
    return validateAndMergeConfig(parsedConfig);
    
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ConfigError(
        `Invalid JSON in config file ${configPath}: ${error.message}`,
        EXIT_CODES.FILESYSTEM_ERROR
      );
    }
    
    // If file doesn't exist, return default config
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return createDefaultConfig();
    }
    
    // Re-throw other filesystem errors
    throw new ConfigError(
      `Failed to read config file ${configPath}: ${(error as Error).message}`,
      EXIT_CODES.FILESYSTEM_ERROR
    );
  }
}

/**
 * Validates configuration values and merges with defaults
 */
export function validateAndMergeConfig(partialConfig: PartialWTConfig): WTConfig {
  const config: WTConfig = createDefaultConfig();
  
  // Validate and set worktreeDir
  if (partialConfig.worktreeDir !== undefined) {
    if (typeof partialConfig.worktreeDir !== 'string') {
      throw new ConfigError('worktreeDir must be a string');
    }
    config.worktreeDir = partialConfig.worktreeDir;
  }
  
  // Validate and set autoFetch
  if (partialConfig.autoFetch !== undefined) {
    if (typeof partialConfig.autoFetch !== 'boolean') {
      throw new ConfigError('autoFetch must be a boolean');
    }
    config.autoFetch = partialConfig.autoFetch;
  }
  
  // Validate and set confirmDelete
  if (partialConfig.confirmDelete !== undefined) {
    if (typeof partialConfig.confirmDelete !== 'boolean') {
      throw new ConfigError('confirmDelete must be a boolean');
    }
    config.confirmDelete = partialConfig.confirmDelete;
  }
  
  // Validate and set defaultBranch
  if (partialConfig.defaultBranch !== undefined) {
    if (typeof partialConfig.defaultBranch !== 'string') {
      throw new ConfigError('defaultBranch must be a string');
    }
    config.defaultBranch = partialConfig.defaultBranch;
  }
  
  // Validate and set hooks
  if (partialConfig.hooks !== undefined) {
    if (typeof partialConfig.hooks !== 'object' || partialConfig.hooks === null) {
      throw new ConfigError('hooks must be an object');
    }
    
    if (partialConfig.hooks.postCreate !== undefined) {
      if (partialConfig.hooks.postCreate !== null && typeof partialConfig.hooks.postCreate !== 'string') {
        throw new ConfigError('hooks.postCreate must be a string or null');
      }
      config.hooks.postCreate = partialConfig.hooks.postCreate;
    }
    
    if (partialConfig.hooks.postRemove !== undefined) {
      if (partialConfig.hooks.postRemove !== null && typeof partialConfig.hooks.postRemove !== 'string') {
        throw new ConfigError('hooks.postRemove must be a string or null');
      }
      config.hooks.postRemove = partialConfig.hooks.postRemove;
    }
  }
  
  return config;
}

/**
 * Saves configuration to .wtconfig.json file
 */
export async function saveConfig(repoInfo: RepositoryInfo, config: WTConfig): Promise<void> {
  const configPath = join(repoInfo.rootDir, CONFIG_FILE_NAME);
  
  try {
    const configContent = JSON.stringify(config, null, 2);
    await writeFile(configPath, configContent, 'utf-8');
  } catch (error) {
    throw new ConfigError(
      `Failed to save config file ${configPath}: ${(error as Error).message}`,
      EXIT_CODES.FILESYSTEM_ERROR
    );
  }
}

/**
 * Gets the absolute path where worktrees should be created
 */
export function getWorktreePath(repoInfo: RepositoryInfo, config: WTConfig): string {
  return resolve(repoInfo.rootDir, config.worktreeDir);
}

/**
 * Updates a specific configuration value
 */
export async function updateConfigValue(
  repoInfo: RepositoryInfo,
  key: keyof WTConfig | `hooks.${keyof WTConfig['hooks']}`,
  value: string | boolean | null
): Promise<WTConfig> {
  const currentConfig = await loadConfig(repoInfo);
  
  // Handle nested hook properties
  if (key.startsWith('hooks.')) {
    const hookKey = key.slice(6) as keyof WTConfig['hooks'];
    if (hookKey !== 'postCreate' && hookKey !== 'postRemove') {
      throw new ConfigError(`Invalid hook configuration key: ${hookKey}`);
    }
    
    if (value !== null && typeof value !== 'string') {
      throw new ConfigError(`Hook ${hookKey} must be a string or null`);
    }
    
    currentConfig.hooks[hookKey] = value as string | null;
  } else {
    // Handle top-level properties
    switch (key) {
      case 'worktreeDir':
      case 'defaultBranch':
        if (typeof value !== 'string') {
          throw new ConfigError(`${key} must be a string`);
        }
        (currentConfig as any)[key] = value;
        break;
        
      case 'autoFetch':
      case 'confirmDelete':
        if (typeof value !== 'boolean') {
          throw new ConfigError(`${key} must be a boolean`);
        }
        (currentConfig as any)[key] = value;
        break;
        
      default:
        throw new ConfigError(`Invalid configuration key: ${key}`);
    }
  }
  
  // Validate the updated configuration
  const validatedConfig = validateAndMergeConfig(currentConfig);
  
  // Save the updated configuration
  await saveConfig(repoInfo, validatedConfig);
  
  return validatedConfig;
}

/**
 * Gets a specific configuration value by key
 */
export function getConfigValue(
  config: WTConfig,
  key: keyof WTConfig | `hooks.${keyof WTConfig['hooks']}`
): string | boolean | null {
  if (key.startsWith('hooks.')) {
    const hookKey = key.slice(6) as keyof WTConfig['hooks'];
    return config.hooks[hookKey];
  }
  
  return (config as any)[key];
}

/**
 * Formats configuration for display
 */
export function formatConfig(config: WTConfig): string {
  const lines: string[] = [];
  
  lines.push(`worktreeDir: ${config.worktreeDir}`);
  lines.push(`autoFetch: ${config.autoFetch}`);
  lines.push(`confirmDelete: ${config.confirmDelete}`);
  lines.push(`defaultBranch: ${config.defaultBranch}`);
  lines.push(`hooks.postCreate: ${config.hooks.postCreate ?? 'null'}`);
  lines.push(`hooks.postRemove: ${config.hooks.postRemove ?? 'null'}`);
  
  return lines.join('\n');
}