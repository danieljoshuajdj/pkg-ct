import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import fg from 'fast-glob';
import type { ProjectContext } from '../types/index.js';

export interface MissingDependency {
  packageName: string;
  referencedIn: string[];
  risk: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface MissingDepsResult {
  missing: MissingDependency[];
  scannedFiles: number;
}

const importPattern =
  /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

const sourceGlobs = ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,vue,svelte,astro}'];
const ignore = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/coverage/**'
];

function packageNameFromSpecifier(specifier: string): string {
  if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('node:')) {
    return '';
  }
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
  }
  return specifier.split('/')[0] ?? specifier;
}

export async function detectMissingDependencies(context: ProjectContext): Promise<MissingDepsResult> {
  const declared = new Set<string>([
    ...Object.keys(context.rootProject.dependencies),
    ...Object.keys(context.rootProject.devDependencies),
    ...Object.keys(context.rootProject.peerDependencies),
    ...Object.keys(context.rootProject.optionalDependencies)
  ]);

  // Node built-ins we should ignore (non-exhaustive, covers the common ones)
  const builtins = new Set([
    'node:path', 'node:fs', 'node:os', 'node:url', 'node:util', 'node:events',
    'node:stream', 'node:buffer', 'node:child_process', 'node:crypto', 'node:http',
    'node:https', 'node:net', 'node:readline', 'node:worker_threads', 'node:perf_hooks',
    'node:assert', 'node:process', 'node:timers', 'node:cluster', 'node:dns', 'node:tls',
    'path', 'fs', 'os', 'url', 'util', 'events', 'stream', 'buffer', 'crypto',
    'http', 'https', 'net', 'child_process', 'readline', 'worker_threads', 'assert',
    'perf_hooks', 'process', 'timers', 'cluster', 'dns', 'tls', 'querystring', 'vm',
    'zlib', 'module', 'v8', 'inspector', 'repl', 'string_decoder', 'trace_events'
  ]);

  const configAliases = new Set<string>();

  // Read tsconfig.json and jsconfig.json to load path aliases
  for (const filename of ['tsconfig.json', 'jsconfig.json']) {
    try {
      const content = await readFile(join(context.root, filename), 'utf8');
      const clean = content.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
      const parsed = JSON.parse(clean);
      const paths = parsed?.compilerOptions?.paths ?? {};
      for (const key of Object.keys(paths)) {
        const cleanKey = key.replace(/\/\*$/, '');
        configAliases.add(cleanKey);
        if (cleanKey.endsWith('/')) {
          configAliases.add(cleanKey.slice(0, -1));
        }
      }
    } catch {
      // ignore errors
    }
  }

  // Scan vite/webpack/next/rspack configurations for custom aliases
  try {
    const configFiles = await fg(['vite.config.*', 'webpack.config.*', 'next.config.*', 'rspack.config.*'], {
      cwd: context.root,
      absolute: true
    });
    for (const file of configFiles) {
      try {
        const content = await readFile(file, 'utf8');
        const aliasRegex = /['"]?([@\w\d_-~#]+)['"]?\s*:\s*['"][.\/\w\d_-]+['"]/g;
        for (const match of content.matchAll(aliasRegex)) {
          if (match[1]) configAliases.add(match[1]);
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }

  // References: packageName -> [files]
  const references = new Map<string, Set<string>>();

  const sourceFiles = await fg(sourceGlobs, { cwd: context.root, absolute: true, ignore });

  await Promise.all(
    sourceFiles.map(async (file) => {
      const source = await readFile(file, 'utf8').catch(() => '');
      const rel = relative(context.root, file);
      for (const match of source.matchAll(importPattern)) {
        const specifier = match[1] ?? match[2] ?? match[3];
        if (!specifier) continue;

        // Skip absolute, relative, or built-in node packages
        if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('node:')) continue;

        // Skip prefix aliases
        if (specifier.startsWith('@/') || specifier.startsWith('~/') || specifier.startsWith('#') ||
            specifier.startsWith('src/') || specifier.startsWith('app/')) continue;

        // Skip package if it matches registered tsconfig/jsconfig paths or config aliases
        const firstSegment = specifier.split('/')[0] ?? '';
        if (configAliases.has(firstSegment) || configAliases.has(specifier)) continue;
        if (specifier.startsWith('@')) {
          const parts = specifier.split('/');
          const scopePkg = parts.slice(0, 2).join('/');
          if (configAliases.has(scopePkg) || configAliases.has(parts[0] ?? '')) continue;
        }

        // Skip if firstSegment points to a folder or file existing locally in root, src, or app
        const localDirs = ['', 'src', 'app'];
        let isLocal = false;
        for (const dir of localDirs) {
          const checkPath = join(context.root, dir, firstSegment);
          if (existsSync(checkPath)) {
            isLocal = true;
            break;
          }
        }
        if (isLocal) continue;

        const pkg = packageNameFromSpecifier(specifier);
        if (!pkg || builtins.has(pkg) || builtins.has(specifier)) continue;
        if (!references.has(pkg)) references.set(pkg, new Set());
        references.get(pkg)!.add(rel);
      }
    })
  );

  const missing: MissingDependency[] = [];
  for (const [pkg, files] of references) {
    if (declared.has(pkg)) continue;
    // Skip packages that are sub-paths of declared packages (e.g. react/jsx-runtime when react is declared)
    const rootPkg = pkg.startsWith('@') ? pkg : pkg.split('/')[0] ?? pkg;
    if (declared.has(rootPkg)) continue;

    const fileList = [...files];
    missing.push({
      packageName: pkg,
      referencedIn: fileList,
      risk: fileList.length >= 5 ? 'HIGH' : fileList.length >= 2 ? 'MEDIUM' : 'LOW'
    });
  }

  // Sort by risk then count
  missing.sort((a, b) => {
    const riskRank = { HIGH: 2, MEDIUM: 1, LOW: 0 };
    const riskDiff = riskRank[b.risk] - riskRank[a.risk];
    return riskDiff !== 0 ? riskDiff : b.referencedIn.length - a.referencedIn.length;
  });

  return { missing, scannedFiles: sourceFiles.length };
}
