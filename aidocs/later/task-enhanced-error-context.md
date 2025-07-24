# Task: Enhanced Error Context and Messaging

## Priority: Medium

## Problem
Error messages throughout the codebase lack actionable context and suggestions for users to resolve issues. Current errors tell users what went wrong but not how to fix it.

## Current State
- Basic error messages like "Git repository not found"
- No suggestions for resolution in most error cases
- Missing contextual information about what user can do next
- Error handling exists but could be more helpful

## Examples of Current Issues
- Repository not found → should suggest `git init` or `wt init <url>`
- Configuration errors → should suggest valid config keys/values
- Git command failures → should provide troubleshooting steps
- Network errors → should suggest checking connectivity

## Impact
- Poor user experience when errors occur
- Users may not know how to resolve issues
- Reduced adoption due to unhelpful error messages
- More support requests due to unclear guidance

## Solution
1. Enhance RepositoryError messages with actionable suggestions
2. Improve ConfigError messages with examples of valid values
3. Add command suggestions to CLI error output
4. Include troubleshooting context in git command failures
5. Create consistent error message patterns with:
   - Clear description of what went wrong
   - Actionable next steps
   - Example commands where applicable

## Files Affected
- src/repository.ts (enhance RepositoryError messages)
- src/config.ts (improve ConfigError context)
- src/cli/cli.ts (add command suggestions)
- src/commands/index.ts (improve command error handling)