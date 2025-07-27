#!/usr/bin/env bun

/**
 * Release Script
 * Updates package.json version and creates matching git tag
 * 
 * Usage:
 *   bun run release                    # Auto-increment patch version
 *   bun run release patch              # Auto-increment patch version
 *   bun run release minor              # Auto-increment minor version
 *   bun run release major              # Auto-increment major version
 *   bun run release 1.2.3              # Set specific version
 *   bun run release --dry-run          # Preview changes without applying
 */

import { readFile, writeFile } from 'fs/promises';
import { spawn } from 'child_process';
import { join } from 'path';

interface PackageJson {
  version: string;
  [key: string]: any;
}

class ReleaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReleaseError';
  }
}

async function executeCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'pipe' });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (exitCode) => {
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: exitCode || 0 });
    });
  });
}

async function checkGitStatus(): Promise<void> {
  const { stdout, exitCode } = await executeCommand('git', ['status', '--porcelain']);
  
  if (exitCode !== 0) {
    throw new ReleaseError('Failed to check git status');
  }
  
  if (stdout.trim()) {
    throw new ReleaseError('Working directory is not clean. Please commit or stash your changes before releasing.');
  }
}

async function getCurrentBranch(): Promise<string> {
  const { stdout, exitCode } = await executeCommand('git', ['branch', '--show-current']);
  
  if (exitCode !== 0) {
    throw new ReleaseError('Failed to get current branch');
  }
  
  return stdout.trim();
}

function parseVersion(version: string): { major: number; minor: number; patch: number } {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new ReleaseError(`Invalid version format: ${version}. Expected format: x.y.z`);
  }
  
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10)
  };
}

function incrementVersion(currentVersion: string, type: 'major' | 'minor' | 'patch'): string {
  const { major, minor, patch } = parseVersion(currentVersion);
  
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new ReleaseError(`Invalid increment type: ${type}`);
  }
}

async function updatePackageJson(newVersion: string, dryRun: boolean): Promise<void> {
  const packageJsonPath = join(process.cwd(), 'package.json');
  
  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson: PackageJson = JSON.parse(content);
    
    const oldVersion = packageJson.version;
    packageJson.version = newVersion;
    
    console.log(`📦 Package version: ${oldVersion} → ${newVersion}`);
    
    if (!dryRun) {
      await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      console.log('✅ Updated package.json');
    }
  } catch (error) {
    throw new ReleaseError(`Failed to update package.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function createGitTag(version: string, dryRun: boolean): Promise<void> {
  const tagName = `v${version}`;
  
  // Check if tag already exists
  const { exitCode: tagExistsCode } = await executeCommand('git', ['tag', '-l', tagName]);
  if (tagExistsCode === 0) {
    const { stdout } = await executeCommand('git', ['tag', '-l', tagName]);
    if (stdout.includes(tagName)) {
      throw new ReleaseError(`Tag ${tagName} already exists`);
    }
  }
  
  console.log(`🏷️  Git tag: ${tagName}`);
  
  if (!dryRun) {
    const { exitCode } = await executeCommand('git', ['tag', '-a', tagName, '-m', `Release ${tagName}`]);
    if (exitCode !== 0) {
      throw new ReleaseError(`Failed to create git tag ${tagName}`);
    }
    console.log('✅ Created git tag');
  }
}

async function getCurrentVersion(): Promise<string> {
  const packageJsonPath = join(process.cwd(), 'package.json');
  
  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson: PackageJson = JSON.parse(content);
    return packageJson.version;
  } catch (error) {
    throw new ReleaseError(`Failed to read current version: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function showHelp(): void {
  console.log(`
Release Script - Update package.json version and create git tag

Usage:
  bun run release [version|increment] [--dry-run]

Arguments:
  version     Specific version (e.g., 1.2.3)
  increment   Auto-increment type: patch (default), minor, major

Options:
  --dry-run   Preview changes without applying them
  --help      Show this help message

Examples:
  bun run release                    # Auto-increment patch version
  bun run release patch              # Auto-increment patch version
  bun run release minor              # Auto-increment minor version
  bun run release major              # Auto-increment major version
  bun run release 1.2.3              # Set specific version
  bun run release --dry-run          # Preview changes
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }
  
  // Check for dry-run flag
  const dryRun = args.includes('--dry-run');
  const filteredArgs = args.filter(arg => arg !== '--dry-run');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be applied\n');
  }
  
  try {
    // Pre-flight checks
    if (!dryRun) {
      console.log('🔍 Checking git status...');
      await checkGitStatus();
      
      const branch = await getCurrentBranch();
      console.log(`📍 Current branch: ${branch}`);
      
      if (branch !== 'main' && branch !== 'master') {
        console.log('⚠️  Warning: You are not on the main/master branch');
      }
    }
    
    // Determine new version
    const currentVersion = await getCurrentVersion();
    console.log(`📋 Current version: ${currentVersion}`);
    
    let newVersion: string;
    const versionArg = filteredArgs[0];
    
    if (!versionArg || versionArg === 'patch') {
      newVersion = incrementVersion(currentVersion, 'patch');
    } else if (versionArg === 'minor') {
      newVersion = incrementVersion(currentVersion, 'minor');
    } else if (versionArg === 'major') {
      newVersion = incrementVersion(currentVersion, 'major');
    } else if (/^\d+\.\d+\.\d+$/.test(versionArg)) {
      // Validate that new version is greater than current
      const current = parseVersion(currentVersion);
      const target = parseVersion(versionArg);
      
      if (target.major < current.major || 
          (target.major === current.major && target.minor < current.minor) ||
          (target.major === current.major && target.minor === current.minor && target.patch <= current.patch)) {
        throw new ReleaseError(`New version ${versionArg} must be greater than current version ${currentVersion}`);
      }
      
      newVersion = versionArg;
    } else {
      throw new ReleaseError(`Invalid argument: ${versionArg}. Use 'patch', 'minor', 'major', or a specific version like '1.2.3'`);
    }
    
    console.log('');
    
    // Update package.json
    await updatePackageJson(newVersion, dryRun);
    
    // Create git tag
    await createGitTag(newVersion, dryRun);
    
    console.log('');
    
    if (dryRun) {
      console.log('🔍 Dry run completed. Use without --dry-run to apply changes.');
    } else {
      console.log('🎉 Release completed successfully!');
      console.log('');
      console.log('Next steps:');
      console.log('  1. Push the tag: git push origin v' + newVersion);
      console.log('  2. This will trigger the GitHub release workflow');
    }
    
  } catch (error) {
    if (error instanceof ReleaseError) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    } else {
      console.error(`❌ Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  }
}

// Run the script
await main();