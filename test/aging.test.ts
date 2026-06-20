import { describe, expect, it } from 'vitest';
import { calculateAging } from '../src/health/aging.js';
import type { AnalysisResult } from '../src/types/index.js';

describe('calculateAging', () => {
  const baseResult: AnalysisResult = {
    context: {
      root: '/project',
      packageManager: 'npm',
      isMonorepo: false,
      workspaceGlobs: [],
      workspaces: [],
      rootProject: {
        name: 'test-proj',
        path: '/project',
        packageJsonPath: '/project/package.json',
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
        optionalDependencies: {}
      },
      config: {
        root: '/project',
        offline: false,
        ai: { provider: 'none' },
        ignorePackages: [],
        rules: {},
        scoring: {
          security: 1.8,
          compatibility: 1.4,
          hygiene: 1.0,
          freshness: 0.8,
          duplication: 1.0,
          maintainability: 1.2,
          'install-performance': 0.6,
          'runtime-impact': 1.0,
          'bundle-impact': 1.0
        },
        ci: { failOn: 'high', minScore: 70 },
        plugins: []
      }
    },
    graph: {
      rootId: 'test-proj@0.0.0',
      nodes: new Map([
        [
          'lodash@4.17.21',
          {
            id: 'lodash@4.17.21',
            name: 'lodash',
            version: '4.17.21',
            depth: 1,
            peerDependencies: {},
            dependencies: {},
            dependents: ['test-proj@0.0.0'],
            sizeBytes: 100,
            scripts: {}
          }
        ]
      ]),
      edges: [],
      byName: new Map([['lodash', ['lodash@4.17.21']]])
    },
    findings: [],
    score: { overall: 100, grade: 'A', breakdown: [] },
    remediation: [],
    usage: { usedPackages: new Set<string>(), packageUsage: new Map(), filesScanned: 0, importCount: 0 },
    lockfileAnalysis: {
      type: 'npm',
      packageCount: 1,
      duplicatePackages: new Map(),
      missingDirectDependencies: [],
      staleDirectDependencies: [],
      evidence: []
    },
    audit: { vulnerabilities: [] },
    packageIntelligence: [
      {
        name: 'lodash',
        ageDays: 800,
        versions: ['4.17.21'],
        isOutdated: false
      }
    ],
    generatedAt: new Date().toISOString(),
    durationMs: 1,
    pipeline: 'ANALYZE_PIPELINE'
  };

  it('calculates age correctly with normal metadata', () => {
    const result = calculateAging(baseResult);
    expect(result.averageAgeDays).toBe(800);
    expect(result.olderThan1Year).toContain('lodash (2 years)');
    expect(result.technicalLagScore).toBe(20); // 2 years lag deduction
  });

  it('uses heuristic fallback when metadata is missing', () => {
    const withoutMetadata = {
      ...baseResult,
      packageIntelligence: []
    };
    const result = calculateAging(withoutMetadata);
    expect(result.averageAgeDays).toBeGreaterThan(0);
    expect(Number.isFinite(result.averageAgeDays)).toBe(true);
    expect(Number.isNaN(result.averageAgeDays)).toBe(false);
  });

  it('handles invalid versions in heuristic fallback without generating NaN', () => {
    const invalidVersionResult = {
      ...baseResult,
      graph: {
        ...baseResult.graph,
        nodes: new Map([
          [
            'some-pkg@workspace:*',
            {
              id: 'some-pkg@workspace:*',
              name: 'some-pkg',
              version: 'workspace:*',
              depth: 1,
              peerDependencies: {},
              dependencies: {},
              dependents: ['test-proj@0.0.0'],
              sizeBytes: 100,
              scripts: {}
            }
          ]
        ])
      },
      packageIntelligence: []
    };
    const result = calculateAging(invalidVersionResult);
    expect(result.averageAgeDays).toBe(365); // falls back to major version 1 -> 365 days
    expect(Number.isNaN(result.averageAgeDays)).toBe(false);
  });
});
