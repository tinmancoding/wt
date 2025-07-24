import { test, expect, describe } from 'bun:test';
import { 
  DEFAULT_CONFIG, 
  validateAndMergeConfig, 
  getConfigValue, 
  formatConfig,
  ConfigError
} from '../../src/config.ts';
import type { WTConfig, PartialWTConfig } from '../../src/config.ts';
import type { RepositoryInfo } from '../../src/repository.ts';

// Mock repository info for testing
const mockRepoInfo: RepositoryInfo = {
  rootDir: '/test/repo',
  gitDir: '/test/repo/.git',
  type: 'standard'
};

describe('Configuration System', () => {

  describe('DEFAULT_CONFIG', () => {
    test('should have expected default values', () => {
      expect(DEFAULT_CONFIG).toEqual({
        worktreeDir: './', // This is a fallback; actual default is auto-detected
        autoFetch: true,
        confirmDelete: false,
        hooks: {
          postCreate: null,
          postRemove: null
        },
        defaultBranch: 'main'
      });
    });
  });

  describe('validateAndMergeConfig', () => {
    test('should return default config for empty partial config', async () => {
      const result = await validateAndMergeConfig({}, mockRepoInfo);
      expect(result.autoFetch).toBe(true);
      expect(result.confirmDelete).toBe(false);
      expect(result.defaultBranch).toBe('main');
      expect(result.hooks.postCreate).toBeNull();
      expect(result.hooks.postRemove).toBeNull();
      // worktreeDir may vary based on auto-detection, so we just check it's a string
      expect(typeof result.worktreeDir).toBe('string');
    });

    test('should merge partial config with defaults', async () => {
      const partial: PartialWTConfig = {
        autoFetch: false,
        defaultBranch: 'develop'
      };

      const result = await validateAndMergeConfig(partial, mockRepoInfo);
      expect(result.autoFetch).toBe(false);
      expect(result.defaultBranch).toBe('develop');
      expect(result.confirmDelete).toBe(false); // default value
    });

    test('should validate worktreeDir type', async () => {
      await expect(validateAndMergeConfig({ worktreeDir: 123 as any }, mockRepoInfo))
        .rejects.toThrow(ConfigError);
    });

    test('should validate autoFetch type', async () => {
      await expect(validateAndMergeConfig({ autoFetch: 'true' as any }, mockRepoInfo))
        .rejects.toThrow(ConfigError);
    });

    test('should validate confirmDelete type', async () => {
      await expect(validateAndMergeConfig({ confirmDelete: 'false' as any }, mockRepoInfo))
        .rejects.toThrow(ConfigError);
    });

    test('should validate defaultBranch type', async () => {
      await expect(validateAndMergeConfig({ defaultBranch: 123 as any }, mockRepoInfo))
        .rejects.toThrow(ConfigError);
    });

    test('should validate hooks object type', async () => {
      await expect(validateAndMergeConfig({ hooks: 'invalid' as any }, mockRepoInfo))
        .rejects.toThrow(ConfigError);
    });

    test('should validate hooks.postCreate type', async () => {
      await expect(validateAndMergeConfig({ 
        hooks: { postCreate: 123 as any } 
      }, mockRepoInfo)).rejects.toThrow(ConfigError);
    });

    test('should validate hooks.postRemove type', async () => {
      await expect(validateAndMergeConfig({ 
        hooks: { postRemove: true as any } 
      }, mockRepoInfo)).rejects.toThrow(ConfigError);
    });

    test('should allow null hook values', async () => {
      const result = await validateAndMergeConfig({
        hooks: {
          postCreate: null,
          postRemove: null
        }
      }, mockRepoInfo);

      expect(result.hooks.postCreate).toBeNull();
      expect(result.hooks.postRemove).toBeNull();
    });

    test('should allow string hook values', async () => {
      const result = await validateAndMergeConfig({
        hooks: {
          postCreate: '/path/to/script.sh',
          postRemove: 'cleanup-command'
        }
      }, mockRepoInfo);

      expect(result.hooks.postCreate).toBe('/path/to/script.sh');
      expect(result.hooks.postRemove).toBe('cleanup-command');
    });
  });

  describe('getConfigValue', () => {
    const config: WTConfig = {
      worktreeDir: './',
      autoFetch: false,
      confirmDelete: false,
      defaultBranch: 'main',
      hooks: {
        postCreate: '/custom/script.sh',
        postRemove: null
      }
    };

    test('should get top-level config values', () => {
      expect(getConfigValue(config, 'autoFetch')).toBe(false);
      expect(getConfigValue(config, 'worktreeDir')).toBe('./');
      expect(getConfigValue(config, 'confirmDelete')).toBe(false);
      expect(getConfigValue(config, 'defaultBranch')).toBe('main');
    });

    test('should get hook config values', () => {
      expect(getConfigValue(config, 'hooks.postCreate')).toBe('/custom/script.sh');
      expect(getConfigValue(config, 'hooks.postRemove')).toBeNull();
    });
  });

  describe('formatConfig', () => {
    test('should format config for display', () => {
      const config: WTConfig = {
        worktreeDir: '../worktrees',
        autoFetch: false,
        confirmDelete: true,
        defaultBranch: 'develop',
        hooks: {
          postCreate: '/custom/post-create.sh',
          postRemove: null
        }
      };

      const formatted = formatConfig(config);
      expect(formatted).toBe([
        'worktreeDir: ../worktrees',
        'autoFetch: false',
        'confirmDelete: true',
        'defaultBranch: develop',
        'hooks.postCreate: /custom/post-create.sh',
        'hooks.postRemove: null'
      ].join('\n'));
    });

    test('should format default config', () => {
      const defaultConfig: WTConfig = {
        worktreeDir: './',
        autoFetch: true,
        confirmDelete: false,
        hooks: {
          postCreate: null,
          postRemove: null
        },
        defaultBranch: 'main'
      };
      
      const formatted = formatConfig(defaultConfig);
      expect(formatted).toBe([
        'worktreeDir: ./',
        'autoFetch: true',
        'confirmDelete: false',
        'defaultBranch: main',
        'hooks.postCreate: null',
        'hooks.postRemove: null'
      ].join('\n'));
    });
  });

  describe('ConfigError', () => {
    test('should create ConfigError with default code', () => {
      const error = new ConfigError('Test error');
      expect(error.name).toBe('ConfigError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(5); // FILESYSTEM_ERROR
    });

    test('should create ConfigError with custom code', () => {
      const error = new ConfigError('Test error', 2);
      expect(error.code).toBe(2);
    });
  });
});