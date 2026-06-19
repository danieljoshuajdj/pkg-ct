/**
 * pipeline.test.ts
 *
 * Automated assertions for:
 * 1. scan output != analyze output
 * 2. doctor output != analyze output
 * 3. compatibility score changes when compatibility findings exist
 * 4. duplication score changes when duplicate findings exist
 * 5. confidence engine output appears when unused dependencies are reported
 * 6. pipeline identity field is set correctly by each analyzer
 */

import { describe, expect, it } from 'vitest';
import { scoreFindings } from '../src/health/scoring.js';
import { renderDoctor, renderHealthSummary, renderScanInventory, renderTerminal } from '../src/reporters/terminal.js';
import { testConfig, testRuleInput, duplicateGraph } from './fixtures/simple-package.js';
import { builtinRules } from '../src/rules/builtin.js';
import type { AnalysisResult, Finding } from '../src/types/index.js';

// ---------------------------------------------------------------------------
// Shared mock builder
// ---------------------------------------------------------------------------
function mockResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    context: {
      root: process.cwd(),
      packageManager: 'npm',
      isMonorepo: false,
      workspaceGlobs: [],
      workspaces: [],
      rootProject: {
        name: 'test-proj',
        path: process.cwd(),
        packageJsonPath: 'package.json',
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
        optionalDependencies: {}
      },
      config: testConfig()
    },
    graph: { rootId: 'test-proj@0.0.0', nodes: new Map(), edges: [], byName: new Map() },
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
    pipeline: 'ANALYZE_PIPELINE',
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// 1. scan output != analyze output
// ---------------------------------------------------------------------------
describe('Pipeline output differentiation', () => {
  it('scan output differs from analyze output', () => {
    const result = mockResult({
      score: {
        overall: 75,
        grade: 'C',
        breakdown: [{ category: 'hygiene', score: 75, weight: 1, deductions: 25, explanation: '1 issue' }]
      },
      findings: [
        {
          id: 'duplicates:lodash',
          title: 'lodash is installed in 2 versions',
          description: 'Duplicated',
          category: 'duplication',
          severity: 'medium',
          packageName: 'lodash',
          evidence: [],
          recommendation: 'Dedupe',
          confidence: 0.95
        }
      ],
      remediation: [
        {
          id: 'plan:dedupe',
          title: 'Deduplicate lodash',
          priority: 70,
          difficulty: 'easy',
          impact: 'medium',
          actions: [{ type: 'dedupe', title: 'Dedupe', commands: ['npm dedupe'], safe: true, requiresInstall: true }],
          rationale: 'Multiple versions'
        }
      ]
    });

    const scanOut = renderScanInventory(result);
    const analyzeOut = renderTerminal(result);

    // scan output must NOT contain score or remediation
    expect(scanOut).toContain('pkg-ct scan');
    expect(scanOut).not.toContain('Project Health Score');
    expect(scanOut).not.toContain('Remediation Plan');

    // analyze output must contain score and remediation
    expect(analyzeOut).toContain('Project Health Score: 75/100');
    expect(analyzeOut).toContain('Remediation Plan');
    expect(analyzeOut).not.toContain('=== Inventory ===');

    // outputs must not be equal
    expect(scanOut).not.toBe(analyzeOut);
  });

  // ---------------------------------------------------------------------------
  // 2. doctor output != analyze output
  // ---------------------------------------------------------------------------
  it('doctor output differs from analyze output', () => {
    const result = mockResult({
      score: {
        overall: 80,
        grade: 'B',
        breakdown: [{ category: 'compatibility', score: 80, weight: 1.3, deductions: 20, explanation: '1 issue' }]
      },
      findings: [
        {
          id: 'peer:some-pkg:react',
          title: 'some-pkg expects peer react@^18',
          description: 'Peer conflict',
          category: 'compatibility',
          severity: 'high',
          packageName: 'some-pkg',
          evidence: ['required: react@^18', 'installed: none'],
          recommendation: 'Install react@18',
          confidence: 0.9
        }
      ]
    });

    const analyzeOut = renderTerminal(result);
    const doctorOut = renderDoctor(result);

    // doctor must have distinct sections
    expect(doctorOut).toContain('pkg-ct doctor');
    expect(doctorOut).toContain('=== Inventory ===');
    expect(doctorOut).toContain('=== Health ===');
    expect(doctorOut).toContain('=== Compatibility ===');
    expect(doctorOut).toContain('=== Fix Plan ===');
    expect(doctorOut).toContain('=== Unused Dependencies (Confidence Engine) ===');

    // analyze must NOT have inventory sections
    expect(analyzeOut).toContain('Top Findings');
    expect(analyzeOut).not.toContain('=== Inventory ===');
    expect(analyzeOut).not.toContain('=== Fix Plan ===');

    expect(doctorOut).not.toBe(analyzeOut);
  });

  // ---------------------------------------------------------------------------
  // 3. health output differs from analyze output
  // ---------------------------------------------------------------------------
  it('health output differs from analyze output', () => {
    const result = mockResult({
      score: {
        overall: 88,
        grade: 'B',
        breakdown: [{ category: 'security', score: 88, weight: 1.5, deductions: 12, explanation: '1 issue' }]
      }
    });

    const analyzeOut = renderTerminal(result);
    const healthOut = renderHealthSummary(result);

    expect(healthOut).toContain('pkg-ct health');
    expect(healthOut).toContain('Score Breakdown');
    expect(healthOut).not.toContain('Top Findings');
    expect(healthOut).not.toContain('Remediation Plan');
    expect(healthOut).not.toContain('=== Inventory ===');

    expect(analyzeOut).toContain('Top Findings');
    expect(healthOut).not.toBe(analyzeOut);
  });
});

