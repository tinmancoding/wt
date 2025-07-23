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

      // If no command specified and no version/help requested, show help
      if (!parsed.command) {
        console.log(this.help.generateMainHelp(Array.from(new Set(this.commands.values()))));
        process.exit(EXIT_CODES.SUCCESS);
      }

      // Find and execute command
      const command = this.commands.get(parsed.command);
      if (!command) {
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