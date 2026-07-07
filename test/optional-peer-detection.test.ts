import { describe, expect, it } from 'vitest';
import { builtinRules } from '../src/rules/builtin.js';
import type { AnalysisResult } from '../src/types/index.js';

describe('optional peer dependency detection', () => {
  const runRule = async (
    peerDependencies: Record<string, string>,
    peerDependenciesMeta: Record<string, { optional?: boolean }>,
    installed: Record<string, string>
  ) => {
    const nodes = new Map<string, any>();
    
    nodes.set('pkg@1.0.0', {
      id: 'pkg@1.0.0',
      name: 'pkg',
      version: '1.0.0',
      depth: 1,
      peerDependencies,
      peerDependenciesMeta,
      dependencies: {},
      dependents: ['root@0.0.0'],
      sizeBytes: 100,
      scripts: {}
    });

    for (const [name, version] of Object.entries(installed)) {
      nodes.set(`${name}@${version}`, {
        id: `${name}@${version}`,
        name,
        version,
        depth: 2,
        peerDependencies: {},
        dependencies: {},
        dependents: ['pkg@1.0.0'],
        sizeBytes: 50,
        scripts: {}
      });
    }

    const byName = new Map<string, string[]>();
    byName.set('pkg', ['pkg@1.0.0']);
    for (const name of Object.keys(installed)) {
      const v = installed[name];
      if (v) {
        byName.set(name, [`${name}@${v}`]);
      }
    }

    const result = {
      graph: {
        rootId: 'root@0.0.0',
        nodes,
        byName
      }
    } as any as AnalysisResult;

    const rule = builtinRules.find((r) => r.id === 'peer-conflicts')!;
    return await rule.run({ graph: result.graph } as any);
  };

  it('marks optional missing peers with low severity', async () => {
    const findings = await runRule(
      { less: '^3.0.0' },
      { less: { optional: true } },
      {}
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('low');
    expect(findings[0]?.title).toContain('expects optional peer less@^3.0.0');
    expect(findings[0]?.description).toContain('optional peer dependency is not installed');
  });

  it('marks optional mismatched peers with low severity', async () => {
    const findings = await runRule(
      { less: '^3.0.0' },
      { less: { optional: true } },
      { less: '2.0.0' }
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('low');
    expect(findings[0]?.title).toContain('expects optional peer less@^3.0.0');
  });

  it('marks required missing peers with medium severity', async () => {
    const findings = await runRule(
      { less: '^3.0.0' },
      {},
      {}
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('medium');
    expect(findings[0]?.title).toContain('expects peer less@^3.0.0');
  });
});
