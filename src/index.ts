#!/usr/bin/env bun

/**
 * WT - Git Worktree Manager
 * Enhanced CLI tool for managing Git worktrees
 */

import { CLI } from './cli/index.ts';
import { version } from '../package.json';
import { createCommands } from './commands/index.ts';
import { createServiceContainer } from './services/container.ts';
import { EXIT_CODES } from './cli/types.ts';

async function main(): Promise<void> {
  try {
    // Create service container with default implementations
    const services = createServiceContainer();
    
    // Create commands with service injection
    const commands = createCommands(services);
    
    // Create CLI with logger service
    const cli = new CLI({
      name: 'wt',
      version,
      description: 'Git Worktree Manager - Enhanced CLI tool for managing Git worktrees'
    }, services.logger);

    // Register all commands
    for (const command of commands) {
      cli.command(command);
    }

    // Run CLI with arguments
    await cli.run(process.argv.slice(2));
  } catch (error) {
    // Handle special ExitCodeError for command-specific exit codes
    if (error instanceof Error && error.name === 'ExitCodeError') {
      const exitCodeError = error as any;
      process.exit(exitCodeError.exitCode);
    }
    
    // Use console.error here as last resort since services may not be available
    console.error(error instanceof Error ? error.message : 'An unknown error occurred');
    process.exit(EXIT_CODES.GENERAL_ERROR);
  }
}

// Run the main function
await main();