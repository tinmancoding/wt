/**
 * Type definitions for the CLI framework
 */

export interface CLIConfig {
  name: string;
  version: string;
  description: string;
}

export interface Command {
  name: string;
  description: string;
  aliases?: string[];
  args?: ArgumentDefinition[];
  flags?: FlagDefinition[];
  handler: (context: CommandContext) => Promise<void> | void;
}

export interface ArgumentDefinition {
  name: string;
  description: string;
  required?: boolean;
}

export interface FlagDefinition {
  name: string;
  shortName?: string;
  description: string;
  type: 'boolean' | 'string' | 'number';
  default?: unknown;
}

export interface CommandContext {
  args: Record<string, string>;
  flags: Record<string, unknown>;
  positional: string[];
}

export interface ParsedArgs {
  command?: string;
  flags: Record<string, unknown>;
  positional: string[];
}

export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  INVALID_ARGUMENTS: 2,
  GIT_REPO_NOT_FOUND: 3,
  NETWORK_ERROR: 4,
  FILESYSTEM_ERROR: 5
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];