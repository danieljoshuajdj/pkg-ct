import { describe, expect, it } from 'vitest';
import { buildRootCauses } from '../src/reporters/terminal.js';
import type { AnalysisResult, Finding } from '../src/types/index.js';

const finding = (
  id: string,
  category: Finding['category'],
  packageName: string
): Finding => ({
  id,
  title: id,
  description: id,
  category,
  severity: 'medium',
  packageName,
  evidence: [],
  recommendation: 'Review',
  confidence: 1
});

describe('root-cause clustering', () => {
  it('groups symptoms into actionable causes instead of listing occurrences', () => {
    const findings = [
      finding('compatibility:framework-mismatch:react', 'compatibility', 'react-dom'),
      finding('duplicates:chalk', 'duplication', 'chalk'),
      finding('bloat:esbuild@1', 'install-performance', 'esbuild'),
      finding('audit:shell-quote:x', 'security', 'shell-quote'),
      finding('unused:left-pad', 'hygiene', 'left-pad')
    ];
    const result = {
      findings,
      usage: {
        packageUsage: new Map([['esbuild', { role: 'BUNDLER' }]])
      }
    } as any as AnalysisResult;
    const causes = buildRootCauses(result);
    expect(causes.map((cause) => cause.issue)).toEqual([
      'Framework mismatch',
      'Duplicate ecosystem',
      'Build tooling',
      'Security',
      'Unused dependencies'
    ]);
    expect(causes.every((cause) => cause.count === 1)).toBe(true);
  });

  it('clusters freshness and maintainability findings into root causes', () => {
    // This test validates the fix for the root cause clustering gap.
    // Previously: freshness and maintainability findings were silently dropped.
    // Now: they get their own root cause clusters.
    const findings = [
      finding('outdated:lodash', 'freshness', 'lodash'),
      finding('stale:moment', 'freshness', 'moment'),
      finding('maintainers:tiny-lib', 'maintainability', 'tiny-lib')
    ];
    const result = {
      findings,
      usage: {
        packageUsage: new Map()
      }
    } as any as AnalysisResult;
    const causes = buildRootCauses(result);
    const issueNames = causes.map((cause) => cause.issue);
    expect(issueNames).toContain('Freshness lag');
    expect(issueNames).toContain('Maintainability');
    const freshnessCause = causes.find((c) => c.issue === 'Freshness lag');
    expect(freshnessCause?.count).toBe(2);
  });
});
