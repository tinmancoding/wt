import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { mkdir, writeFile, rmdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig, saveConfig, updateConfigValue, CONFIG_FILE_NAME } from '../../src/config.ts';
import type { WTConfig } from '../../src/config.ts';
import type { RepositoryInfo } from '../../src/repository.ts';

describe('Configuration Integration Tests', () => {
  let tempDir: string;
  let repoInfo: RepositoryInfo;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = join(process.cwd(), 'temp', `config-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    // Create mock repository info
    repoInfo = {
      rootDir: tempDir,
      gitDir: join(tempDir, '.bare'),
      type: 'bare',
      bareDir: join(tempDir, '.bare')
    };

    // Create .bare directory to simulate repository structure
    await mkdir(repoInfo.gitDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await rmdir(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('should load default config when no .wtconfig.json exists', async () => {
    const config = await loadConfig(repoInfo);
    
    expect(config).toEqual({
      worktreeDir: './',
      autoFetch: true,
      confirmDelete: false,
      hooks: {
        postCreate: null,
        postRemove: null
      },
      defaultBranch: 'main'
    });
  });

  test('should load and parse valid .wtconfig.json file', async () => {
    // Create a custom config file
    const customConfig = {
      worktreeDir: '../custom-worktrees',
      autoFetch: false,
      confirmDelete: true,
      hooks: {
        postCreate: '/path/to/post-create.sh',
        postRemove: null
      },
      defaultBranch: 'develop'
    };

    const configPath = join(tempDir, CONFIG_FILE_NAME);
    await writeFile(configPath, JSON.stringify(customConfig, null, 2), 'utf-8');

    // Load the config
    const config = await loadConfig(repoInfo);
    expect(config).toEqual(customConfig);
  });

  test('should handle malformed JSON gracefully', async () => {
    // Create invalid JSON file
    const configPath = join(tempDir, CONFIG_FILE_NAME);
    await writeFile(configPath, '{ invalid json content', 'utf-8');

    // Should throw ConfigError for invalid JSON
    await expect(loadConfig(repoInfo)).rejects.toThrow('Invalid JSON in config file');
  });

  test('should save configuration to file', async () => {
    const config: WTConfig = {
      worktreeDir: '../saved-worktrees',
      autoFetch: false,
      confirmDelete: true,
      hooks: {
        postCreate: '/custom/post-create.sh',
        postRemove: '/custom/post-remove.sh'
      },
      defaultBranch: 'main'
    };

    // Save the config
    await saveConfig(repoInfo, config);

    // Verify file was created and contains correct content
    const configPath = join(tempDir, CONFIG_FILE_NAME);
    const fileContent = await readFile(configPath, 'utf-8');
    const parsedContent = JSON.parse(fileContent);
    
    expect(parsedContent).toEqual(config);
  });

  test('should update specific configuration values', async () => {
    // Start with a custom config
    const initialConfig = {
      worktreeDir: './',
      autoFetch: true,
      defaultBranch: 'master'
    };

    const configPath = join(tempDir, CONFIG_FILE_NAME);
    await writeFile(configPath, JSON.stringify(initialConfig, null, 2), 'utf-8');

    // Update autoFetch
    let updatedConfig = await updateConfigValue(repoInfo, 'autoFetch', false);
    expect(updatedConfig.autoFetch).toBe(false);

    // Update worktreeDir  
    updatedConfig = await updateConfigValue(repoInfo, 'worktreeDir', '../new-worktrees');
    expect(updatedConfig.worktreeDir).toBe('../new-worktrees');

    // Update hook value
    updatedConfig = await updateConfigValue(repoInfo, 'hooks.postCreate', '/new/hook.sh');
    expect(updatedConfig.hooks.postCreate).toBe('/new/hook.sh');

    // Verify the file was updated
    const fileContent = await readFile(configPath, 'utf-8');
    const parsedContent = JSON.parse(fileContent);
    expect(parsedContent.autoFetch).toBe(false);
    expect(parsedContent.worktreeDir).toBe('../new-worktrees');
    expect(parsedContent.hooks.postCreate).toBe('/new/hook.sh');
  });

  test('should handle partial config files', async () => {
    // Create partial config with only some values
    const partialConfig = {
      autoFetch: false,
      hooks: {
        postCreate: '/partial/hook.sh'
      }
    };

    const configPath = join(tempDir, CONFIG_FILE_NAME);
    await writeFile(configPath, JSON.stringify(partialConfig, null, 2), 'utf-8');

    // Load config should merge with defaults
    const config = await loadConfig(repoInfo);
    
    expect(config).toEqual({
      worktreeDir: './',       // from defaults
      autoFetch: false,        // from partial config
      confirmDelete: false,    // from defaults
      hooks: {
        postCreate: '/partial/hook.sh',  // from partial config
        postRemove: null                 // from defaults
      },
      defaultBranch: 'main'    // from defaults
    });
  });

  test('should validate configuration values during updates', async () => {
    // Test invalid type for autoFetch
    expect(updateConfigValue(repoInfo, 'autoFetch', 'invalid' as any))
      .rejects.toThrow('autoFetch must be a boolean');

    // Test invalid type for worktreeDir
    expect(updateConfigValue(repoInfo, 'worktreeDir', 123 as any))
      .rejects.toThrow('worktreeDir must be a string');

    // Test invalid hook key
    expect(updateConfigValue(repoInfo, 'hooks.invalidHook' as any, '/path'))
      .rejects.toThrow('Invalid hook configuration key');

    // Test invalid configuration key
    expect(updateConfigValue(repoInfo, 'invalidKey' as any, 'value'))
      .rejects.toThrow('Invalid configuration key');
  });
});