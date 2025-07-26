/**
 * Silent logger service for testing that discards all output
 */

import type { LoggerService } from '../types.ts';

export class SilentLoggerService implements LoggerService {
  log(): void {}
  error(): void {}
  warn(): void {}
  info(): void {}
  debug(): void {}
}