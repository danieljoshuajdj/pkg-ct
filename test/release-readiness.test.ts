import { describe, expect, it } from 'vitest';
import { calculateDuplicateThreshold, renderDoctor } from '../src/reporters/terminal.js';
import type { AnalysisResult } from '../src/types/index.js';

describe('Release readiness checker', () => {
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

  it('marks ready: YES when all checks pass', () => {
    const output = renderDoctor(baseResult);
    expect(output).toContain('Ready: YES');
  });

  it('marks ready: NO when duplication exceeds threshold', () => {
    const multipleDuplicates: AnalysisResult = {
      ...baseResult,
      findings: Array.from({ length: 12 }, (_, i) => ({
        id: `duplicates:pkg-${i}`,
        title: `pkg-${i} is duplicated`,
        description: 'Duplicate',
        category: 'duplication',
        severity: 'medium',
        packageName: `pkg-${i}`,
        evidence: [],
        recommendation: 'Dedupe',
        confidence: 0.9
      }))
    };
    const output = renderDoctor(multipleDuplicates);
    expect(output).toContain('Ready: NO');
    expect(output).toContain('12 duplicate package families exceeds threshold (10)');
  });

  it('scales the threshold by package count, framework, and workspace shape', () => {
    const result: AnalysisResult = {
      ...baseResult,
      context: {
        ...baseResult.context,
        isMonorepo: true,
        workspaces: Array.from({ length: 12 }, (_, index) => ({
          name: `workspace-${index}`,
          path: `/project/packages/${index}`,
          packageJsonPath: `/project/packages/${index}/package.json`,
          dependencies: {},
          devDependencies: {},
          peerDependencies: {},
          optionalDependencies: {}
        })),
        rootProject: {
          ...baseResult.context.rootProject,
          dependencies: { react: '^19.0.0' }
        }
      },
      lockfileAnalysis: {
        ...baseResult.lockfileAnalysis,
        packageCount: 250
      }
    };
    expect(calculateDuplicateThreshold(result)).toEqual({
      threshold: 35,
      factors: [
        '250 packages',
        'react framework allowance +5',
        'monorepo/workspace allowance +10'
      ]
    });
  });

  it('does not let many patch/minor duplicate families block a healthy project', () => {
    const result: AnalysisResult = {
      ...baseResult,
      findings: Array.from({ length: 30 }, (_, index) => ({
        id: `duplicates:low-${index}`,
        title: `low-${index} is duplicated`,
        description: 'Patch variation',
        category: 'duplication',
        severity: 'low',
        packageName: `low-${index}`,
        evidence: ['SemVer distance: patch'],
        recommendation: 'Dedupe when convenient',
        confidence: 0.95
      }))
    };
    const output = renderDoctor(result);
    expect(output).toContain('30 families; risk-adjusted 7.5; threshold 10');
    expect(output).toContain('Ready: YES');
  });
});
