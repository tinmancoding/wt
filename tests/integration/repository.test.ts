/**
 * Integration tests for repository detection functionality
 * These tests create real file structures to test the actual implementation
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdir, writeFile, rm, access, constants } from 'node:fs/promises';
import { join } from 'node:path';
import { detectRepository, validateRepository, RepositoryError } from '../../src/repository.ts';

// Test directory setup - use /tmp to avoid being inside a git repository
const TEST_BASE_DIR = '/tmp/wt-test-repos';

async function createTestDir(name: string): Promise<string> {
  const dir = join(TEST_BASE_DIR, name);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

describe('Repository Detection Integration', () => {
  beforeEach(async () => {
    // Clean up any existing test directories
    if (await pathExists(TEST_BASE_DIR)) {
      await rm(TEST_BASE_DIR, { recursive: true, force: true });
    }
    await mkdir(TEST_BASE_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directories
    if (await pathExists(TEST_BASE_DIR)) {
      await rm(TEST_BASE_DIR, { recursive: true, force: true });
    }
  });

  describe('detectRepository integration', () => {
    test('should detect bare repository with .bare directory', async () => {
      const repoDir = await createTestDir('bare-repo');
      const bareDir = join(repoDir, '.bare');
      const configFile = join(bareDir, 'config');
      
      // Create .bare directory structure
      await mkdir(bareDir);
      await writeFile(configFile, '[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = true');

      const result = await detectRepository(repoDir);

      expect(result.type).toBe('bare');
      expect(result.rootDir).toBe(repoDir);
      expect(result.gitDir).toBe(bareDir);
      expect(result.bareDir).toBe(bareDir);
    });

    test('should detect gitfile repository pointing to .bare', async () => {
      const repoDir = await createTestDir('gitfile-repo');
      const worktreeDir = join(repoDir, 'worktree');
      const bareDir = join(repoDir, '.bare');
      const gitFile = join(worktreeDir, '.git');
      const configFile = join(bareDir, 'config');

      // Create bare repository
      await mkdir(bareDir, { recursive: true });
      await writeFile(configFile, '[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = true');

      // Create worktree with .git file pointing to .bare
      await mkdir(worktreeDir, { recursive: true });
      await writeFile(gitFile, `gitdir: ../.bare`);

      const result = await detectRepository(worktreeDir);

      expect(result.type).toBe('gitfile');
      expect(result.rootDir).toBe(worktreeDir);
      expect(result.gitDir).toBe(bareDir);
      expect(result.bareDir).toBe(bareDir);
    });

    test('should detect standard git repository', async () => {
      const repoDir = await createTestDir('standard-repo');
      const gitDir = join(repoDir, '.git');
      const configFile = join(gitDir, 'config');

      // Create standard .git directory
      await mkdir(gitDir);
      await writeFile(configFile, '[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false');

      const result = await detectRepository(repoDir);

      expect(result.type).toBe('standard');
      expect(result.rootDir).toBe(repoDir);
      expect(result.gitDir).toBe(gitDir);
      expect(result.bareDir).toBeUndefined();
    });

    test('should walk up directory tree to find repository', async () => {
      const repoDir = await createTestDir('tree-walk-repo');
      const bareDir = join(repoDir, '.bare');
      const subDir = join(repoDir, 'deep', 'nested', 'directory');
      const configFile = join(bareDir, 'config');

      // Create bare repository at root
      await mkdir(bareDir);
      await writeFile(configFile, '[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = true');

      // Create deep nested directory
      await mkdir(subDir, { recursive: true });

      const result = await detectRepository(subDir);

      expect(result.type).toBe('bare');
      expect(result.rootDir).toBe(repoDir);
      expect(result.gitDir).toBe(bareDir);
    });

    test('should throw RepositoryError when no repository found', async () => {
      const nonRepoDir = await createTestDir('not-a-repo');

      await expect(detectRepository(nonRepoDir)).rejects.toThrow(RepositoryError);
      await expect(detectRepository(nonRepoDir)).rejects.toThrow('No Git repository found');
    });

    test('should handle gitfile with absolute path', async () => {
      const repoDir = await createTestDir('gitfile-absolute-repo');
      const worktreeDir = join(repoDir, 'worktree');
      const bareDir = join(repoDir, 'separate', '.bare');
      const gitFile = join(worktreeDir, '.git');
      const configFile = join(bareDir, 'config');

      // Create bare repository in separate location
      await mkdir(bareDir, { recursive: true });
      await writeFile(configFile, '[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = true');

      // Create worktree with .git file pointing to absolute path
      await mkdir(worktreeDir, { recursive: true });
      await writeFile(gitFile, `gitdir: ${bareDir}`);

      const result = await detectRepository(worktreeDir);

      expect(result.type).toBe('gitfile');
      expect(result.gitDir).toBe(bareDir);
      expect(result.bareDir).toBe(bareDir);
    });

    test('should handle malformed gitfile gracefully', async () => {
      const repoDir = await createTestDir('malformed-gitfile-repo');
      const gitFile = join(repoDir, '.git');

      // Create malformed .git file
      await writeFile(gitFile, 'invalid content without gitdir');

      await expect(detectRepository(repoDir)).rejects.toThrow(RepositoryError);
    });
  });

  describe('validateRepository integration', () => {
    test('should validate bare repository successfully', async () => {
      const repoDir = await createTestDir('validate-bare-repo');
      const bareDir = join(repoDir, '.bare');
      const configFile = join(bareDir, 'config');

      await mkdir(bareDir);
      await writeFile(configFile, '[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = true');

      const repoInfo = {
        rootDir: repoDir,
        gitDir: bareDir,
        type: 'bare' as const,
        bareDir: bareDir
      };

      // Should not throw
      await expect(validateRepository(repoInfo)).resolves.toBeUndefined();
    });

    test('should validate standard repository successfully', async () => {
      const repoDir = await createTestDir('validate-standard-repo');
      const gitDir = join(repoDir, '.git');

      await mkdir(gitDir);

      const repoInfo = {
        rootDir: repoDir,
        gitDir: gitDir,
        type: 'standard' as const
      };

      // Should not throw
      await expect(validateRepository(repoInfo)).resolves.toBeUndefined();
    });

    test('should throw error when git directory does not exist', async () => {
      const repoDir = await createTestDir('validate-missing-git-repo');

      const repoInfo = {
        rootDir: repoDir,
        gitDir: join(repoDir, '.git'),
        type: 'standard' as const
      };

      await expect(validateRepository(repoInfo)).rejects.toThrow(RepositoryError);
      await expect(validateRepository(repoInfo)).rejects.toThrow('Git directory not found');
    });

    test('should throw error when bare repository config is missing', async () => {
      const repoDir = await createTestDir('validate-incomplete-bare-repo');
      const bareDir = join(repoDir, '.bare');

      // Create .bare directory but no config file
      await mkdir(bareDir);

      const repoInfo = {
        rootDir: repoDir,
        gitDir: bareDir,
        type: 'bare' as const,
        bareDir: bareDir
      };

      await expect(validateRepository(repoInfo)).rejects.toThrow(RepositoryError);
      await expect(validateRepository(repoInfo)).rejects.toThrow('Invalid bare repository');
    });
  });

  describe('Real world scenarios', () => {
    test('should handle complex worktree setup like WT project itself', async () => {
      const repoDir = await createTestDir('wt-like-repo');
      const bareDir = join(repoDir, '.bare');
      const mainWorktree = join(repoDir, 'main');
      const featureWorktree = join(repoDir, 'feature-branch');
      
      // Create bare repository
      await mkdir(bareDir, { recursive: true });
      await writeFile(join(bareDir, 'config'), '[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = true');
      
      // Create worktree directories
      await mkdir(mainWorktree, { recursive: true });
      await mkdir(featureWorktree, { recursive: true });
      
      // Create .git files in worktrees
      await writeFile(join(mainWorktree, '.git'), 'gitdir: ../.bare/worktrees/main');
      await writeFile(join(featureWorktree, '.git'), 'gitdir: ../.bare/worktrees/feature-branch');
      
      // Create worktree git directories (simulate git worktree structure)
      await mkdir(join(bareDir, 'worktrees', 'main'), { recursive: true });
      await mkdir(join(bareDir, 'worktrees', 'feature-branch'), { recursive: true });

      // Test detection from bare repo root
      const bareResult = await detectRepository(repoDir);
      expect(bareResult.type).toBe('bare');
      expect(bareResult.rootDir).toBe(repoDir);

      // Test detection from main worktree
      const mainResult = await detectRepository(mainWorktree);
      expect(mainResult.type).toBe('gitfile');
      expect(mainResult.rootDir).toBe(mainWorktree);

      // Test detection from feature worktree
      const featureResult = await detectRepository(featureWorktree);
      expect(featureResult.type).toBe('gitfile');
      expect(featureResult.rootDir).toBe(featureWorktree);

      // Test detection from subdirectory of worktree
      const subDir = join(mainWorktree, 'src', 'deep');
      await mkdir(subDir, { recursive: true });
      const subResult = await detectRepository(subDir);
      expect(subResult.type).toBe('gitfile');
      expect(subResult.rootDir).toBe(mainWorktree);
    });
  });
});