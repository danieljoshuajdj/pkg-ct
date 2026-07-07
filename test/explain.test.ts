import { describe, expect, it } from 'vitest';
import { explainPackage } from '../src/core/explain.js';
import { renderExplain } from '../src/reporters/terminal.js';
import { duplicateGraph, testContext } from './fixtures/simple-package.js';
import type { AnalysisResult } from '../src/types/index.js';

describe('explainPackage', () => {
  it('explains duplicate package impact', () => {
    const result: AnalysisResult = {
      context: {
        ...testContext(),
        rootProject: {
          ...testContext().rootProject,
          dependencies: { lodash: '^4.17.0' }
        }
      },
      graph: duplicateGraph(),
      findings: [],
      score: { overall: 90, grade: 'A', breakdown: [] },
      remediation: [],
      usage: {
        usedPackages: new Set(['lodash']),
        packageUsage: new Map([['lodash', {
          name: 'lodash',
          confidence: 55,
          evidence: [
            { source: 'source', file: 'src/index.ts', detail: 'Static import: lodash', confidence: 40 },
            { source: 'dynamic', file: 'src/lazy.ts', detail: 'Dynamic import: lodash', confidence: 15 }
          ],
          safeRemovalProbability: 8,
          role: 'PRODUCTION_RUNTIME'
        }]]),
        filesScanned: 2,
        importCount: 2
      },
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
      durationMs: 1,
      pipeline: 'ANALYZE_PIPELINE'
    };
    const explanation = explainPackage(result, 'lodash');
    expect(explanation.duplicates).toHaveLength(2);
    expect(explanation.installImpactBytes).toBe(2000);
    expect(explanation.directlyDeclared).toBe(true);
    expect(explanation.importedByFiles).toEqual(['src/index.ts', 'src/lazy.ts']);
    expect(explanation.usageConfidence).toBe(55);
    const output = renderExplain(explanation);
    expect(output).toContain('Files importing it: 2');
    expect(output).toContain('Source imports           +40');
    expect(output).toContain('Dynamic imports          +15');
    expect(output).toContain('SAFE REMOVAL');
    expect(output).toContain('UPGRADE RISK');
  });
});
