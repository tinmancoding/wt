/**
 * Default Node.js command service implementation using spawn
 */

import { spawn } from 'node:child_process';
import type { CommandService, CommandResult } from '../types.ts';

export class NodeCommandService implements CommandService {
  async execute(
    command: string,
    args: string[],
    workDir: string,
    inheritStdio = false
  ): Promise<CommandResult> {
    return new Promise((resolve) => {
      const childProcess = spawn(command, args, {
        cwd: workDir,
        env: { ...process.env },
        stdio: inheritStdio ? 'inherit' : ['inherit', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      // Only collect output if not inheriting stdio
      if (!inheritStdio) {
        childProcess.stdout?.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        childProcess.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
      }

      // Forward signals to child process for proper handling
      const signalHandler = (signal: NodeJS.Signals) => {
        childProcess.kill(signal);
      };

      process.on('SIGINT', signalHandler);
      process.on('SIGTERM', signalHandler);

      childProcess.on('close', (code: number | null) => {
        // Clean up signal handlers
        process.off('SIGINT', signalHandler);
        process.off('SIGTERM', signalHandler);

        resolve({
          exitCode: code ?? -1,
          stdout,
          stderr
        });
      });

      childProcess.on('error', (error: Error) => {
        // Clean up signal handlers
        process.off('SIGINT', signalHandler);
        process.off('SIGTERM', signalHandler);

        resolve({
          exitCode: -1,
          stdout,
          stderr: `Process error: ${error.message}`
        });
      });
    });
  }
}