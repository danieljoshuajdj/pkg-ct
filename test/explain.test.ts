import { describe, expect, it } from 'vitest';
import { explainPackage } from '../src/core/explain.js';
import { duplicateGraph, testContext } from './fixtures/simple-package.js';
import type { AnalysisResult } from '../src/types/index.js';

describe('explainPackage', () => {
  it('explains duplicate package impact', () => {
    const result: AnalysisResult = {
      context: testContext(),
      graph: duplicateGraph(),
      findings: [],
      score: { overall: 90, grade: 'A', breakdown: [] },
      remediation: [],
      usage: { usedPackages: new Set(), filesScanned: 0, importCount: 0 },
      lockfileAnalysis: {
        type: 'npm',
        packageCount: 0,
        duplicatePackages: new Map(),
        missingDirectDependencies: [],
        staleDirectDependencies: [],
        evidence: []
      },
      audit: { vulnerabilities: [] },
      packageIntelligence: [{ name: 'lodash', latest: '4.17.21' }],
      generatedAt: new Date().toISOString(),
      durationMs: 1
    };
    const explanation = explainPackage(result, 'lodash');
    expect(explanation.duplicates).toHaveLength(2);
    expect(explanation.installImpactBytes).toBe(2000);
  });
});
