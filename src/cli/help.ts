import type { CLIConfig, Command } from './types.ts';

/**
 * Help system for generating usage information
 */
export class HelpSystem {
  constructor(private config: CLIConfig) {}

  /**
   * Generate main help message
   */
  generateMainHelp(commands: Command[]): string {
    const lines = [
      `${this.config.name} v${this.config.version}`,
      this.config.description,
      '',
      'Usage:',
      `  ${this.config.name} [command] [options]`,
      `  ${this.config.name} [pattern]                    # Fuzzy switch to worktree`,
      '',
      'Commands:'
    ];

    // Add commands
    for (const command of commands) {
      const aliases = command.aliases ? ` (${command.aliases.join(', ')})` : '';
      lines.push(`  ${command.name.padEnd(20)}${aliases.padEnd(15)} ${command.description}`);
    }

    lines.push(
      '',
      'Global Options:',
      '  -h, --help                    Show help',
      '  -v, --version                 Show version',
      '',
      'Examples:',
      `  ${this.config.name} create feature-branch      # Create worktree for feature-branch`,
      `  ${this.config.name} feat                       # Switch to worktree matching "feat"`,
      `  ${this.config.name} pr 123                     # Create worktree from PR #123`,
      `  ${this.config.name} list                       # List all worktrees`,
      `  ${this.config.name} --help                     # Show this help`,
      '',
      `Run '${this.config.name} <command> --help' for more information on a command.`
    );

    return lines.join('\n');
  }

  /**
   * Generate command-specific help
   */
  generateCommandHelp(command: Command): string {
    const lines = [
      command.description,
      '',
      'Usage:'
    ];

    // Build usage line
    let usage = `  ${this.config.name} ${command.name}`;
    
    if (command.args && command.args.length > 0) {
      for (const arg of command.args) {
        if (arg.required) {
          usage += ` <${arg.name}>`;
        } else {
          usage += ` [${arg.name}]`;
        }
      }
    }
    
    if (command.flags && command.flags.length > 0) {
      usage += ' [options]';
    }
    
    lines.push(usage);

    // Add aliases
    if (command.aliases && command.aliases.length > 0) {
      lines.push('', 'Aliases:', `  ${command.aliases.join(', ')}`);
    }

    // Add arguments
    if (command.args && command.args.length > 0) {
      lines.push('', 'Arguments:');
      for (const arg of command.args) {
        const required = arg.required ? ' (required)' : ' (optional)';
        lines.push(`  ${arg.name.padEnd(20)} ${arg.description}${required}`);
      }
    }

    // Add flags
    if (command.flags && command.flags.length > 0) {
      lines.push('', 'Options:');
      for (const flag of command.flags) {
        let flagStr = `  `;
        if (flag.shortName) {
          flagStr += `-${flag.shortName}, `;
        }
        flagStr += `--${flag.name}`;
        
        if (flag.type !== 'boolean') {
          flagStr += ` <${flag.type}>`;
        }
        
        let description = flag.description;
        if (flag.default !== undefined) {
          description += ` [default: ${flag.default}]`;
        }
        
        lines.push(`${flagStr.padEnd(30)} ${description}`);
      }
    }

    // Add global options
    lines.push(
      '',
      'Global Options:',
      '  -h, --help                    Show help',
      '  -v, --version                 Show version'
    );

    return lines.join('\n');
  }

  /**
   * Generate version information
   */
  generateVersion(): string {
    return `${this.config.name} v${this.config.version}`;
  }
}