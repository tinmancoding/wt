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
    let commandCandidate = false; // Track if first non-flag arg could be a command
    
    // Check if first non-empty argument could be a command (doesn't start with -)
    for (let j = 0; j < args.length; j++) {
      const arg = args[j];
      if (arg && arg.trim()) {
        if (!arg.startsWith('-')) {
          commandCandidate = true;
        }
        break;
      }
    }

    while (i < args.length) {
      const arg = args[i];
      
      // Skip falsy arguments but increment counter to avoid infinite loop
      if (!arg) {
        i++;
        continue;
      }
      
      if (arg.startsWith('--')) {
        // Long flag (--flag=value or --flag value)
        const flagName = arg.slice(2);
        if (flagName.includes('=')) {
          const [name, value] = flagName.split('=', 2);
          if (name && value !== undefined) {
            result.flags[name] = value;
          }
        } else {
          // Check if next argument should be consumed as flag value
          const nextArg = args[i + 1];
          if (nextArg && !nextArg.startsWith('-') && nextArg.trim() && result.command) {
            // Only consume as flag value if we already have a command
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
        if (nextArg && !nextArg.startsWith('-') && nextArg.trim() && result.command) {
          // Only consume as flag value if we already have a command
          result.flags[flagName] = nextArg;
          i++; // Skip next argument as it's consumed as value
        } else {
          result.flags[flagName] = true; // Boolean flag
        }
      } else {
        // Positional argument or command
        if (!result.command && commandCandidate && !arg.startsWith('-')) {
          // This could be a command if:
          // 1. We don't have a command yet
          // 2. The first non-empty arg was a potential command
          // 3. This arg doesn't start with -
          result.command = arg;
        } else {
          // Everything else is positional
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
    return !!(flags.help || flags.h);
  }

  /**
   * Check if version was requested
   */
  isVersionRequested(flags: Record<string, any>): boolean {
    return !!(flags.version || flags.v);
  }
}