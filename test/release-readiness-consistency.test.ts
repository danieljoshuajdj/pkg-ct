import { describe, expect, it } from 'vitest';
import { renderDoctor } from '../src/reporters/terminal.js';
import type { AnalysisResult } from '../src/types/index.js';

describe('Release readiness consistency checks', () => {
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
        offline: true,
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
      nodes: new Map(),
      edges: [],
      byName: new Map()
    },
    findings: [],
    score: { overall: 100, grade: 'A', breakdown: [] },
    remediation: [],
    usage: { usedPackages: new Set<string>(), packageUsage: new Map(), filesScanned: 0, importCount: 0 },
    lockfileAnalysis: {
      type: 'npm',
      packageCount: 0,
      duplicatePackages: new Map(),
      missingDirectDependencies: [],
      staleDirectDependencies: [],
      evidence: []
    },
    audit: { vulnerabilities: [] },
    packageIntelligence: [],
    generatedAt: new Date().toISOString(),
    durationMs: 1,
    pipeline: 'DOCTOR_PIPELINE'
  };

  it('guarantees ready: NO and is logically consistent when blocking reasons exist', () => {
    const criticalResult: AnalysisResult = {
      ...baseResult,
      findings: [
        {
          id: 'crit-finding',
          title: 'Critical issue',
          description: 'A critical problem',
          category: 'security',
          severity: 'critical',
          packageName: 'some-pkg',
          evidence: [],
          recommendation: 'Fix it',
          confidence: 1.0
        }
      ]
    };
    const output = renderDoctor(criticalResult);
    expect(output).toContain('Ready: NO');
    expect(output).toContain('• 1 critical finding(s) must be resolved');
  });

  it('guarantees ready: YES when zero blocking reasons exist', () => {
    const output = renderDoctor(baseResult);
    expect(output).toContain('Ready: YES');
  });
});
