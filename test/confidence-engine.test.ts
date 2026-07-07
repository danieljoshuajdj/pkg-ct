import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanSourceUsage } from '../src/scanner/source-usage.js';
import { testConfig } from './fixtures/simple-package.js';
import type { ProjectContext } from '../src/types/index.js';

describe('additive confidence engine', () => {
  it('adds distinct evidence signals and exposes their weights', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pkg-ct-confidence-'));
    await writeFile(join(root, 'package.json'), JSON.stringify({
      name: 'confidence-fixture',
      dependencies: { 'load-me': '^1.0.0' },
      scripts: { start: 'load-me serve' }
    }));
    await writeFile(
      join(root, 'index.ts'),
      "const eager = require('load-me');\nexport const lazy = () => import('load-me');\n"
    );
    const context: ProjectContext = {
      root,
      packageManager: 'npm',
      isMonorepo: false,
      workspaceGlobs: [],
      workspaces: [],
      rootProject: {
        name: 'confidence-fixture',
        path: root,
        packageJsonPath: join(root, 'package.json'),
        dependencies: { 'load-me': '^1.0.0' },
        devDependencies: {},
        peerDependencies: {},
        optionalDependencies: {}
      },
      config: testConfig(root)
    };

    const usage = await scanSourceUsage(context);
    const item = usage.packageUsage.get('load-me');
    expect(item?.confidence).toBe(40);
    expect(item?.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'dynamic', confidence: 15 }),
      expect.objectContaining({ source: 'runtime', confidence: 15 }),
      expect.objectContaining({ source: 'script', confidence: 10 })
    ]));
    expect(usage.usedPackages.has('load-me')).toBe(true);
  });
});
