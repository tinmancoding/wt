import { test, expect } from 'bun:test';
import { validateAndParseGitUrl, RepositoryInitError, NetworkError } from '../../src/init.ts';
import { EXIT_CODES } from '../../src/cli/types.ts';

// Test validateAndParseGitUrl function
test('validateAndParseGitUrl - HTTP URL', () => {
  const result = validateAndParseGitUrl('https://github.com/user/repo.git');
  
  expect(result.url).toBe('https://github.com/user/repo.git');
  expect(result.name).toBe('repo');
});

test('validateAndParseGitUrl - HTTP URL without .git', () => {
  const result = validateAndParseGitUrl('https://github.com/user/myproject');
  
  expect(result.url).toBe('https://github.com/user/myproject');
  expect(result.name).toBe('myproject');
});

test('validateAndParseGitUrl - SSH URL', () => {
  const result = validateAndParseGitUrl('git@github.com:user/repo.git');
  
  expect(result.url).toBe('git@github.com:user/repo.git');
  expect(result.name).toBe('repo');
});

test('validateAndParseGitUrl - SSH URL without .git', () => {
  const result = validateAndParseGitUrl('git@github.com:user/myproject');
  
  expect(result.url).toBe('git@github.com:user/myproject');
  expect(result.name).toBe('myproject');
});

test('validateAndParseGitUrl - local file path', () => {
  const result = validateAndParseGitUrl('/path/to/repo.git');
  
  expect(result.url).toBe('/path/to/repo.git');
  expect(result.name).toBe('repo');
});

test('validateAndParseGitUrl - relative path', () => {
  const result = validateAndParseGitUrl('./myproject');
  
  expect(result.url).toBe('./myproject');
  expect(result.name).toBe('myproject');
});

test('validateAndParseGitUrl - empty string', () => {
  expect(() => validateAndParseGitUrl('')).toThrow(RepositoryInitError);
  expect(() => validateAndParseGitUrl('')).toThrow('Repository URL is required');
});

test('validateAndParseGitUrl - null/undefined', () => {
  expect(() => validateAndParseGitUrl(null as any)).toThrow(RepositoryInitError);
  expect(() => validateAndParseGitUrl(undefined as any)).toThrow(RepositoryInitError);
});

test('validateAndParseGitUrl - whitespace only', () => {
  expect(() => validateAndParseGitUrl('   ')).toThrow(RepositoryInitError);
  expect(() => validateAndParseGitUrl('   ')).toThrow('Repository URL cannot be empty');
});

test('validateAndParseGitUrl - complex GitHub URL', () => {
  const result = validateAndParseGitUrl('https://github.com/org/very-long-project-name.git');
  
  expect(result.url).toBe('https://github.com/org/very-long-project-name.git');
  expect(result.name).toBe('very-long-project-name');
});

test('validateAndParseGitUrl - invalid HTTP URL', () => {
  expect(() => validateAndParseGitUrl('https://github.com/')).toThrow(RepositoryInitError);
  expect(() => validateAndParseGitUrl('https://github.com/')).toThrow('Invalid repository path in URL');
});

test('validateAndParseGitUrl - invalid SSH format', () => {
  expect(() => validateAndParseGitUrl('git@github.com')).toThrow(RepositoryInitError);
  expect(() => validateAndParseGitUrl('git@github.com')).toThrow('Invalid repository name extracted from URL');
});

test('validateAndParseGitUrl - SSH URL without path', () => {
  expect(() => validateAndParseGitUrl('git@github.com:')).toThrow(RepositoryInitError);
  expect(() => validateAndParseGitUrl('git@github.com:')).toThrow('Invalid SSH URL format');
});

// Test RepositoryInitError class
test('RepositoryInitError - default code', () => {
  const error = new RepositoryInitError('Test message');
  
  expect(error.name).toBe('RepositoryInitError');
  expect(error.message).toBe('Test message');
  expect(error.code).toBe(EXIT_CODES.GENERAL_ERROR);
  expect(error).toBeInstanceOf(Error);
});

test('RepositoryInitError - custom code', () => {
  const error = new RepositoryInitError('Test message', EXIT_CODES.INVALID_ARGUMENTS);
  
  expect(error.code).toBe(EXIT_CODES.INVALID_ARGUMENTS);
});

// Test NetworkError class
test('NetworkError - inherits from RepositoryInitError', () => {
  const error = new NetworkError('Network test message');
  
  expect(error.name).toBe('NetworkError');
  expect(error.message).toBe('Network test message');
  expect(error.code).toBe(EXIT_CODES.NETWORK_ERROR);
  expect(error).toBeInstanceOf(RepositoryInitError);
  expect(error).toBeInstanceOf(Error);
});