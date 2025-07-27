/**
 * Silent logger service for testing that discards all output
 */

import type { LoggerService } from '../types.ts';

export class SilentLoggerService implements LoggerService {
  log(_message: string, ..._args: any[]): void {}
  error(_message: string, ..._args: any[]): void {}
  warn(_message: string, ..._args: any[]): void {}
  info(_message: string, ..._args: any[]): void {}
  debug(_message: string, ..._args: any[]): void {}
}