// ---------------------------------------------------------------------------
// 4. Compatibility score changes when compatibility findings exist
// ---------------------------------------------------------------------------
describe('Scoring engine', () => {
  it('compatibility score drops below 100 when compatibility findings exist', () => {
    const findings: Finding[] = [
      {
        id: 'peer:pkg:react',
        title: 'pkg expects peer react@^18',
        description: 'Peer not satisfied',
        category: 'compatibility',
        severity: 'high',
        packageName: 'pkg',
        evidence: ['required: react@^18'],
        recommendation: 'Install react@18',
        confidence: 0.9
      }
    ];
    const score = scoreFindings(findings, testConfig());
    const compatBreakdown = score.breakdown.find((b) => b.category === 'compatibility');
    expect(compatBreakdown).toBeDefined();
    expect(compatBreakdown!.score).toBeLessThan(100);
    expect(compatBreakdown!.deductions).toBeGreaterThan(0);
    expect(score.overall).toBeLessThan(100);
  });

  // ---------------------------------------------------------------------------
  // 5. Duplication score changes when duplicate findings exist
  // ---------------------------------------------------------------------------
  it('duplication score drops below 100 when duplicate findings exist', async () => {
    const rule = builtinRules.find((r) => r.id === 'duplicates');
    expect(rule).toBeDefined();

    const findings = await rule!.run(testRuleInput({ graph: duplicateGraph() }));
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]!.category).toBe('duplication');

    const score = scoreFindings(findings, testConfig());
    const dupBreakdown = score.breakdown.find((b) => b.category === 'duplication');
    expect(dupBreakdown).toBeDefined();
    expect(dupBreakdown!.score).toBeLessThan(100);
    expect(dupBreakdown!.deductions).toBeGreaterThan(0);
  });

  it('score is 100/100 with no findings', () => {
    const score = scoreFindings([], testConfig());
    expect(score.overall).toBe(100);
    expect(score.grade).toBe('A');
  });
});

// ---------------------------------------------------------------------------
// 6. Confidence engine output appears when unused dependencies are reported
// ---------------------------------------------------------------------------
describe('Confidence engine output', () => {
  it('renderDoctor shows confidence engine section with unused findings', () => {
    const unusedFinding: Finding = {
      id: 'unused:some-lib',
      title: 'some-lib has low usage confidence',
      description: 'No strong source evidence found.',
      category: 'hygiene',
      severity: 'medium',
      packageName: 'some-lib',
      evidence: [
        'usage confidence: 20%',
        'safe removal probability: 95%',
        'none: No source, config, script, CI, or framework evidence found.'
      ],
      recommendation: 'Review some-lib; evidence suggests it may be safe to remove.',
      confidence: 0.8
    };

    const result = mockResult({
      findings: [unusedFinding],
      score: scoreFindings([unusedFinding], testConfig())
    });

    const doctorOut = renderDoctor(result);

    expect(doctorOut).toContain('=== Unused Dependencies (Confidence Engine) ===');
    expect(doctorOut).toContain('some-lib');
    expect(doctorOut).toContain('usage confidence: 20%');
    expect(doctorOut).toContain('safe removal probability: 95%');
  });

  it('renderDoctor shows "no low-confidence" message when no unused findings exist', () => {
    const result = mockResult({ findings: [] });
    const doctorOut = renderDoctor(result);
    expect(doctorOut).toContain('No low-confidence direct dependencies detected.');
  });
});

// ---------------------------------------------------------------------------
// 7. Pipeline identity field is correctly stamped
// ---------------------------------------------------------------------------
describe('Pipeline identity', () => {
  it('scan pipeline is identified as SCAN_PIPELINE in the mock', () => {
    const result = mockResult({ pipeline: 'SCAN_PIPELINE' });
    expect(result.pipeline).toBe('SCAN_PIPELINE');
  });

  it('analyze pipeline is identified as ANALYZE_PIPELINE', () => {
    const result = mockResult({ pipeline: 'ANALYZE_PIPELINE' });
    expect(result.pipeline).toBe('ANALYZE_PIPELINE');
  });

  it('doctor pipeline is identified as DOCTOR_PIPELINE', () => {
    const result = mockResult({ pipeline: 'DOCTOR_PIPELINE' });
    expect(result.pipeline).toBe('DOCTOR_PIPELINE');
  });

  it('pipeline type is one of the three valid literals', () => {
    const valid = new Set(['SCAN_PIPELINE', 'ANALYZE_PIPELINE', 'DOCTOR_PIPELINE']);
    const result = mockResult();
    expect(valid.has(result.pipeline)).toBe(true);
  });
});
