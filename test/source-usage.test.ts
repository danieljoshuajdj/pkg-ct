import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { scanSourceUsage } from '../src/scanner/source-usage.js';
import { testConfig } from './fixtures/simple-package.js';
import type { ProjectContext } from '../src/types/index.js';

describe('scanSourceUsage', () => {
  it('uses config-aware evidence to avoid framework false positives', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pkg-ct-usage-'));
    await mkdir(join(root, '.github', 'workflows'), { recursive: true });
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({
        name: 'fixture',
        scripts: { build: 'vite build' },
        dependencies: {
          react: '^19.0.0',
          'react-dom': '^19.0.0',
          tailwindcss: '^4.0.0',
          '@cloudflare/vite-plugin': '^1.0.0',
          '@tanstack/router-plugin': '^1.0.0'
        },
        devDependencies: {
          'eslint-config-prettier': '^10.0.0'
        }
      })
    );
    await writeFile(join(root, 'src.tsx'), "import React from 'react';\n");
    await writeFile(join(root, 'vite.config.ts'), "import cloudflare from '@cloudflare/vite-plugin';\nimport { TanStackRouterVite } from '@tanstack/router-plugin/vite';\n");
    await writeFile(join(root, 'tailwind.config.ts'), 'export default {};');
    await writeFile(join(root, 'eslint.config.mjs'), "export default ['prettier'];");
    await writeFile(join(root, '.github', 'workflows', 'ci.yml'), 'run: npm run build');

    const context: ProjectContext = {
      root,
      packageManager: 'npm',
      lockfile: join(root, 'package-lock.json'),
      isMonorepo: false,
      workspaceGlobs: [],
      workspaces: [],
      rootProject: {
        name: 'fixture',
        path: root,
        packageJsonPath: join(root, 'package.json'),
        dependencies: {
          react: '^19.0.0',
          'react-dom': '^19.0.0',
          tailwindcss: '^4.0.0',
          '@cloudflare/vite-plugin': '^1.0.0',
          '@tanstack/router-plugin': '^1.0.0'
        },
        devDependencies: {
          'eslint-config-prettier': '^10.0.0'
        },
        peerDependencies: {},
        optionalDependencies: {}
      },
      config: testConfig(root)
    };

    const usage = await scanSourceUsage(context);
    expect(usage.packageUsage.get('react')?.confidence).toBe(100);
    expect(usage.packageUsage.get('react-dom')?.confidence).toBeGreaterThanOrEqual(60);
    expect(usage.packageUsage.get('tailwindcss')?.confidence).toBeGreaterThanOrEqual(60);
    expect(usage.packageUsage.get('@cloudflare/vite-plugin')?.confidence).toBe(90);
    expect(usage.packageUsage.get('@tanstack/router-plugin')?.confidence).toBe(90);
    expect(usage.packageUsage.get('eslint-config-prettier')?.confidence).toBe(90);
  });
});
