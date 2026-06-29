import { describe, expect, it } from 'vitest';
import { roleFor } from '../src/scanner/source-usage.js';
import { getRoleAndClassification } from '../src/scanner/production.js';

describe('expanded package role classification', () => {
  // Each mapping is based on the package's documented purpose on npm.
  // This is a heuristic: we match package names literally, not dynamically.
  // The goal is to reduce UNKNOWN classification below 5% for typical Node.js projects.

  describe('roleFor()', () => {
    it.each([
      ['commander', 'prod', 'CLI_FRAMEWORK'],
      ['yargs', 'prod', 'CLI_FRAMEWORK'],
      ['cac', 'prod', 'CLI_FRAMEWORK'],
      ['meow', 'dev', 'CLI_FRAMEWORK'],
      ['inquirer', 'prod', 'CLI_FRAMEWORK'],
      ['debug', 'prod', 'LOGGING'],
      ['pino', 'prod', 'LOGGING'],
      ['winston', 'prod', 'LOGGING'],
      ['semver', 'prod', 'UTILITY'],
      ['ms', 'prod', 'UTILITY'],
      ['type-fest', 'dev', 'UTILITY'],
      ['p-limit', 'prod', 'UTILITY'],
      ['signal-exit', 'prod', 'PROCESS_UTIL'],
      ['cross-spawn', 'prod', 'PROCESS_UTIL'],
      ['execa', 'prod', 'PROCESS_UTIL'],
      ['which', 'prod', 'PROCESS_UTIL'],
      ['json5', 'prod', 'CONFIG_PARSER'],
      ['yaml', 'prod', 'CONFIG_PARSER'],
      ['dotenv', 'prod', 'CONFIG_PARSER'],
      ['resolve', 'prod', 'MODULE_RESOLVER'],
      ['enhanced-resolve', 'prod', 'MODULE_RESOLVER'],
      ['pkg-types', 'prod', 'MODULE_RESOLVER'],
      ['glob', 'prod', 'FILE_FILTER'],
      ['globby', 'prod', 'FILE_FILTER'],
      ['fast-glob', 'prod', 'FILE_FILTER'],
      ['strip-ansi', 'prod', 'TERMINAL_UI'],
      ['color-convert', 'prod', 'TERMINAL_UI'],
      ['color-name', 'prod', 'TERMINAL_UI'],
      ['supports-color', 'prod', 'TERMINAL_UI'],
      ['lru-cache', 'prod', 'CACHE'],
      ['@babel/code-frame', 'prod', 'COMPILER_SUPPORT'],
    ])('maps %s (%s) to %s', (name, kind, expectedRole) => {
      expect(roleFor(name, kind)).toBe(expectedRole);
    });
  });

  describe('getRoleAndClassification()', () => {
    it.each([
      ['commander', false, 'CLI_FRAMEWORK', 'Production critical'],
      ['commander', true, 'CLI_FRAMEWORK', 'Development only'],
      ['debug', false, 'LOGGING', 'Production critical'],
      ['semver', false, 'UTILITY', 'Production critical'],
      ['semver', true, 'UTILITY', 'Development only'],
      ['json5', false, 'CONFIG_PARSER', 'Build only'],
      ['resolve', false, 'MODULE_RESOLVER', 'Build only'],
      ['cross-spawn', false, 'PROCESS_UTIL', 'Production critical'],
      ['glob', false, 'FILE_FILTER', 'Build only'],
      ['strip-ansi', false, 'TERMINAL_UI', 'Production critical'],
      ['strip-ansi', true, 'TERMINAL_UI', 'Development only'],
    ])('classifies %s (dev=%s) as %s / %s', (name, dev, expectedRole, expectedClass) => {
      const { role, classification } = getRoleAndClassification({ name, dev });
      expect(role).toBe(expectedRole);
      expect(classification).toBe(expectedClass);
    });
  });
});
