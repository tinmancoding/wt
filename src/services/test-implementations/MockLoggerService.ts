/**
 * Mock logger service for testing that captures all log messages
 */

import type { LoggerService } from '../types.ts';

export class MockLoggerService implements LoggerService {
  logs: Array<{level: string, message: string, args: any[]}> = [];

  log(message: string, ...args: any[]): void {
    this.logs.push({level: 'log', message, args});
  }

  error(message: string, ...args: any[]): void {
    this.logs.push({level: 'error', message, args});
  }

  warn(message: string, ...args: any[]): void {
    this.logs.push({level: 'warn', message, args});
  }

  info(message: string, ...args: any[]): void {
    this.logs.push({level: 'info', message, args});
  }

  debug(message: string, ...args: any[]): void {
    this.logs.push({level: 'debug', message, args});
  }

  getLogsByLevel(level: string): Array<{message: string, args: any[]}> {
    return this.logs
      .filter(log => log.level === level)
      .map(log => ({message: log.message, args: log.args}));
  }

  getAllLogs(): Array<{level: string, message: string, args: any[]}> {
    return [...this.logs];
  }

  clear(): void {
    this.logs = [];
  }

  hasLog(level: string, message: string): boolean {
    return this.logs.some(log => log.level === level && log.message === message);
  }

  hasLogContaining(level: string, messageSubstring: string): boolean {
    return this.logs.some(log => log.level === level && log.message.includes(messageSubstring));
  }
}