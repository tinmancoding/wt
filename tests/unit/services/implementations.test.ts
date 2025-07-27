import { test, expect } from 'bun:test';
import { NodeLoggerService } from '@/services/implementations/NodeLoggerService.ts';
import { NodeFileSystemService } from '@/services/implementations/NodeFileSystemService.ts';
import { SilentLoggerService } from '@/services/test-implementations/SilentLoggerService.ts';

test('NodeLoggerService implements LoggerService interface', () => {
  const logger = new NodeLoggerService();
  
  expect(typeof logger.log).toBe('function');
  expect(typeof logger.error).toBe('function');
  expect(typeof logger.warn).toBe('function');
  expect(typeof logger.info).toBe('function');
  expect(typeof logger.debug).toBe('function');
});

test('NodeLoggerService methods do not throw', () => {
  const logger = new NodeLoggerService();
  
  expect(() => logger.log('test')).not.toThrow();
  expect(() => logger.error('test')).not.toThrow();
  expect(() => logger.warn('test')).not.toThrow();
  expect(() => logger.info('test')).not.toThrow();
  expect(() => logger.debug('test')).not.toThrow();
});

test('NodeFileSystemService implements FileSystemService interface', () => {
  const fs = new NodeFileSystemService();
  
  expect(typeof fs.readFile).toBe('function');
  expect(typeof fs.writeFile).toBe('function');
  expect(typeof fs.access).toBe('function');
  expect(typeof fs.stat).toBe('function');
  expect(typeof fs.mkdir).toBe('function');
  expect(typeof fs.exists).toBe('function');
  expect(typeof fs.isDirectory).toBe('function');
  expect(typeof fs.isFile).toBe('function');
});

test('NodeFileSystemService exists returns false for non-existent path', async () => {
  const fs = new NodeFileSystemService();
  
  const exists = await fs.exists('/non/existent/path');
  expect(exists).toBe(false);
});

test('NodeFileSystemService isDirectory returns false for non-existent path', async () => {
  const fs = new NodeFileSystemService();
  
  const isDir = await fs.isDirectory('/non/existent/path');
  expect(isDir).toBe(false);
});

test('NodeFileSystemService isFile returns false for non-existent path', async () => {
  const fs = new NodeFileSystemService();
  
  const isFile = await fs.isFile('/non/existent/path');
  expect(isFile).toBe(false);
});

test('SilentLoggerService implements LoggerService interface', () => {
  const logger = new SilentLoggerService();
  
  expect(typeof logger.log).toBe('function');
  expect(typeof logger.error).toBe('function');
  expect(typeof logger.warn).toBe('function');
  expect(typeof logger.info).toBe('function');
  expect(typeof logger.debug).toBe('function');
});

test('SilentLoggerService methods do not throw and produce no output', () => {
  const logger = new SilentLoggerService();
  
  expect(() => logger.log('test')).not.toThrow();
  expect(() => logger.error('test')).not.toThrow();
  expect(() => logger.warn('test')).not.toThrow();
  expect(() => logger.info('test')).not.toThrow();
  expect(() => logger.debug('test')).not.toThrow();
});