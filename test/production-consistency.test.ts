import { describe, expect, it } from 'vitest';
import { getRoleAndClassification } from '../src/scanner/production.js';

describe('production-consistency: role and classification agreement', () => {
  const devToolRoles = ['DEVELOPMENT', 'TEST_TOOL', 'LINTER', 'CONFIG_TOOL', 'BUNDLER', 'TRANSPILER'];
  const buildOnlyRoles = ['BUILD_TOOL', 'CONFIG_TOOL', 'TRANSPILER', 'BUNDLER', 'BUILD_RUNTIME'];
  const devOnlyRoles = ['DEVELOPMENT', 'TEST_TOOL', 'LINTER'];
  const prodCriticalRoles = ['FRAMEWORK', 'CORE_RUNTIME', 'PRODUCTION_RUNTIME'];

  it('never classifies DEVELOPMENT, TEST_TOOL, LINTER, CONFIG_TOOL, BUNDLER, or TRANSPILER as Production critical', () => {
    // Generate various test scenarios with dev flag both true and false
    const packageNames = [
      'eslint', 'prettier', 'vitest', 'jest', 'typescript', 'babel', 'webpack',
      'vite', 'postcss', 'tailwindcss', 'tsup', '@types/node', 'some-random-package'
    ];

    for (const name of packageNames) {
      for (const dev of [true, false, undefined]) {
        // Test with different starting roles
        for (const startRole of [...devToolRoles, 'UNKNOWN', 'TRANSITIVE', 'OPTIONAL']) {
          const { role, classification } = getRoleAndClassification({ name, dev }, startRole);
          
          if (devToolRoles.includes(role)) {
            expect(classification).not.toBe('Production critical');
          }

          // Verify mapping alignment:
          if (prodCriticalRoles.includes(role)) {
            expect(classification).toBe('Production critical');
          } else if (buildOnlyRoles.includes(role)) {
            expect(classification).toBe('Build only');
          } else if (devOnlyRoles.includes(role)) {
            expect(classification).toBe('Development only');
          } else if (role === 'UNKNOWN') {
            expect(classification).toBe('Unknown');
          }
        }
      }
    }
  });

  it('guarantees role-classification pair is always consistent', () => {
    const testCases = [
      { name: '@types/node', dev: false, expectedRole: 'DEVELOPMENT', expectedClass: 'Development only' },
      { name: 'eslint', dev: false, expectedRole: 'LINTER', expectedClass: 'Development only' },
      { name: 'vite', dev: false, expectedRole: 'BUNDLER', expectedClass: 'Build only' },
      { name: 'typescript', dev: false, expectedRole: 'TRANSPILER', expectedClass: 'Build only' },
      { name: 'react', dev: false, expectedRole: 'FRAMEWORK', expectedClass: 'Production critical' },
      { name: 'react-dom', dev: false, expectedRole: 'CORE_RUNTIME', expectedClass: 'Production critical' }
    ];

    for (const tc of testCases) {
      const { role, classification } = getRoleAndClassification({ name: tc.name, dev: tc.dev });
      expect(role).toBe(tc.expectedRole);
      expect(classification).toBe(tc.expectedClass);
    }
  });
});
