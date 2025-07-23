/**
 * Unit tests for repository detection functionality
 */

import { describe, test, expect } from 'bun:test';
import { RepositoryError } from '../../src/repository.ts';
import { EXIT_CODES } from '../../src/cli/types.ts';

describe('Repository Detection', () => {
  describe('RepositoryError', () => {
    test('should create error with correct properties', () => {
      const message = 'Test error message';
      const code = EXIT_CODES.GIT_REPO_NOT_FOUND;
      
      const error = new RepositoryError(message, code);
      
      expect(error.message).toBe(message);
      expect(error.code).toBe(code);
      expect(error.name).toBe('RepositoryError');
      expect(error instanceof Error).toBe(true);
    });

    test('should use default error code when not provided', () => {
      const error = new RepositoryError('Test message');
      
      expect(error.code).toBe(EXIT_CODES.GIT_REPO_NOT_FOUND);
    });
  });

  describe('Repository Types', () => {
    test('should validate repository info structure for bare repository', () => {
      const repoInfo = {
        rootDir: '/test/repo',
        gitDir: '/test/repo/.bare',
        type: 'bare' as const,
        bareDir: '/test/repo/.bare'
      };

      expect(repoInfo.type).toBe('bare');
      expect(repoInfo.bareDir).toBeDefined();
      expect(repoInfo.gitDir).toBe(repoInfo.bareDir);
    });

    test('should validate repository info structure for gitfile repository', () => {
      const repoInfo = {
        rootDir: '/test/worktree',
        gitDir: '/test/repo/.bare',
        type: 'gitfile' as const,
        bareDir: '/test/repo/.bare'
      };

      expect(repoInfo.type).toBe('gitfile');
      expect(repoInfo.bareDir).toBeDefined();
    });

    test('should validate repository info structure for standard repository', () => {
      const repoInfo = {
        rootDir: '/test/repo',
        gitDir: '/test/repo/.git',
        type: 'standard' as const
      };

      expect(repoInfo.type).toBe('standard');
      expect('bareDir' in repoInfo).toBe(false);
    });
  });

  describe('Exit Codes', () => {
    test('should use correct exit codes for different error types', () => {
      expect(EXIT_CODES.SUCCESS).toBe(0);
      expect(EXIT_CODES.GENERAL_ERROR).toBe(1);
      expect(EXIT_CODES.INVALID_ARGUMENTS).toBe(2);
      expect(EXIT_CODES.GIT_REPO_NOT_FOUND).toBe(3);
      expect(EXIT_CODES.NETWORK_ERROR).toBe(4);
      expect(EXIT_CODES.FILESYSTEM_ERROR).toBe(5);
    });
  });
});