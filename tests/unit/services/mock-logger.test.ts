import { test, expect } from 'bun:test';
import { MockLoggerService } from '@/services/test-implementations/MockLoggerService.ts';

test('MockLoggerService captures log messages', () => {
  const logger = new MockLoggerService();
  
  logger.log('test message', 'arg1', 'arg2');
  
  const logs = logger.getLogsByLevel('log');
  expect(logs).toHaveLength(1);
  expect(logs[0]?.message).toBe('test message');
  expect(logs[0]?.args).toEqual(['arg1', 'arg2']);
});

test('MockLoggerService captures error messages', () => {
  const logger = new MockLoggerService();
  
  logger.error('error message', { code: 123 });
  
  const errors = logger.getLogsByLevel('error');
  expect(errors).toHaveLength(1);
  expect(errors[0]?.message).toBe('error message');
  expect(errors[0]?.args).toEqual([{ code: 123 }]);
});

test('MockLoggerService captures warn messages', () => {
  const logger = new MockLoggerService();
  
  logger.warn('warning message');
  
  const warnings = logger.getLogsByLevel('warn');
  expect(warnings).toHaveLength(1);
  expect(warnings[0]?.message).toBe('warning message');
  expect(warnings[0]?.args).toEqual([]);
});

test('MockLoggerService captures info messages', () => {
  const logger = new MockLoggerService();
  
  logger.info('info message', 'extra');
  
  const infos = logger.getLogsByLevel('info');
  expect(infos).toHaveLength(1);
  expect(infos[0]?.message).toBe('info message');
  expect(infos[0]?.args).toEqual(['extra']);
});

test('MockLoggerService captures debug messages', () => {
  const logger = new MockLoggerService();
  
  logger.debug('debug message');
  
  const debugs = logger.getLogsByLevel('debug');
  expect(debugs).toHaveLength(1);
  expect(debugs[0]?.message).toBe('debug message');
  expect(debugs[0]?.args).toEqual([]);
});

test('MockLoggerService getAllLogs returns all messages with levels', () => {
  const logger = new MockLoggerService();
  
  logger.log('log message');
  logger.error('error message');
  logger.warn('warn message');
  
  const allLogs = logger.getAllLogs();
  expect(allLogs).toHaveLength(3);
  expect(allLogs[0]).toEqual({ level: 'log', message: 'log message', args: [] });
  expect(allLogs[1]).toEqual({ level: 'error', message: 'error message', args: [] });
  expect(allLogs[2]).toEqual({ level: 'warn', message: 'warn message', args: [] });
});

test('MockLoggerService hasLog correctly identifies existing logs', () => {
  const logger = new MockLoggerService();
  
  logger.log('test message');
  logger.error('error message');
  
  expect(logger.hasLog('log', 'test message')).toBe(true);
  expect(logger.hasLog('error', 'error message')).toBe(true);
  expect(logger.hasLog('log', 'nonexistent message')).toBe(false);
  expect(logger.hasLog('warn', 'test message')).toBe(false);
});

test('MockLoggerService clear removes all logs', () => {
  const logger = new MockLoggerService();
  
  logger.log('message 1');
  logger.error('message 2');
  logger.warn('message 3');
  
  expect(logger.getAllLogs()).toHaveLength(3);
  
  logger.clear();
  
  expect(logger.getAllLogs()).toHaveLength(0);
  expect(logger.getLogsByLevel('log')).toHaveLength(0);
  expect(logger.getLogsByLevel('error')).toHaveLength(0);
  expect(logger.getLogsByLevel('warn')).toHaveLength(0);
});

test('MockLoggerService handles multiple messages of same level', () => {
  const logger = new MockLoggerService();
  
  logger.log('first log');
  logger.log('second log');
  logger.log('third log');
  
  const logs = logger.getLogsByLevel('log');
  expect(logs).toHaveLength(3);
  expect(logs[0]?.message).toBe('first log');
  expect(logs[1]?.message).toBe('second log');
  expect(logs[2]?.message).toBe('third log');
});

test('MockLoggerService preserves argument order and types', () => {
  const logger = new MockLoggerService();
  
  const obj = { key: 'value' };
  const arr = [1, 2, 3];
  const num = 42;
  const str = 'string';
  
  logger.log('complex message', obj, arr, num, str);
  
  const logs = logger.getLogsByLevel('log');
  expect(logs[0]?.args).toEqual([obj, arr, num, str]);
  expect(logs[0]?.args[0]).toBe(obj); // Same reference
  expect(logs[0]?.args[1]).toBe(arr); // Same reference
});

test('MockLoggerService getLogsByLevel returns empty array for unused levels', () => {
  const logger = new MockLoggerService();
  
  logger.log('only log message');
  
  expect(logger.getLogsByLevel('error')).toEqual([]);
  expect(logger.getLogsByLevel('warn')).toEqual([]);
  expect(logger.getLogsByLevel('info')).toEqual([]);
  expect(logger.getLogsByLevel('debug')).toEqual([]);
});