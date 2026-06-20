import { describe, expect, it } from 'vitest';
import { classifyProductionPackages } from '../src/scanner/production.js';
import type { AnalysisResult } from '../src/types/index.js';

describe('classifyProductionPackages', () => {
  const mockResult: AnalysisResult = {
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
        dependencies: { 'express': '^4.18.0' },
        devDependencies: { 'vitest': '^2.0.0', 'typescript': '^5.0.0' },
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
      nodes: new Map([
        [
          'express@4.18.2',
          {
            id: 'express@4.18.2',
            name: 'express',
            version: '4.18.2',
            depth: 1,
            dev: false,
            peerDependencies: {},
            dependencies: {},
            dependents: ['test-proj@0.0.0'],
            sizeBytes: 1000,
            scripts: {}
          }
        ],
        [
          'vitest@2.1.8',
          {
            id: 'vitest@2.1.8',
            name: 'vitest',
            version: '2.1.8',
            depth: 1,
            dev: true,
            peerDependencies: {},
            dependencies: {},
            dependents: ['test-proj@0.0.0'],
            sizeBytes: 1000,
            scripts: {}
          }
        ],
        [
          'typescript@5.7.2',
          {
            id: 'typescript@5.7.2',
            name: 'typescript',
            version: '5.7.2',
            depth: 1,
            dev: true,
            peerDependencies: {},
            dependencies: {},
            dependents: ['test-proj@0.0.0'],
            sizeBytes: 2000,
            scripts: {}
          }
        ]
      ]),
      edges: [],
      byName: new Map([
        ['express', ['express@4.18.2']],
        ['vitest', ['vitest@2.1.8']],
        ['typescript', ['typescript@5.7.2']]
      ])
    },
    findings: [],
    score: { overall: 100, grade: 'A', breakdown: [] },
    remediation: [],
    usage: {
      usedPackages: new Set(['express']),
      packageUsage: new Map([
        ['express', { name: 'express', confidence: 100, evidence: [], safeRemovalProbability: 0, role: 'FRAMEWORK' }]
      ]),
      filesScanned: 1,
      importCount: 1
    },
    lockfileAnalysis: {
      type: 'npm',
      packageCount: 3,
      duplicatePackages: new Map(),
      missingDirectDependencies: [],
      staleDirectDependencies: [],
      evidence: []
    },
    audit: { vulnerabilities: [] },
    packageIntelligence: [],
    generatedAt: new Date().toISOString(),
    durationMs: 1,
    pipeline: 'ANALYZE_PIPELINE'
  };

  it('classifies production vs build vs dev packages correctly', () => {
    const list = classifyProductionPackages(mockResult);
    
    const expressCls = list.find(c => c.packageName === 'express')!;
    expect(expressCls.classification).toBe('Production critical');
    expect(expressCls.role).toBe('FRAMEWORK');

    const vitestCls = list.find(c => c.packageName === 'vitest')!;
    expect(vitestCls.classification).toBe('Development only');
    expect(vitestCls.role).toBe('TEST_TOOL');

    const tsCls = list.find(c => c.packageName === 'typescript')!;
    expect(tsCls.classification).toBe('Build only');
    expect(tsCls.role).toBe('TRANSPILER');
    
    // Check that Unknown packages are 0% (which is < 20%)
    const unknowns = list.filter(c => c.classification === 'Unknown');
    expect(unknowns.length).toBe(0);
  });
});
