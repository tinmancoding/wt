/**
 * Mock filesystem service for testing with configurable file system state
 */

import type { Stats } from 'node:fs';
import type { FileSystemService } from '../types.ts';

interface MockStats {
  isDirectory(): boolean;
  isFile(): boolean;
}

export class MockFileSystemService implements FileSystemService {
  private files = new Map<string, string>();
  private directories = new Set<string>();
  private accessiblePaths = new Set<string>();
  private mockStats = new Map<string, MockStats>();
  
  // Configuration methods for tests
  setFileContent(path: string, content: string): void {
    this.files.set(path, content);
    this.accessiblePaths.add(path);
  }

  setDirectory(path: string): void {
    this.directories.add(path);
    this.accessiblePaths.add(path);
  }

  setAccessible(path: string, accessible: boolean): void {
    if (accessible) {
      this.accessiblePaths.add(path);
    } else {
      this.accessiblePaths.delete(path);
    }
  }

  setStats(path: string, stats: {isDirectory: boolean, isFile: boolean}): void {
    this.mockStats.set(path, {
      isDirectory: () => stats.isDirectory,
      isFile: () => stats.isFile
    });
  }

  clear(): void {
    this.files.clear();
    this.directories.clear();
    this.accessiblePaths.clear();
    this.mockStats.clear();
  }

  getFileWrites(): Array<{path: string, data: string, encoding?: BufferEncoding}> {
    return [...this.fileWrites];
  }

  private fileWrites: Array<{path: string, data: string, encoding?: BufferEncoding}> = [];

  // FileSystemService implementation
  async readFile(path: string, _encoding: BufferEncoding = 'utf-8'): Promise<string> {
    if (!this.files.has(path)) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return this.files.get(path)!;
  }
  
  async writeFile(path: string, data: string, encoding: BufferEncoding = 'utf-8'): Promise<void> {
    this.fileWrites.push({path, data, encoding});
    this.files.set(path, data);
    this.accessiblePaths.add(path);
  }
  
  async access(path: string, _mode?: number): Promise<void> {
    if (!this.accessiblePaths.has(path)) {
      throw new Error(`ENOENT: no such file or directory, access '${path}'`);
    }
  }
  
  async stat(path: string): Promise<Stats> {
    if (!this.accessiblePaths.has(path)) {
      throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
    }
    
    const mockStats = this.mockStats.get(path);
    if (mockStats) {
      return mockStats as Stats;
    }
    
    // Default stats based on whether it's a file or directory
    const isDir = this.directories.has(path);
    const isFile = this.files.has(path);
    
    return {
      isDirectory: () => isDir,
      isFile: () => isFile
    } as Stats;
  }
  
  async mkdir(path: string, _options?: any): Promise<void> {
    this.directories.add(path);
    this.accessiblePaths.add(path);
  }
  
  async exists(path: string): Promise<boolean> {
    return this.accessiblePaths.has(path);
  }
  
  async isDirectory(path: string): Promise<boolean> {
    try {
      const stats = await this.stat(path);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
  
  async isFile(path: string): Promise<boolean> {
    try {
      const stats = await this.stat(path);
      return stats.isFile();
    } catch {
      return false;
    }
  }
}