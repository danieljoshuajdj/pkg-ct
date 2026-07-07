import { describe, expect, it } from 'vitest';
import { builtinRules } from '../src/rules/builtin.js';

describe('install impact evidence', () => {
  it('shows the introducer chain, transitive reference count, and impact rating', async () => {
    const target = {
      id: 'color-name@1.1.4',
      name: 'color-name',
      version: '1.1.4',
      depth: 4,
      peerDependencies: {},
      dependencies: {},
      dependents: Array.from({ length: 15 }, (_, index) => `parent-${index}@1.0.0`),
      sizeBytes: 1024,
      scripts: {}
    };
    const parents = target.dependents.map((id, index) => [id, {
      id,
      name: `parent-${index}`,
      version: '1.0.0',
      depth: 3,
      peerDependencies: {},
      dependencies: { 'color-name': '^1.1.4' },
      dependents: [],
      sizeBytes: 1024,
      scripts: {}
    }] as const);
    const graph = {
      rootId: 'root@1.0.0',
      nodes: new Map<string, any>([[target.id, target], ...parents]),
      edges: [],
      byName: new Map([['color-name', [target.id]]])
    };
    const rule = builtinRules.find((item) => item.id === 'dependency-bloat')!;
    const findings = await rule.run({ graph } as any);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.evidence).toEqual(expect.arrayContaining([
      'Referenced by: 15 packages',
      'Install impact: HIGH'
    ]));
    expect(findings[0]?.description).toContain('Introduced by:');
  });
});
