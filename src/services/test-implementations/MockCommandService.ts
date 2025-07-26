/**
 * Mock command service for testing with configurable command responses
 */

import type { CommandService, CommandResult } from '../types.ts';

export class MockCommandService implements CommandService {
  private commandResponses = new Map<string, CommandResult>();
  private executedCommands: Array<{command: string, args: string[], workDir: string, inheritStdio: boolean}> = [];
  
  // Configuration methods for tests
  setCommandResponse(command: string, args: string[], response: CommandResult): void {
    const key = `${command} ${args.join(' ')}`;
    this.commandResponses.set(key, response);
  }

  getExecutedCommands(): Array<{command: string, args: string[], workDir: string, inheritStdio: boolean}> {
    return [...this.executedCommands];
  }

  clear(): void {
    this.commandResponses.clear();
    this.executedCommands = [];
  }

  // CommandService implementation
  async execute(
    command: string,
    args: string[],
    workDir: string,
    inheritStdio = false
  ): Promise<CommandResult> {
    this.executedCommands.push({command, args, workDir, inheritStdio});
    
    const key = `${command} ${args.join(' ')}`;
    const response = this.commandResponses.get(key);
    
    if (response) {
      return response;
    }
    
    // Default success response
    return {
      exitCode: 0,
      stdout: '',
      stderr: ''
    };
  }
}