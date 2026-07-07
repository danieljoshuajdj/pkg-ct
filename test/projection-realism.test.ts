import { describe, expect, it } from 'vitest';
import { renderDoctor } from '../src/reporters/terminal.js';
import type { AnalysisResult } from '../src/types/index.js';

describe('AI Fix Plan score projections', () => {
  const baseResult: AnalysisResult = {
    context: {
      root: '/project',
      packageManager: 'npm',
      isMonorepo: false,
      workspaceGlobs: [],
      workspaces: [],
      rootProject: {
        name: 'test',
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
          security: 1,
          compatibility: 1,
          hygiene: 1,
          freshness: 1,
          duplication: 1,
          maintainability: 1,
          'install-performance': 1,
          'runtime-impact': 1,
          'bundle-impact': 1
        },
        ci: { failOn: 'high', minScore: 70 },
        plugins: []
      }
    },
    graph: {
      rootId: 'test@0.0.0',
      nodes: new Map(),
      edges: [],
      byName: new Map()
    },
    findings: [],
    score: { overall: 82, grade: 'B', breakdown: [] },
    remediation: [],
    usage: { usedPackages: new Set(), packageUsage: new Map(), filesScanned: 0, importCount: 0 },
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

  it('calculates realistic score projections with diminishing returns', () => {
    // Add findings so that buildFixPlan suggests deduplication/peer alignment
    const result: AnalysisResult = {
      ...baseResult,
      score: { overall: 82, grade: 'B', breakdown: [] },
      findings: [
        {
          id: 'duplicates:lodash',
          title: 'lodash is duplicated',
          description: 'test',
          category: 'duplication',
          severity: 'medium',
          packageName: 'lodash',
          evidence: [],
          recommendation: 'Fix it',
          confidence: 1
        },
        {
          id: 'peer:react-dom:react',
          title: 'react-dom expects peer react',
          description: 'test',
          category: 'compatibility',
          severity: 'high',
          packageName: 'react',
          evidence: [],
          recommendation: 'Fix it',
          confidence: 1
        }
      ]
    };

    const output = renderDoctor(result);
    
    // Check that optimistic, likely, and conservative are printed
    expect(output).toContain('Optimistic:');
    expect(output).toContain('Likely:');
    expect(output).toContain('Conservative:');

    // Optimistic should not be 100
    expect(output).not.toContain('Optimistic:   100');
  });
});
