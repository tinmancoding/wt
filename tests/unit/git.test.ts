import { test, expect } from 'bun:test';
import { GitError } from '../../src/git.ts';

test('GitError - proper error construction', () => {
  const error = new GitError('Test message', 'stderr output', 1, 5);
  
  expect(error.name).toBe('GitError');
  expect(error.message).toBe('Test message');
  expect(error.stderr).toBe('stderr output');
  expect(error.exitCode).toBe(1);
  expect(error.code).toBe(5);
  expect(error).toBeInstanceOf(Error);
});

test('GitError - default code', () => {
  const error = new GitError('Test message', 'stderr output', 1);
  
  expect(error.code).toBe(1); // EXIT_CODES.GENERAL_ERROR
});

test('GitError - inherits from Error', () => {
  const error = new GitError('Test message', 'stderr output', 1);
  
  expect(error instanceof Error).toBe(true);
  expect(error instanceof GitError).toBe(true);
});

test('GitError - serializes properly', () => {
  const error = new GitError('Test message', 'stderr output', 1, 5);
  
  expect(error.toString()).toContain('GitError: Test message');
});