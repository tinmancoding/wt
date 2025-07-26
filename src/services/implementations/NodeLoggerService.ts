/**
 * Default Node.js logger service implementation using console
 */

import type { LoggerService } from '../types.ts';

export class NodeLoggerService implements LoggerService {
  log(message: string, ...args: any[]): void {
    console.log(message, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(message, ...args);
  }

  info(message: string, ...args: any[]): void {
    console.info(message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    console.debug(message, ...args);
  }
}