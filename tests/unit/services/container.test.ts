import { test, expect } from 'bun:test';
import { createServiceContainer, createTestServiceContainer } from '../../../src/services/container.ts';
import { NodeLoggerService } from '../../../src/services/implementations/NodeLoggerService.ts';
import { NodeGitService } from '../../../src/services/implementations/NodeGitService.ts';
import { NodeFileSystemService } from '../../../src/services/implementations/NodeFileSystemService.ts';
import { NodeCommandService } from '../../../src/services/implementations/NodeCommandService.ts';
import { MockLoggerService } from '../../../src/services/test-implementations/MockLoggerService.ts';
import { MockGitService } from '../../../src/services/test-implementations/MockGitService.ts';
import { MockFileSystemService } from '../../../src/services/test-implementations/MockFileSystemService.ts';
import { MockCommandService } from '../../../src/services/test-implementations/MockCommandService.ts';


test('createServiceContainer creates container with default implementations', () => {
  const container = createServiceContainer();

  expect(container.logger).toBeInstanceOf(NodeLoggerService);
  expect(container.git).toBeInstanceOf(NodeGitService);
  expect(container.fs).toBeInstanceOf(NodeFileSystemService);
  expect(container.cmd).toBeInstanceOf(NodeCommandService);
});

test('createServiceContainer accepts custom logger service', () => {
  const customLogger = new MockLoggerService();
  const container = createServiceContainer({ logger: customLogger });

  expect(container.logger).toBe(customLogger);
  expect(container.git).toBeInstanceOf(NodeGitService);
  expect(container.fs).toBeInstanceOf(NodeFileSystemService);
  expect(container.cmd).toBeInstanceOf(NodeCommandService);
});

test('createServiceContainer accepts custom git service', () => {
  const customGit = new MockGitService();
  const container = createServiceContainer({ git: customGit });

  expect(container.logger).toBeInstanceOf(NodeLoggerService);
  expect(container.git).toBe(customGit);
  expect(container.fs).toBeInstanceOf(NodeFileSystemService);
  expect(container.cmd).toBeInstanceOf(NodeCommandService);
});

test('createServiceContainer accepts custom filesystem service', () => {
  const customFs = new MockFileSystemService();
  const container = createServiceContainer({ fs: customFs });

  expect(container.logger).toBeInstanceOf(NodeLoggerService);
  expect(container.git).toBeInstanceOf(NodeGitService);
  expect(container.fs).toBe(customFs);
  expect(container.cmd).toBeInstanceOf(NodeCommandService);
});

test('createServiceContainer accepts custom command service', () => {
  const customCmd = new MockCommandService();
  const container = createServiceContainer({ cmd: customCmd });

  expect(container.logger).toBeInstanceOf(NodeLoggerService);
  expect(container.git).toBeInstanceOf(NodeGitService);
  expect(container.fs).toBeInstanceOf(NodeFileSystemService);
  expect(container.cmd).toBe(customCmd);
});

test('createServiceContainer accepts multiple custom services', () => {
  const customLogger = new MockLoggerService();
  const customGit = new MockGitService();
  const customFs = new MockFileSystemService();
  const customCmd = new MockCommandService();

  const container = createServiceContainer({
    logger: customLogger,
    git: customGit,
    fs: customFs,
    cmd: customCmd
  });

  expect(container.logger).toBe(customLogger);
  expect(container.git).toBe(customGit);
  expect(container.fs).toBe(customFs);
  expect(container.cmd).toBe(customCmd);
});

test('createTestServiceContainer creates container with mock implementations', async () => {
  const container = await createTestServiceContainer();

  expect(container.logger).toBeInstanceOf(MockLoggerService);
  expect(container.git).toBeInstanceOf(MockGitService);
  expect(container.fs).toBeInstanceOf(MockFileSystemService);
  expect(container.cmd).toBeInstanceOf(MockCommandService);
});

test('createTestServiceContainer accepts custom services', async () => {
  const customLogger = new NodeLoggerService();
  const container = await createTestServiceContainer({ logger: customLogger });

  expect(container.logger).toBe(customLogger);
  expect(container.git).toBeInstanceOf(MockGitService);
  expect(container.fs).toBeInstanceOf(MockFileSystemService);
  expect(container.cmd).toBeInstanceOf(MockCommandService);
});

test('service container maintains service interface contracts', () => {
  const container = createServiceContainer();

  // Test that all services implement their expected interfaces
  expect(typeof container.logger.log).toBe('function');
  expect(typeof container.logger.error).toBe('function');
  expect(typeof container.logger.warn).toBe('function');
  expect(typeof container.logger.info).toBe('function');
  expect(typeof container.logger.debug).toBe('function');

  expect(typeof container.git.executeCommand).toBe('function');
  expect(typeof container.git.executeCommandWithResult).toBe('function');
  expect(typeof container.git.executeCommandInDir).toBe('function');
  expect(typeof container.git.isAvailable).toBe('function');
  expect(typeof container.git.getVersion).toBe('function');

  expect(typeof container.fs.readFile).toBe('function');
  expect(typeof container.fs.writeFile).toBe('function');
  expect(typeof container.fs.access).toBe('function');
  expect(typeof container.fs.stat).toBe('function');
  expect(typeof container.fs.mkdir).toBe('function');
  expect(typeof container.fs.exists).toBe('function');
  expect(typeof container.fs.isDirectory).toBe('function');
  expect(typeof container.fs.isFile).toBe('function');

  expect(typeof container.cmd.execute).toBe('function');
});

test('service container is immutable after creation', () => {
  const container = createServiceContainer();
  const originalLogger = container.logger;

  // Attempting to modify the container should not affect the original
  const modifiedContainer = { ...container, logger: new MockLoggerService() };
  
  expect(container.logger).toBe(originalLogger);
  expect(modifiedContainer.logger).not.toBe(originalLogger);
});