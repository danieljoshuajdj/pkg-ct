import { describe, expect, it } from 'vitest';
import { detectMissingDependencies } from '../src/scanner/missing-deps.js';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import tmp from 'node:os';

describe('alias resolution and workspace hardening', () => {
  it('correctly ignores tsconfig path aliases, custom configuration aliases, and local workspace links', async () => {
    // Create a temporary workspace root
    const root = await mkdtemp(join(tmp.tmpdir(), 'pkg-ct-missing-test-'));
    
    // Create direct source files with aliased imports
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(
      join(root, 'src', 'index.ts'),
      `
      import '@/components/Button';
      import '~/hooks/useAuth';
      import '#utils/math';
      import 'shared/Button';
      import 'local-pkg';
      `
    );

    // Create tsconfig.json defining compile path aliases
    const tsconfig = {
      compilerOptions: {
        paths: {
          "@/*": ["src/*"],
          "~/*": ["src/*"]
        }
      }
    };
    await writeFile(join(root, 'tsconfig.json'), JSON.stringify(tsconfig));

    // Create a custom vite.config.ts with path alias declarations
    const viteConfig = `
      export default {
        resolve: {
          alias: {
            "shared": "./src/shared",
            "#utils": "./src/utils"
          }
        }
      };
    `;
    await writeFile(join(root, 'vite.config.ts'), viteConfig);

    // Create local-pkg folder in root to verify workspace-local file existence checks
    await mkdir(join(root, 'local-pkg'), { recursive: true });
    await writeFile(join(root, 'local-pkg', 'index.ts'), 'export const a = 1;');

    const mockContext = {
      root,
      isMonorepo: false,
      workspaces: [],
      rootProject: {
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
        optionalDependencies: {}
      },
      config: {
        root,
        ignorePackages: []
      }
    } as any;

    const result = await detectMissingDependencies(mockContext);
    
    // All of the imported items should be skipped as path aliases or local packages, resulting in 0 missing dependencies.
    expect(result.missing).toHaveLength(0);
  });
});
