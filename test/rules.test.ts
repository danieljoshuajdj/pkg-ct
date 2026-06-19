import { describe, expect, it } from 'vitest';
import { builtinRules } from '../src/rules/builtin.js';
import { testRuleInput } from './fixtures/simple-package.js';

describe('builtin rules', () => {
  it('detects duplicate package versions', async () => {
    const rule = builtinRules.find((item) => item.id === 'duplicates');
    const findings = await rule?.run(testRuleInput());
    expect(findings?.[0]?.packageName).toBe('lodash');
  });

  it('detects unused direct dependencies from source usage', async () => {
    const rule = builtinRules.find((item) => item.id === 'unused-direct-dependencies');
    const findings = await rule?.run(
      testRuleInput({
        usage: {
          usedPackages: new Set(),
          filesScanned: 2,
          importCount: 0,
          packageUsage: new Map([
            [
              'a',
              {
                name: 'a',
                confidence: 20,
                evidence: [{ source: 'none', detail: 'No evidence found.', confidence: 20 }],
                safeRemovalProbability: 95,
                role: 'DEVELOPMENT'
              }
            ]
          ])
        }
      })
    );
    expect(findings?.some((finding) => finding.id === 'unused:a')).toBe(true);
  });

  it('detects lockfile drift', async () => {
    const rule = builtinRules.find((item) => item.id === 'lockfile-consistency');
    const findings = await rule?.run(
      testRuleInput({
        lockfileAnalysis: {
          type: 'npm',
          packageCount: 1,
          duplicatePackages: new Map(),
          missingDirectDependencies: ['a'],
          staleDirectDependencies: ['old-a'],
          evidence: ['fixture lockfile']
        }
      })
    );
    expect(findings?.map((finding) => finding.id)).toContain('lockfile:missing-direct:a');
    expect(findings?.map((finding) => finding.id)).toContain('lockfile:stale-direct:old-a');
  });
});
