import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import fg from 'fast-glob';
import type { ProjectContext, SourceUsage } from '../types/index.js';

const importPattern =
  /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

const sourceExtensions = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.vue',
  '.svelte',
  '.astro'
]);

export async function scanSourceUsage(context: ProjectContext, enabled = true): Promise<SourceUsage> {
  if (!enabled) return { usedPackages: new Set(), filesScanned: 0, importCount: 0 };

  const files = await fg(['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,vue,svelte,astro}'], {
    cwd: context.root,
    absolute: true,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.nuxt/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/.nx/**'
    ]
  });

  const usedPackages = new Set<string>();
  let importCount = 0;

  await Promise.all(
    files.map(async (file) => {
      if (!sourceExtensions.has(extname(file))) return;
      const source = await readFile(file, 'utf8');
      for (const match of source.matchAll(importPattern)) {
        const specifier = match[1] ?? match[2] ?? match[3];
        if (!specifier || specifier.startsWith('.') || specifier.startsWith('node:')) continue;
        const packageName = packageNameFromSpecifier(specifier);
        if (packageName) {
          usedPackages.add(packageName);
          importCount += 1;
        }
      }
    })
  );

  addImplicitToolingUsage(context, usedPackages);
  return { usedPackages, filesScanned: files.length, importCount };
}

function packageNameFromSpecifier(specifier: string): string {
  if (specifier.startsWith('@')) {
    const [scope, name] = specifier.split('/');
    return scope && name ? `${scope}/${name}` : specifier;
  }
  return specifier.split('/')[0] ?? specifier;
}

function addImplicitToolingUsage(context: ProjectContext, used: Set<string>): void {
  const scripts = Object.values(context.rootProject.dependencies)
    .concat(Object.values(context.rootProject.devDependencies))
    .join(' ');
  const packageScripts = Object.values({
    ...context.rootProject.dependencies,
    ...context.rootProject.devDependencies
  });
  void scripts;
  for (const name of packageScripts) void name;

  const directNames = Object.keys({
    ...context.rootProject.dependencies,
    ...context.rootProject.devDependencies
  });
  const knownConfigDriven = [
    'typescript',
    'eslint',
    'prettier',
    'vitest',
    'jest',
    'tsup',
    'tsx',
    'webpack',
    'vite',
    'rollup',
    'unbuild',
    '@types/node'
  ];
  for (const name of directNames) {
    if (knownConfigDriven.includes(name) || name.startsWith('@types/')) used.add(name);
  }
}
