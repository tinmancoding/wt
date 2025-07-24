import type { CLIConfig, Command, CommandContext } from './types.ts';
import { EXIT_CODES } from './types.ts';
import { ArgumentParser } from './parser.ts';
import { HelpSystem } from './help.ts';

/**
 * Main CLI class that handles command registration and execution
 */
export class CLI {
  private commands: Map<string, Command> = new Map();
  private parser = new ArgumentParser();
  private help: HelpSystem;

  constructor(private config: CLIConfig) {
    this.help = new HelpSystem(config);
  }

  /**
   * Register a command
   */
  command(command: Command): this {
    this.commands.set(command.name, command);
    
    // Register aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.commands.set(alias, command);
      }
    }
    
    return this;
  }

  /**
   * Run the CLI with given arguments
   */
  async run(args: string[]): Promise<void> {
    try {
      const parsed = this.parser.parse(args);

      // Handle global flags first - these take priority over everything
      if (this.parser.isVersionRequested(parsed.flags)) {
        console.log(this.help.generateVersion());
        process.exit(EXIT_CODES.SUCCESS);
      }

      if (this.parser.isHelpRequested(parsed.flags)) {
        if (parsed.command) {
          const command = this.commands.get(parsed.command);
          if (command) {
            console.log(this.help.generateCommandHelp(command));
          } else {
            console.error(`Unknown command: ${parsed.command}`);
            process.exit(EXIT_CODES.INVALID_ARGUMENTS);
          }
        } else {
          console.log(this.help.generateMainHelp(Array.from(new Set(this.commands.values()))));
        }
        process.exit(EXIT_CODES.SUCCESS);
      }

      // If no command specified and no version/help requested
      if (!parsed.command) {
        // If there are positional arguments, treat as switch pattern
        if (parsed.positional.length > 0) {
          // Treat first positional argument as pattern for switching
          const switchCommand = this.commands.get('switch');
          if (switchCommand) {
            const context: CommandContext = {
              args: {},
              flags: parsed.flags,
              positional: parsed.positional
            };
            await switchCommand.handler(context);
            return;
          }
        }
        
        // Otherwise show help
        console.log(this.help.generateMainHelp(Array.from(new Set(this.commands.values()))));
        process.exit(EXIT_CODES.SUCCESS);
      }

      // Find and execute command
      const command = this.commands.get(parsed.command);
      if (!command) {
        // If command doesn't exist, check if it might be a switch pattern
        const switchCommand = this.commands.get('switch');
        if (switchCommand && parsed.command) {
          // Treat the unknown command as a switch pattern
          const context: CommandContext = {
            args: {},
            flags: parsed.flags,
            positional: [parsed.command, ...parsed.positional]
          };
          await switchCommand.handler(context);
          return;
        }
        
        console.error(`Unknown command: ${parsed.command}`);
        console.error(`Run '${this.config.name} --help' for available commands.`);
        process.exit(EXIT_CODES.INVALID_ARGUMENTS);
      }

      // Prepare command context
      const context: CommandContext = {
        args: {},
        flags: parsed.flags,
        positional: parsed.positional
      };

      // Execute command
      await command.handler(context);
      
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Handle errors with appropriate exit codes
   */
  private handleError(error: unknown): void {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      
      // Map specific error types to exit codes
      if (error.message.includes('repository not found') || error.message.includes('not a git repository')) {
        process.exit(EXIT_CODES.GIT_REPO_NOT_FOUND);
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        process.exit(EXIT_CODES.NETWORK_ERROR);
      } else if (error.message.includes('file') || error.message.includes('directory')) {
        process.exit(EXIT_CODES.FILESYSTEM_ERROR);
      } else {
        process.exit(EXIT_CODES.GENERAL_ERROR);
      }
    } else {
      console.error('An unknown error occurred');
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  }
}