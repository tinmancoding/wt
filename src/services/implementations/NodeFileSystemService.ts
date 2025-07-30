/**
 * Default Node.js filesystem service implementation using fs/promises
 */

import { 
  readFile as fsReadFile, 
  writeFile as fsWriteFile, 
  access as fsAccess, 
  stat as fsStat, 
  mkdir as fsMkdir, 
  constants 
} from 'node:fs/promises';
import type { Stats } from 'node:fs';
import type { FileSystemService } from '../types.ts';

export class NodeFileSystemService implements FileSystemService {
  async readFile(path: string, encoding: BufferEncoding = 'utf-8'): Promise<string> {
    return fsReadFile(path, encoding);
  }
  
  async writeFile(path: string, data: string, encoding: BufferEncoding = 'utf-8'): Promise<void> {
    return fsWriteFile(path, data, encoding);
  }
  
  async access(path: string, mode: number = constants.F_OK): Promise<void> {
    return fsAccess(path, mode);
  }
  
  async stat(path: string): Promise<Stats> {
    return fsStat(path);
  }
  
  async mkdir(path: string, options?: any): Promise<void> {
    await fsMkdir(path, options);
  }
  
  async exists(path: string): Promise<boolean> {
    try {
      await this.access(path);
      return true;
    } catch {
      return false;
    }
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
  
  chdir(path: string): void {
    process.chdir(path);
  }
}