import type { ParsedArgs } from './types.ts';

/**
 * Argument parser for the CLI
 */
export class ArgumentParser {
  parse(args: string[]): ParsedArgs {
    const result: ParsedArgs = {
      flags: {},
      positional: []
    };

    let i = 0;
    while (i < args.length) {
      const arg = args[i];
      if (!arg) continue;
      
      if (arg.startsWith('--')) {
        // Long flag (--flag=value or --flag value)
        const flagName = arg.slice(2);
        if (flagName.includes('=')) {
          const [name, value] = flagName.split('=', 2);
          if (name && value !== undefined) {
            result.flags[name] = value;
          }
        } else {
          // Check if next argument is a value
          const nextArg = args[i + 1];
          if (nextArg && !nextArg.startsWith('-')) {
            result.flags[flagName] = nextArg;
            i++; // Skip next argument as it's consumed as value
          } else {
            result.flags[flagName] = true; // Boolean flag
          }
        }
      } else if (arg.startsWith('-') && arg.length > 1) {
        // Short flag (-f value or -f)
        const flagName = arg.slice(1);
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith('-')) {
          result.flags[flagName] = nextArg;
          i++; // Skip next argument as it's consumed as value
        } else {
          result.flags[flagName] = true; // Boolean flag
        }
      } else {
        // Positional argument or command
        if (!result.command && !arg.startsWith('-')) {
          result.command = arg;
        } else {
          result.positional.push(arg);
        }
      }
      i++;
    }

    return result;
  }

  /**
   * Check if help was requested
   */
  isHelpRequested(flags: Record<string, any>): boolean {
    return flags.help || flags.h;
  }

  /**
   * Check if version was requested
   */
  isVersionRequested(flags: Record<string, any>): boolean {
    return flags.version || flags.v;
  }
}