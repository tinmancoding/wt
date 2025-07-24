#!/usr/bin/env bun

/**
 * WT - Git Worktree Manager
 * Enhanced CLI tool for managing Git worktrees
 */

import { CLI } from './cli/index.ts';
import { version } from '../package.json';
import { listCommand, createCommand, configCommand, removeCommand, printDirCommand } from './commands/index.ts';

const cli = new CLI({
  name: 'wt',
  version,
  description: 'Git Worktree Manager - Enhanced CLI tool for managing Git worktrees'
});

// Register commands
cli.command(listCommand);
cli.command(createCommand);
cli.command(configCommand);
cli.command(removeCommand);
cli.command(printDirCommand);

try {
  await cli.run(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'An unknown error occurred');
  process.exit(1);
}