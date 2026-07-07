import { describe, expect, it } from 'vitest';
import { prioritizeVulnerability } from '../src/scanner/security.js';
import type { AnalysisResult, AuditVulnerability } from '../src/types/index.js';

const vulnerability: AuditVulnerability = {
  name: 'shell-quote',
  severity: 'high',
  title: 'Command injection',
  fixAvailable: true,
  via: ['GHSA-example']
};

function resultFor(options: { dev: boolean; imported: boolean; directProd: boolean }): AnalysisResult {
  const node = {
    id: 'shell-quote@1.0.0',
    name: 'shell-quote',
    version: '1.0.0',
    depth: 1,
    dev: options.dev,
    peerDependencies: {},
    dependencies: {},
    dependents: ['root@1.0.0'],
    sizeBytes: 10,
    scripts: {}
  };
  return {
    context: {
      rootProject: {
        dependencies: options.directProd ? { 'shell-quote': '^1.0.0' } : {},
        devDependencies: options.directProd ? {} : { 'shell-quote': '^1.0.0' }
      }
    },
    graph: {
      rootId: 'root@1.0.0',
      nodes: new Map([[node.id, node]]),
      byName: new Map([['shell-quote', [node.id]]])
    },
    usage: {
      usedPackages: new Set(options.imported ? ['shell-quote'] : []),
      packageUsage: new Map([['shell-quote', {
        name: 'shell-quote',
        confidence: options.imported ? 40 : 0,
        evidence: options.imported
          ? [{ source: 'source', file: 'src/run.ts', detail: 'Static import: shell-quote', confidence: 40 }]
          : [{ source: 'none', detail: 'No usage evidence found.', confidence: 0 }],
        safeRemovalProbability: options.imported ? 8 : 95,
        role: options.dev ? 'DEVELOPMENT' : 'PRODUCTION_RUNTIME'
      }]]),
      filesScanned: 1,
      importCount: options.imported ? 1 : 0
    }
  } as any as AnalysisResult;
}

describe('security prioritization', () => {
  it('downgrades a development-only advisory with explicit reasoning', () => {
    const triage = prioritizeVulnerability(
      resultFor({ dev: true, imported: false, directProd: false }),
      vulnerability
    );
    expect(triage).toMatchObject({
      severity: 'high',
      reachability: 'LOW',
      exploitability: 'UNKNOWN',
      productionRelevance: 'Development only',
      priority: 'LOW'
    });
    expect(triage.reason).toContain('not reachable in the production tree');
  });

  it('prioritizes a source-referenced production advisory', () => {
    const triage = prioritizeVulnerability(
      resultFor({ dev: false, imported: true, directProd: true }),
      vulnerability
    );
    expect(triage).toMatchObject({
      reachability: 'HIGH',
      productionRelevance: 'Production critical',
      priority: 'HIGH'
    });
    expect(triage.evidence).toContain('Source/runtime reference found');
  });
});
