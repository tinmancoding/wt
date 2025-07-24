import { test, expect, describe } from 'bun:test';
import { 
  DEFAULT_CONFIG, 
  validateAndMergeConfig, 
  getConfigValue, 
  formatConfig,
  ConfigError
} from '../../src/config.ts';
import type { WTConfig, PartialWTConfig } from '../../src/config.ts';

describe('Configuration System', () => {
  describe('DEFAULT_CONFIG', () => {
    test('should have expected default values', () => {
      expect(DEFAULT_CONFIG).toEqual({
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
  });

  describe('validateAndMergeConfig', () => {
    test('should return default config for empty partial config', () => {
      const result = validateAndMergeConfig({});
      expect(result).toEqual(DEFAULT_CONFIG);
    });

    test('should merge partial config with defaults', () => {
      const partial: PartialWTConfig = {
        autoFetch: false,
        defaultBranch: 'develop'
      };

      const result = validateAndMergeConfig(partial);
      expect(result).toEqual({
        ...DEFAULT_CONFIG,
        autoFetch: false,
        defaultBranch: 'develop'
      });
    });

    test('should validate worktreeDir type', () => {
      expect(() => validateAndMergeConfig({ worktreeDir: 123 as any }))
        .toThrow(ConfigError);
    });

    test('should validate autoFetch type', () => {
      expect(() => validateAndMergeConfig({ autoFetch: 'true' as any }))
        .toThrow(ConfigError);
    });

    test('should validate confirmDelete type', () => {
      expect(() => validateAndMergeConfig({ confirmDelete: 'false' as any }))
        .toThrow(ConfigError);
    });

    test('should validate defaultBranch type', () => {
      expect(() => validateAndMergeConfig({ defaultBranch: 123 as any }))
        .toThrow(ConfigError);
    });

    test('should validate hooks object type', () => {
      expect(() => validateAndMergeConfig({ hooks: 'invalid' as any }))
        .toThrow(ConfigError);
    });

    test('should validate hooks.postCreate type', () => {
      expect(() => validateAndMergeConfig({ 
        hooks: { postCreate: 123 as any } 
      })).toThrow(ConfigError);
    });

    test('should validate hooks.postRemove type', () => {
      expect(() => validateAndMergeConfig({ 
        hooks: { postRemove: true as any } 
      })).toThrow(ConfigError);
    });

    test('should allow null hook values', () => {
      const result = validateAndMergeConfig({
        hooks: {
          postCreate: null,
          postRemove: null
        }
      });

      expect(result.hooks.postCreate).toBeNull();
      expect(result.hooks.postRemove).toBeNull();
    });

    test('should allow string hook values', () => {
      const result = validateAndMergeConfig({
        hooks: {
          postCreate: '/path/to/script.sh',
          postRemove: 'cleanup-command'
        }
      });

      expect(result.hooks.postCreate).toBe('/path/to/script.sh');
      expect(result.hooks.postRemove).toBe('cleanup-command');
    });
  });

  describe('getConfigValue', () => {
    const config: WTConfig = {
      ...DEFAULT_CONFIG,
      autoFetch: false,
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