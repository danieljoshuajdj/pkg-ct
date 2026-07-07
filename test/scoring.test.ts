import { describe, expect, it } from 'vitest';
import { scoreFindings } from '../src/health/scoring.js';
import { testConfig } from './fixtures/simple-package.js';
import type { Finding } from '../src/types/index.js';

describe('scoreFindings', () => {
  it('returns a perfect score when there are no findings', () => {
    expect(scoreFindings([], testConfig()).overall).toBe(100);
  });

  it('deducts weighted severity impact', () => {
    const findings: Finding[] = [
      {
        id: 'x',
        title: 'High security issue',
        description: 'test',
        category: 'security',
        severity: 'high',
        evidence: ['evidence'],
        recommendation: 'fix it',
        confidence: 1
      }
    ];
    const score = scoreFindings(findings, testConfig());
    expect(score.overall).toBeLessThan(100);
    expect(score.breakdown.find((item) => item.category === 'security')?.score).toBeLessThan(100);
  });

  it('groups findings by package family, type, and severity to score root causes instead of occurrences', () => {
    const findings: Finding[] = Array.from({ length: 12 }, (_, i) => ({
      id: `duplicates:esbuild:${i}`,
      title: `esbuild version conflict ${i}`,
      description: 'test',
      category: 'duplication',
      severity: 'medium',
      packageName: 'esbuild',
      evidence: ['evidence'],
      recommendation: 'fix it',
      confidence: 1
    }));
    
    const scoreSingle = scoreFindings([findings[0]!], testConfig());
    const scoreTwelve = scoreFindings(findings, testConfig());
    
    expect(scoreTwelve.overall).toBe(scoreSingle.overall);
  });
});
