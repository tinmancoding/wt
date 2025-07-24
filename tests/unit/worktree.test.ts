import { test, expect, describe } from 'bun:test';
import { formatWorktree, formatWorktreeHeader, type WorktreeInfo } from '../../src/worktree.ts';

describe('Worktree Module', () => {
  describe('formatWorktreeHeader', () => {
    test('should return properly formatted header', () => {
      const header = formatWorktreeHeader();
      expect(header).toBe('  Name                 Branch                    Path');
    });
  });

  describe('formatWorktree', () => {
    test('should format current worktree with asterisk', () => {
      const worktree: WorktreeInfo = {
        path: '/project/main',
        branch: 'main',
        commit: 'abc123def456',
        isCurrent: true,
        isBare: false,
        isDetached: false,
        isLocked: false,
        relativePath: '.'
      };

      const formatted = formatWorktree(worktree);
      expect(formatted).toBe('* main                 main                      .');
    });

    test('should format non-current worktree with space', () => {
      const worktree: WorktreeInfo = {
        path: '/project/feature',
        branch: 'feature-branch',
        commit: 'def456abc123',
        isCurrent: false,
        isBare: false,
        isDetached: false,
        isLocked: false,
        relativePath: '../feature'
      };

      const formatted = formatWorktree(worktree);
      expect(formatted).toBe('  feature              feature-branch            ../feature');
    });

    test('should format bare worktree with [bare] status', () => {
      const worktree: WorktreeInfo = {
        path: '/project/.bare',
        branch: 'unknown',
        commit: '',
        isCurrent: false,
        isBare: true,
        isDetached: false,
        isLocked: false,
        relativePath: '.bare'
      };

      const formatted = formatWorktree(worktree);
      expect(formatted).toBe('  .bare                unknown                   .bare [bare]');
    });

    test('should format detached worktree with commit hash and [detached] status', () => {
      const worktree: WorktreeInfo = {
        path: '/project/detached',
        branch: 'HEAD',
        commit: 'abc123def456789',
        isCurrent: false,
        isBare: false,
        isDetached: true,
        isLocked: false,
        relativePath: '../detached'
      };

      const formatted = formatWorktree(worktree);
      expect(formatted).toBe('  detached             (abc123d)                 ../detached [detached]');
    });

    test('should format locked worktree with [locked] status', () => {
      const worktree: WorktreeInfo = {
        path: '/project/locked',
        branch: 'feature',
        commit: 'def456abc123',
        isCurrent: false,
        isBare: false,
        isDetached: false,
        isLocked: true,
        relativePath: '../locked'
      };

      const formatted = formatWorktree(worktree);
      expect(formatted).toBe('  locked               feature                   ../locked [locked]');
    });

    test('should format worktree with multiple status indicators', () => {
      const worktree: WorktreeInfo = {
        path: '/project/complex',
        branch: 'HEAD',
        commit: 'abc123def456',
        isCurrent: false,
        isBare: false,
        isDetached: true,
        isLocked: true,
        relativePath: '../complex'
      };

      const formatted = formatWorktree(worktree);
      expect(formatted).toBe('  complex              (abc123d)                 ../complex [locked] [detached]');
    });

    test('should handle long branch names properly', () => {
      const worktree: WorktreeInfo = {
        path: '/project/very-long-feature-branch-name',
        branch: 'very-long-feature-branch-name-that-exceeds-normal-length',
        commit: 'abc123def456',
        isCurrent: false,
        isBare: false,
        isDetached: false,
        isLocked: false,
        relativePath: '../very-long-feature-branch-name'
      };

      const formatted = formatWorktree(worktree);
      expect(formatted).toContain('very-long-feature-branch-name-that-exceeds-normal-length');
      expect(formatted).toContain('../very-long-feature-branch-name');
    });
  });
});