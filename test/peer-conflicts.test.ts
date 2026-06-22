import { describe, expect, it } from 'vitest';
import { builtinRules } from '../src/rules/builtin.js';
import type { AnalysisResult, Finding } from '../src/types/index.js';

describe('peer-conflicts rule', () => {
  const runRule = async (peerDependencies: Record<string, string>, installed: Record<string, string>): Promise<Finding[]> => {
    const nodes = new Map<string, any>();
    
    // Add the package under test
    nodes.set('pkg@1.0.0', {
      id: 'pkg@1.0.0',
      name: 'pkg',
      version: '1.0.0',
      depth: 1,
      peerDependencies,
      dependencies: {},
      dependents: ['root@0.0.0'],
      sizeBytes: 100,
      scripts: {}
    });

    // Add installed packages
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

  it('passes on exact match', async () => {
    const findings = await runRule({ react: '19.2.6' }, { react: '19.2.6' });
    expect(findings).toHaveLength(0);
  });

  it('passes on caret range', async () => {
    const findings = await runRule({ react: '^19.0.0' }, { react: '19.2.6' });
    expect(findings).toHaveLength(0);
  });

  it('passes on tilde range', async () => {
    const findings = await runRule({ react: '~19.2.0' }, { react: '19.2.6' });
    expect(findings).toHaveLength(0);
  });

  it('passes on complex OR range', async () => {
    const findings = await runRule({ react: '>=18.0.0 || >=19.0.0' }, { react: '19.2.6' });
    expect(findings).toHaveLength(0);
  });

  it('passes on workspace prefix range', async () => {
    const findings = await runRule({ react: 'workspace:^19.0.0' }, { react: '19.2.6' });
    expect(findings).toHaveLength(0);
  });

  it('passes on workspace ranges inside OR range', async () => {
    const findings = await runRule({ react: 'workspace:^18.0.0 || workspace:^19.0.0' }, { react: '19.2.6' });
    expect(findings).toHaveLength(0);
  });

  it('passes on prerelease validation', async () => {
    const findings = await runRule({ react: '^19.0.0' }, { react: '19.0.0-rc.1' });
    expect(findings).toHaveLength(0);
  });

  it('fails on invalid peer range compatibility', async () => {
    const findings = await runRule({ react: '^18.0.0' }, { react: '19.2.6' });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toContain('expects peer react@^18.0.0');
  });

  it('fails on missing peer dependency', async () => {
    const findings = await runRule({ react: '^18.0.0' }, {});
    expect(findings).toHaveLength(1);
    expect(findings[0]?.description).toContain('is not installed');
  });

  it('ignores invalid range strings (invalid peer)', async () => {
    const findings = await runRule({ react: 'not-a-valid-semver-range' }, { react: '19.2.6' });
    expect(findings).toHaveLength(0);
  });
});
