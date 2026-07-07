import { describe, expect, it } from 'vitest';
import { builtinRules } from '../src/rules/builtin.js';
import type { AnalysisResult } from '../src/types/index.js';

describe('duplicate version severity calibration', () => {
  const runRule = async (packageName: string, versions: string[]) => {
    const nodes = new Map<string, any>();
    
    // Add the package under test
    nodes.set('root@0.0.0', {
      id: 'root@0.0.0',
      name: 'root',
      version: '0.0.0',
      depth: 0,
      peerDependencies: {},
      dependencies: { [packageName]: '*' },
      dependents: [],
      sizeBytes: 0,
      scripts: {}
    });

    const ids: string[] = [];
    versions.forEach((v) => {
      const id = `${packageName}@${v}`;
      ids.push(id);
      nodes.set(id, {
        id,
        name: packageName,
        version: v,
        depth: 1,
        peerDependencies: {},
        dependencies: {},
        dependents: ['root@0.0.0'],
        sizeBytes: 100,
        scripts: {}
      });
    });

    const byName = new Map<string, string[]>();
    byName.set(packageName, ids);

    const result = {
      graph: {
        rootId: 'root@0.0.0',
        nodes,
        byName
      }
    } as any as AnalysisResult;

    const rule = builtinRules.find((r) => r.id === 'duplicates')!;
    return await rule.run({ graph: result.graph } as any);
  };

  it('assigns low severity to same-major version duplicates', async () => {
    const findings = await runRule('esbuild', ['0.27.3', '0.27.7']);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('low');
    expect(findings[0]?.evidence).toContain('SemVer distance: patch');
    expect(findings[0]?.evidence).toContain('esbuild@0.27.3 required by root project');
  });

  it('assigns medium severity to different-major version duplicates (2 majors)', async () => {
    const findings = await runRule('react', ['17.0.2', '18.2.0']);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('medium');
  });

  it('assigns high severity to duplicates with three or more majors', async () => {
    const findings = await runRule('react', ['16.14.0', '17.0.2', '18.2.0']);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('high');
  });
});
