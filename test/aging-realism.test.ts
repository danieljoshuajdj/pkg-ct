import { describe, expect, it } from 'vitest';
import { calculateAging } from '../src/health/aging.js';
import type { AnalysisResult } from '../src/types/index.js';

describe('calculateAging realism validation', () => {
  const buildResult = (nodes: any[], intelligence: any[]): AnalysisResult => {
    const nodeMap = new Map<string, any>();
    const byName = new Map<string, string[]>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
      const list = byName.get(node.name) ?? [];
      list.push(node.id);
      byName.set(node.name, list);
    }
    return {
      context: {
        rootProject: {
          dependencies: {},
          devDependencies: {}
        }
      },
      graph: {
        rootId: 'root-pkg@1.0.0',
        nodes: nodeMap,
        byName
      },
      packageIntelligence: intelligence,
      findings: [],
      score: { overall: 100, breakdown: [] }
    } as any as AnalysisResult;
  };

  it('registry metadata: uses registry metadata publish age when available', () => {
    const result = buildResult(
      [
        { id: 'some-pkg@1.0.0', name: 'some-pkg', version: '1.0.0', dependents: [] }
      ],
      [
        { name: 'some-pkg', ageDays: 120 }
      ]
    );
    const aging = calculateAging(result);
    expect(aging.averageAgeDays).toBe(120);
  });

  it('missing metadata: falls back to semver heuristic or 90 days minimum', () => {
    const result = buildResult(
      [
        { id: 'some-pkg@0.0.1', name: 'some-pkg', version: '0.0.1', dependents: [] }
      ],
      []
    );
    const aging = calculateAging(result);
    // major (0) * 365 + minor (0) * 30 = 0 -> minimum fallback = 90
    expect(aging.averageAgeDays).toBe(90);
  });

  it('future date: ignores ageDays if it is negative or future or too large', () => {
    const result = buildResult(
      [
        { id: 'future-pkg@1.0.0', name: 'future-pkg', version: '1.0.0', dependents: [] }
      ],
      [
        { name: 'future-pkg', ageDays: -50 } // negative
      ]
    );
    const aging = calculateAging(result);
    // falls back to heuristic: 1 * 365 + 0 = 365 days
    expect(aging.averageAgeDays).toBe(365);
  });

  it('invalid timestamp: ignores ageDays if > 36500 (100 years)', () => {
    const result = buildResult(
      [
        { id: 'workerd@1.20240501.0', name: 'workerd', version: '1.20240501.0', dependents: [] }
      ],
      [
        { name: 'workerd', ageDays: 500000 } // too large
      ]
    );
    const aging = calculateAging(result);
    // workerd is in KNOWN_AGES as 2 years (730 days)
    expect(aging.averageAgeDays).toBe(730);
  });

  it('workspace version: ignores workspace prefix and coerces version', () => {
    const result = buildResult(
      [
        { id: 'workspace-pkg@workspace:^1.2.3', name: 'workspace-pkg', version: 'workspace:^1.2.3', dependents: [] }
      ],
      []
    );
    const aging = calculateAging(result);
    // should coerce workspace:^1.2.3 to 1.2.3 -> 1 * 365 + 2 * 30 = 425 days
    expect(aging.averageAgeDays).toBe(425);
  });

  it('offline mode: works with empty registry intelligence', () => {
    const result = buildResult(
      [
        { id: 'some-pkg@2.3.0', name: 'some-pkg', version: '2.3.0', dependents: [] }
      ],
      []
    );
    const aging = calculateAging(result);
    expect(aging.averageAgeDays).toBe(2 * 365 + 3 * 30); // 820 days
  });

  it('known package fallback: maps workerd and wrangler accurately', () => {
    const result = buildResult(
      [
        { id: 'workerd@1.20240501.0', name: 'workerd', version: '1.20240501.0', dependents: [] },
        { id: 'wrangler@3.0.0', name: 'wrangler', version: '3.0.0', dependents: [] }
      ],
      []
    );
    const aging = calculateAging(result);
    // workerd (730) + wrangler (1460) = 2190. Average is 1095.
    expect(aging.averageAgeDays).toBe(1095);
  });
});
