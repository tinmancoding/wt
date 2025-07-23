import type { Command } from '../cli/types.ts';

/**
 * List command - lists all worktrees
 */
export const listCommand: Command = {
  name: 'list',
  description: 'List all worktrees',
  aliases: ['ls'],
  handler: async () => {
    console.log('This will list worktrees');
  }
};

/**
 * Create command - creates a new worktree
 */
export const createCommand: Command = {
  name: 'create',
  description: 'Create a new worktree',
  args: [
    {
      name: 'branch',
      description: 'Branch name to create worktree for',
      required: true
    }
  ],
  handler: async ({ positional }) => {
    const branch = positional[0];
    if (!branch) {
      throw new Error('Branch name is required');
    }
    console.log(`This will create worktree for branch: ${branch}`);
  }
};