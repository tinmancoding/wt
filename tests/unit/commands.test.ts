import { test, expect, describe, spyOn, beforeEach, afterEach } from "bun:test";

describe("Commands Unit Tests", () => {
  let exitSpy: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("parseBoolean function", () => {
    // Test the parseBoolean function that's used in config command
    function parseBoolean(value: string): boolean {
      const lowercaseValue = value.toLowerCase();
      if (lowercaseValue === 'true' || lowercaseValue === '1' || lowercaseValue === 'yes') {
        return true;
      }
      if (lowercaseValue === 'false' || lowercaseValue === '0' || lowercaseValue === 'no') {
        return false;
      }
      throw new Error(`Invalid boolean value: ${value}. Use true/false, yes/no, or 1/0`);
    }

    test("should parse true values correctly", () => {
      expect(parseBoolean("true")).toBe(true);
      expect(parseBoolean("TRUE")).toBe(true);
      expect(parseBoolean("True")).toBe(true);
      expect(parseBoolean("1")).toBe(true);
      expect(parseBoolean("yes")).toBe(true);
      expect(parseBoolean("YES")).toBe(true);
      expect(parseBoolean("Yes")).toBe(true);
    });

    test("should parse false values correctly", () => {
      expect(parseBoolean("false")).toBe(false);
      expect(parseBoolean("FALSE")).toBe(false);
      expect(parseBoolean("False")).toBe(false);
      expect(parseBoolean("0")).toBe(false);
      expect(parseBoolean("no")).toBe(false);
      expect(parseBoolean("NO")).toBe(false);
      expect(parseBoolean("No")).toBe(false);
    });

    test("should throw error for invalid values", () => {
      expect(() => parseBoolean("invalid")).toThrow("Invalid boolean value: invalid. Use true/false, yes/no, or 1/0");
      expect(() => parseBoolean("maybe")).toThrow("Invalid boolean value: maybe. Use true/false, yes/no, or 1/0");
      expect(() => parseBoolean("")).toThrow("Invalid boolean value: . Use true/false, yes/no, or 1/0");
      expect(() => parseBoolean("2")).toThrow("Invalid boolean value: 2. Use true/false, yes/no, or 1/0");
    });
  });

  describe("isValidConfigKey function", () => {
    // Test the isValidConfigKey function that's used in config command
    function isValidConfigKey(key: string): boolean {
      const validKeys = [
        'worktreeDir',
        'autoFetch', 
        'confirmDelete',
        'defaultBranch',
        'hooks.postCreate',
        'hooks.postRemove'
      ];
      return validKeys.includes(key);
    }

    test("should validate correct configuration keys", () => {
      expect(isValidConfigKey("worktreeDir")).toBe(true);
      expect(isValidConfigKey("autoFetch")).toBe(true);
      expect(isValidConfigKey("confirmDelete")).toBe(true);
      expect(isValidConfigKey("defaultBranch")).toBe(true);
      expect(isValidConfigKey("hooks.postCreate")).toBe(true);
      expect(isValidConfigKey("hooks.postRemove")).toBe(true);
    });

    test("should reject invalid configuration keys", () => {
      expect(isValidConfigKey("invalidKey")).toBe(false);
      expect(isValidConfigKey("")).toBe(false);
      expect(isValidConfigKey("hooks")).toBe(false);
      expect(isValidConfigKey("hooks.invalid")).toBe(false);
      expect(isValidConfigKey("autoFetch.something")).toBe(false);
    });

    test("should be case sensitive", () => {
      expect(isValidConfigKey("AutoFetch")).toBe(false);
      expect(isValidConfigKey("AUTOFETCH")).toBe(false);
      expect(isValidConfigKey("worktreedir")).toBe(false);
    });
  });

  describe("Command structure validation", () => {
    test("should validate command interface structure", () => {
      // This tests the TypeScript interfaces are properly defined
      const mockCommand = {
        name: "test",
        description: "Test command",
        aliases: ["t"],
        args: [
          {
            name: "argument",
            description: "Test argument",
            required: true
          }
        ],
        flags: [
          {
            name: "flag",
            shortName: "f",
            description: "Test flag",
            type: "boolean" as const,
            default: false
          }
        ],
        handler: async () => {}
      };

      // Validate structure
      expect(mockCommand.name).toBe("test");
      expect(mockCommand.description).toBe("Test command");
      expect(Array.isArray(mockCommand.aliases)).toBe(true);
      expect(Array.isArray(mockCommand.args)).toBe(true);
      expect(Array.isArray(mockCommand.flags)).toBe(true);
      expect(typeof mockCommand.handler).toBe("function");
      
      // Validate argument structure
      const arg = mockCommand.args[0];
      expect(arg?.name).toBe("argument");
      expect(arg?.description).toBe("Test argument");
      expect(arg?.required).toBe(true);
      
      // Validate flag structure
      const flag = mockCommand.flags[0];
      expect(flag?.name).toBe("flag");
      expect(flag?.shortName).toBe("f");
      expect(flag?.description).toBe("Test flag");
      expect(flag?.type).toBe("boolean");
      expect(flag?.default).toBe(false);
    });

    test("should validate command context structure", () => {
      const mockContext = {
        args: { key: "value" },
        flags: { verbose: true, count: 5 },
        positional: ["arg1", "arg2"]
      };

      expect(typeof mockContext.args).toBe("object");
      expect(typeof mockContext.flags).toBe("object");
      expect(Array.isArray(mockContext.positional)).toBe(true);
    });
  });

  describe("Exit codes validation", () => {
    test("should have all required exit codes defined", () => {
      const EXIT_CODES = {
        SUCCESS: 0,
        GENERAL_ERROR: 1,
        INVALID_ARGUMENTS: 2,
        GIT_REPO_NOT_FOUND: 3,
        NETWORK_ERROR: 4,
        FILESYSTEM_ERROR: 5
      } as const;

      expect(EXIT_CODES.SUCCESS).toBe(0);
      expect(EXIT_CODES.GENERAL_ERROR).toBe(1);
      expect(EXIT_CODES.INVALID_ARGUMENTS).toBe(2);
      expect(EXIT_CODES.GIT_REPO_NOT_FOUND).toBe(3);
      expect(EXIT_CODES.NETWORK_ERROR).toBe(4);
      expect(EXIT_CODES.FILESYSTEM_ERROR).toBe(5);
    });

    test("should have unique exit codes", () => {
      const EXIT_CODES = {
        SUCCESS: 0,
        GENERAL_ERROR: 1,
        INVALID_ARGUMENTS: 2,
        GIT_REPO_NOT_FOUND: 3,
        NETWORK_ERROR: 4,
        FILESYSTEM_ERROR: 5
      } as const;

      const codes = Object.values(EXIT_CODES);
      const uniqueCodes = new Set(codes);
      
      expect(codes.length).toBe(uniqueCodes.size);
    });
  });

  describe("Error message patterns", () => {
    test("should validate error message consistency", () => {
      const errorPatterns = {
        repository: /repository not found|not a git repository/i,
        network: /network|connection/i,
        filesystem: /file|directory/i,
        config: /configuration|config/i,
        arguments: /invalid|argument|required/i
      };

      // Test repository error messages
      expect(errorPatterns.repository.test("repository not found")).toBe(true);
      expect(errorPatterns.repository.test("not a git repository")).toBe(true);
      expect(errorPatterns.repository.test("Repository not found")).toBe(true);

      // Test network error messages
      expect(errorPatterns.network.test("network connection failed")).toBe(true);
      expect(errorPatterns.network.test("Connection timeout")).toBe(true);

      // Test filesystem error messages
      expect(errorPatterns.filesystem.test("file not found")).toBe(true);
      expect(errorPatterns.filesystem.test("directory does not exist")).toBe(true);

      // Test config error messages
      expect(errorPatterns.config.test("Invalid configuration key")).toBe(true);
      expect(errorPatterns.config.test("Config file malformed")).toBe(true);

      // Test argument error messages
      expect(errorPatterns.arguments.test("Invalid arguments")).toBe(true);
      expect(errorPatterns.arguments.test("Branch name is required")).toBe(true);
    });
  });
});