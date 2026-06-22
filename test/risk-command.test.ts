import { describe, expect, it } from 'vitest';
import { predictInstallRisk } from '../src/risk/predictor.js';
import type { Finding } from '../src/types/index.js';

describe('predictInstallRisk command validation', () => {
  const baseContext = {
    packageManager: 'npm',
    isMonorepo: false,
    rootProject: {
      dependencies: {},
      devDependencies: {}
    }
  } as any;

  const baseGraph = {
    byName: new Map(),
    nodes: new Map()
  } as any;

  it('reports low risk and no conflicts for clean package installs', () => {
    const findings: Finding[] = [];
    const prediction = predictInstallRisk('lodash@4.17.21', baseContext, baseGraph, findings);
    expect(prediction.risk).toBe('low');
    expect(prediction.likelyConflicts).toHaveLength(0);
  });

  it('includes potential peer conflicts only when findings show genuine compatibility issues', () => {
    const findings: Finding[] = [
      {
        id: 'peer:some-pkg:react',
        title: 'some-pkg expects peer react@^18.0.0',
        description: 'Peer mismatch',
        category: 'compatibility',
        severity: 'high',
        packageName: 'react',
        evidence: [],
        recommendation: 'Fix it',
        confidence: 0.9
      }
    ];
    const prediction = predictInstallRisk('react@19.2.6', baseContext, baseGraph, findings);
    expect(prediction.likelyConflicts).toContain('react');
  });
});
