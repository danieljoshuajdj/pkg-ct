import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { detectMissingDependencies } from '../src/scanner/missing-deps.js';
import type { ProjectContext } from '../src/types/index.js';

describe('detectMissingDependencies', () => {
  it('excludes path aliases from missing packages list', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pkg-ct-missing-'));
    await mkdir(join(root, 'src', 'components'), { recursive: true });
    
    // Create configs and source files
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        dependencies: {
          react: '^19.0.0'
        }
      })
    );
    await writeFile(
      join(root, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          paths: {
            '@/*': ['./src/*'],
            '~/*': ['./src/*']
          }
        }
      })
    );
    await writeFile(
      join(root, 'src/index.ts'),
      `
      import React from 'react';
      import { Button } from '@/components/Button';
      import { helper } from '~/utils/helper';
      import { something } from 'components/something'; // maps to local folder
      import { missingThing } from 'real-missing-package';
      `
    );
    
    // Mock local directory 'components' in root
    await mkdir(join(root, 'components'), { recursive: true });
    await writeFile(join(root, 'components/something.ts'), 'export const something = 1;');

    const context: ProjectContext = {
      root,
      packageManager: 'npm',
      isMonorepo: false,
      workspaceGlobs: [],
      workspaces: [],
      rootProject: {
        name: 'test-project',
        path: root,
        packageJsonPath: join(root, 'package.json'),
        dependencies: { react: '^19.0.0' },
        devDependencies: {},
        peerDependencies: {},
        optionalDependencies: {}
      },
      config: {
        root,
        offline: true,
        ai: { provider: 'none' },
        ignorePackages: [],
        rules: {},
        scoring: {
          security: 1.8,
          compatibility: 1.4,
          hygiene: 1.0,
          freshness: 0.8,
          duplication: 1.0,
          maintainability: 1.2,
          'install-performance': 0.6,
          'runtime-impact': 1.0,
          'bundle-impact': 1.0
        },
        ci: { failOn: 'high', minScore: 70 },
        plugins: []
      }
    };

    const result = await detectMissingDependencies(context);
    const missingNames = result.missing.map(m => m.packageName);
    
    // Path aliases must NOT be in the missing list
    expect(missingNames).not.toContain('@/components/Button');
    expect(missingNames).not.toContain('~/utils/helper');
    expect(missingNames).not.toContain('components/something');
    
    // Real missing dependency must be in the missing list
    expect(missingNames).toContain('real-missing-package');
  });
});
