import { readFile } from 'node:fs/promises';
import { basename, extname, relative } from 'node:path';
import fg from 'fast-glob';
import type {
  DependencyRole,
  PackageUsage,
  PackageUsageEvidence,
  ProjectContext,
  SourceUsage,
  DependencyGraph
} from '../types/index.js';
import { readJson } from '../utils/fs.js';

const staticImportPattern =
  /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
const dynamicImportPattern = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const runtimeRequirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

const sourceGlobs = ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,vue,svelte,astro}'];
const configGlobs = [
  '**/vite.config.*',
  '**/eslint.config.*',
  '**/.eslintrc*',
  '**/tailwind.config.*',
  '**/postcss.config.*',
  '**/wrangler.toml',
  '**/Dockerfile*',
  '**/tsconfig.json',
  '**/astro.config.*',
  '**/next.config.*',
  '**/nuxt.config.*',
  '**/svelte.config.*',
  '**/rollup.config.*',
  '**/webpack.config.*',
  '**/vitest.config.*',
  '**/playwright.config.*',
  '**/jest.config.*',
  '**/cypress.config.*',
  '.github/workflows/**'
];
const ignore = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/coverage/**',
  '**/.turbo/**',
  '**/.nx/**'
];
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

export async function scanSourceUsage(context: ProjectContext, enabled = true, graph?: DependencyGraph): Promise<SourceUsage> {
  if (!enabled) return emptyUsage();

  const direct = directDependencies(context);
  const usage = new Map<string, PackageUsage>();
  for (const [name, kind] of Object.entries(direct)) {
    usage.set(name, {
      name,
      confidence: 0,
      evidence: [{ source: 'none', detail: 'No usage evidence found.', confidence: 0 }],
      safeRemovalProbability: kind === 'dev' ? 95 : 75,
      role: roleFor(name, kind)
    });
  }

  let importCount = 0;
  const [sourceFiles, configFiles] = await Promise.all([
    fg(sourceGlobs, { cwd: context.root, absolute: true, ignore }),
    fg(configGlobs, { cwd: context.root, absolute: true, ignore, dot: true })
  ]);
  const configFileSet = new Set(configFiles);
  await Promise.all(
    sourceFiles.map(async (file) => {
      if (!sourceExtensions.has(extname(file)) || configFileSet.has(file)) return;
      const source = await readFile(file, 'utf8');
      for (const match of source.matchAll(staticImportPattern)) {
        const specifier = match[1];
        if (!specifier || specifier.startsWith('.') || specifier.startsWith('node:')) continue;
        const packageName = packageNameFromSpecifier(specifier);
        importCount += 1;
        addEvidence(usage, packageName, {
          source: 'source',
          file: relative(context.root, file),
          detail: `Static import: ${specifier}`,
          confidence: 40
        });
      }
      for (const match of source.matchAll(dynamicImportPattern)) {
        const specifier = match[1];
        if (!specifier || specifier.startsWith('.') || specifier.startsWith('node:')) continue;
        const packageName = packageNameFromSpecifier(specifier);
        importCount += 1;
        addEvidence(usage, packageName, {
          source: 'dynamic',
          file: relative(context.root, file),
          detail: `Dynamic import: ${specifier}`,
          confidence: 15
        });
      }
      for (const match of source.matchAll(runtimeRequirePattern)) {
        const specifier = match[1];
        if (!specifier || specifier.startsWith('.') || specifier.startsWith('node:')) continue;
        const packageName = packageNameFromSpecifier(specifier);
        importCount += 1;
        addEvidence(usage, packageName, {
          source: 'runtime',
          file: relative(context.root, file),
          detail: `Runtime require: ${specifier}`,
          confidence: 15
        });
      }
    })
  );

  await Promise.all(
    configFiles.map(async (file) => {
      const content = await readFile(file, 'utf8');
      const rel = relative(context.root, file);
      for (const name of usage.keys()) {
        if (isReferencedByConfig(name, content, basename(file))) {
          addEvidence(usage, name, {
            source: 'config',
            file: rel,
            detail: `Referenced by ${rel}`,
            confidence: 20
          });
        }
      }
    })
  );

  await addPackageScriptEvidence(context, usage);
  await addCiEvidence(context, usage);
  addWorkspaceEvidence(context, usage);
  addPeerEvidence(graph, usage);
  addFrameworkEvidence(usage);
  addBuildPluginEvidence(usage);

  // Naming is weak evidence and is only used when no concrete signal exists.
  for (const name of usage.keys()) {
    const item = usage.get(name)!;
    if (item.evidence.length === 0 || item.evidence.every((evidence) => evidence.source === 'none')) {
      if (name.startsWith('@types/')) {
        addEvidence(usage, name, {
          source: 'weak',
          detail: 'Heuristic: TypeScript declaration package may be loaded by the compiler.',
          confidence: 5
        });
      } else if (name.includes('plugin') || name.includes('preset') || name.includes('loader') || name.includes('config')) {
        addEvidence(usage, name, {
          source: 'weak',
          detail: 'Heuristic: plugin/config naming may indicate implicit loading.',
          confidence: 5
        });
      }
    }
  }

  const usedPackages = new Set<string>();
  for (const item of usage.values()) {
    const contributions = new Map<string, number>();
    for (const evidence of item.evidence) {
      contributions.set(evidence.source, Math.max(contributions.get(evidence.source) ?? 0, evidence.confidence));
    }
    item.confidence = Math.min(100, [...contributions.values()].reduce((total, contribution) => total + contribution, 0));
    
    // Check transitive impact if graph is available
    const hasDependents = graph
      ? (graph.byName.get(item.name) ?? [])
          .map(id => graph.nodes.get(id))
          .some(node => node?.dependents.some((dependentId) => dependentId !== graph.rootId))
      : false;
      
    item.safeRemovalProbability = calculateSafeRemovalProbability(item, direct[item.name] ?? 'prod', hasDependents);
    if (item.evidence.some((evidence) => evidence.source !== 'none' && evidence.source !== 'weak')) {
      usedPackages.add(item.name);
    }
  }

  return { usedPackages, packageUsage: usage, filesScanned: sourceFiles.length + configFiles.length, importCount };
}

function emptyUsage(): SourceUsage {
  return { usedPackages: new Set(), packageUsage: new Map(), filesScanned: 0, importCount: 0 };
}

function packageNameFromSpecifier(specifier: string): string {
  if (specifier.startsWith('@')) {
    const [scope, name] = specifier.split('/');
    return scope && name ? `${scope}/${name}` : specifier;
  }
  return specifier.split('/')[0] ?? specifier;
}

export function directDependencies(context: ProjectContext): Record<string, 'prod' | 'dev' | 'optional' | 'peer'> {
  return {
    ...Object.fromEntries(Object.keys(context.rootProject.dependencies).map((name) => [name, 'prod'] as const)),
    ...Object.fromEntries(Object.keys(context.rootProject.devDependencies).map((name) => [name, 'dev'] as const)),
    ...Object.fromEntries(Object.keys(context.rootProject.optionalDependencies).map((name) => [name, 'optional'] as const)),
    ...Object.fromEntries(Object.keys(context.rootProject.peerDependencies).map((name) => [name, 'peer'] as const))
  };
}

async function addPackageScriptEvidence(context: ProjectContext, usage: Map<string, PackageUsage>): Promise<void> {
  const packageJson = await readJson<{ scripts?: Record<string, string> }>(context.rootProject.packageJsonPath);
  const scripts = Object.entries(packageJson.scripts ?? {});
  for (const [script, command] of scripts) {
    for (const name of usage.keys()) {
      if (matchesPackageCommand(name, command)) {
        addEvidence(usage, name, {
          source: 'script',
          file: 'package.json',
          detail: `Used in script "${script}"`,
          confidence: 10
        });
      }
    }
  }
}

async function addCiEvidence(context: ProjectContext, usage: Map<string, PackageUsage>): Promise<void> {
  const files = await fg(['.github/workflows/**'], { cwd: context.root, absolute: true, dot: true, ignore });
  await Promise.all(
    files.map(async (file) => {
      const content = await readFile(file, 'utf8');
      const rel = relative(context.root, file);
      for (const name of usage.keys()) {
        if (matchesPackageCommand(name, content) || content.includes(name)) {
          addEvidence(usage, name, {
            source: 'ci',
            file: rel,
            detail: `Referenced by ${rel}`,
            confidence: 5
          });
        }
      }
    })
  );
}

function addFrameworkEvidence(usage: Map<string, PackageUsage>): void {
  for (const name of usage.keys()) {
    const role = roleFor(name, 'prod');
    if (role === 'FRAMEWORK' || role === 'CORE_RUNTIME' || knownConfigPackage(name)) {
      addEvidence(usage, name, {
        source: 'framework',
        detail: `Declared package has known ${role.toLowerCase().replace('_', ' ')} metadata.`,
        confidence: 10
      });
    }
  }
}

function addWorkspaceEvidence(context: ProjectContext, usage: Map<string, PackageUsage>): void {
  for (const workspace of context.workspaces) {
    const declared = new Set([
      ...Object.keys(workspace.dependencies),
      ...Object.keys(workspace.devDependencies),
      ...Object.keys(workspace.optionalDependencies),
      ...Object.keys(workspace.peerDependencies)
    ]);
    for (const name of declared) {
      addEvidence(usage, name, {
        source: 'workspace',
        file: relative(context.root, workspace.packageJsonPath),
        detail: `Declared by workspace ${workspace.name}`,
        confidence: 10
      });
    }
  }
}

function addPeerEvidence(graph: DependencyGraph | undefined, usage: Map<string, PackageUsage>): void {
  if (!graph) return;
  for (const node of graph.nodes.values()) {
    for (const peerName of Object.keys(node.peerDependencies)) {
      addEvidence(usage, peerName, {
        source: 'peer',
        detail: `Required as a peer by ${node.name}@${node.version}`,
        confidence: 10
      });
    }
  }
}

function addBuildPluginEvidence(usage: Map<string, PackageUsage>): void {
  for (const item of usage.values()) {
    const hasConfigReference = item.evidence.some((evidence) => evidence.source === 'config');
    if (!hasConfigReference || !isBuildPlugin(item.name)) continue;
    addEvidence(usage, item.name, {
      source: 'build-plugin',
      detail: 'Build-plugin package is referenced by a discovered configuration file.',
      confidence: 15
    });
  }
}

function addEvidence(usage: Map<string, PackageUsage>, name: string, evidence: PackageUsageEvidence): void {
  const current = usage.get(name);
  if (!current) return;
  current.evidence = current.evidence.filter((item) => item.source !== 'none');
  if (!current.evidence.some((item) => item.source === evidence.source && item.file === evidence.file && item.detail === evidence.detail)) {
    current.evidence.push(evidence);
  }
}

function isReferencedByConfig(name: string, content: string, file: string): boolean {
  if (content.includes(name) || matchesPackageCommand(name, content)) return true;
  if (name === 'tailwindcss' && /^tailwind\.config\./.test(file)) return true;
  if (name === 'postcss' && /^postcss\.config\./.test(file)) return true;
  if (name === 'next' && /^next\.config\./.test(file)) return true;
  if (name === 'react-dom' && /vite\.config\.|next\.config\.|astro\.config\.|app\.config\./.test(file)) return true;
  if (name === 'eslint-config-prettier' && /eslint|eslintrc/.test(file) && (content.includes('prettier') || content.includes('eslint-config-prettier'))) return true;
  if (name === '@cloudflare/vite-plugin' && (file.startsWith('wrangler.toml') || /vite\.config\./.test(file))) return true;
  if (name === '@tanstack/router-plugin' && /vite\.config\.|app\.config\.|tsconfig\.json/.test(file)) return true;
  
  if (name.startsWith('eslint-config-') && /eslint|eslintrc/.test(file)) {
    const shortName = name.replace('eslint-config-', '');
    if (content.includes(shortName) || content.includes(name)) return true;
  }
  if (name.startsWith('eslint-plugin-') && /eslint|eslintrc/.test(file)) {
    const shortName = name.replace('eslint-plugin-', '');
    if (content.includes(shortName) || content.includes(name)) return true;
  }
  if (name.startsWith('@types/') && file.startsWith('tsconfig.json')) return true;

  return false;
}

function matchesPackageCommand(name: string, content: string): boolean {
  const command = commandName(name);
  return new RegExp(`(^|\\s|["'])${escapeRegExp(command)}(\\s|:|$|["'])`).test(content);
}

function commandName(name: string): string {
  if (name.startsWith('@')) return name.split('/')[1] ?? name;
  return name;
}

export function roleFor(name: string, kind: string): DependencyRole {
  if (kind === 'optional') return 'OPTIONAL';

  const normalized = name.toLowerCase();

  if (normalized === 'espree' || normalized.includes('parser') || normalized === 'acorn' || normalized.startsWith('@babel/parser')) {
    return 'PARSER';
  }
  if (normalized === 'uri-js') return 'URL_LIBRARY';
  if (normalized === 'ignore' || normalized === 'picomatch' || normalized === 'minimatch' || normalized === 'micromatch') {
    return 'FILE_FILTER';
  }
  // Glob-based file finders are functionally file filters
  if (['glob', 'globby', 'fast-glob', 'tiny-glob'].includes(normalized)) {
    return 'FILE_FILTER';
  }
  if (normalized === 'estraverse') return 'AST';
  if (normalized === 'esutils') return 'AST_UTIL';
  if (['ansi-styles', 'kleur', 'chalk', 'picocolors', 'colorette'].includes(normalized)) {
    return 'TERMINAL_UI';
  }
  // Terminal string handling and color support utilities
  if (['strip-ansi', 'wrap-ansi', 'string-width', 'has-flag', 'supports-color', 'color-convert', 'color-name', 'ansi-regex'].includes(normalized)) {
    return 'TERMINAL_UI';
  }
  if (normalized === 'react-refresh' || normalized.includes('hmr') || normalized.includes('hot-reload')) {
    return 'HMR_RUNTIME';
  }
  if (normalized === 'eslint-scope' || normalized === 'eslint-visitor-keys' || normalized.includes('linter') || normalized.startsWith('@eslint/')) {
    return 'LINTER_SUPPORT';
  }
  if (normalized === 'cacache' || normalized === 'lru-cache' || normalized.includes('cache')) {
    return 'CACHE';
  }
  if (normalized === 'tslib' || normalized.startsWith('@babel/runtime') || normalized.startsWith('@babel/helpers') || normalized.startsWith('@babel/compat-data')) {
    return 'COMPILER_SUPPORT';
  }
  // Babel ecosystem support packages
  if (normalized === '@babel/code-frame' || normalized === '@babel/highlight') {
    return 'COMPILER_SUPPORT';
  }

  // CLI argument parsing frameworks
  if (['commander', 'yargs', 'meow', 'cac', 'citty', 'clipanion', 'inquirer', 'prompts'].includes(normalized)) {
    return 'CLI_FRAMEWORK';
  }

  // Logging and debug utilities
  if (['debug', 'pino', 'winston', 'consola', 'log4js', 'bunyan'].includes(normalized)) {
    return 'LOGGING';
  }

  // Process management utilities
  if (['signal-exit', 'cross-spawn', 'execa', 'which', 'path-key', 'npm-run-path', 'human-signals'].includes(normalized)) {
    return 'PROCESS_UTIL';
  }

  // Config file parsers
  if (['json5', 'yaml', 'js-yaml', 'toml', 'ini', 'dotenv'].includes(normalized)) {
    return 'CONFIG_PARSER';
  }

  // Module resolution utilities
  if (['resolve', 'resolve-from', 'enhanced-resolve', 'import-meta-resolve', 'pkg-types'].includes(normalized)) {
    return 'MODULE_RESOLVER';
  }

  // General-purpose utility libraries
  if (['semver', 'ms', 'pretty-ms', 'deepmerge', 'merge-descriptors', 'bytes', 'pretty-bytes', 'type-fest', 'p-limit', 'p-queue'].includes(normalized)) {
    return 'UTILITY';
  }

  if (kind === 'dev') {
    if (knownBuildTool(name)) return 'BUILD_TOOL';
    return 'DEVELOPMENT';
  }
  if (knownFrameworkPackage(name)) return name === 'react' || name === 'react-dom' ? 'CORE_RUNTIME' : 'FRAMEWORK';
  if (knownBuildTool(name)) return 'BUILD_TOOL';
  if (knownConfigPackage(name)) return 'CONFIG_TOOL';
  return 'UNKNOWN';
}

function knownFrameworkPackage(name: string): boolean {
  return ['react', 'react-dom', 'next', 'nuxt', 'astro', 'svelte', 'vue', '@angular/core'].includes(name);
}

function knownBuildTool(name: string): boolean {
  return ['typescript', 'vite', 'webpack', 'rollup', 'esbuild', 'tsup', 'tsx', 'vitest', 'jest', 'playwright', 'cypress'].includes(name);
}

function knownConfigPackage(name: string): boolean {
  return (
    name === 'tailwindcss' ||
    name === 'postcss' ||
    name === 'autoprefixer' ||
    name === 'eslint-config-prettier' ||
    name === '@cloudflare/vite-plugin' ||
    name === '@tanstack/router-plugin' ||
    name.startsWith('@types/') ||
    name.startsWith('eslint-config-') ||
    name.startsWith('eslint-plugin-') ||
    name.startsWith('@vitejs/plugin-') ||
    name.includes('plugin') ||
    name.includes('preset') ||
    name.includes('loader')
  );
}

function isBuildPlugin(name: string): boolean {
  return name.includes('plugin') || name.includes('loader') || name.includes('preset');
}

export function calculateSafeRemovalProbability(usage: PackageUsage, kind: string, hasDependents: boolean): number {
  const name = usage.name;
  if (usage.role === 'CORE_RUNTIME' || usage.role === 'FRAMEWORK' || name === 'react' || name === 'react-dom') {
    return 2;
  }

  const sources = new Set(usage.evidence.map((evidence) => evidence.source));
  let probability = kind === 'prod' ? 50 : kind === 'peer' ? 30 : kind === 'optional' ? 45 : 95;

  if (sources.has('source')) probability = Math.min(probability, 8);
  if (sources.has('dynamic') || sources.has('runtime')) probability = Math.min(probability, 12);
  if (sources.has('config') || sources.has('build-plugin')) probability = Math.min(probability, 15);
  if (sources.has('script') || sources.has('workspace')) probability = Math.min(probability, 20);
  if (sources.has('peer')) probability = Math.min(probability, 10);
  if (sources.has('framework')) probability = Math.min(probability, 10);
  if (sources.has('ci')) probability = Math.min(probability, 30);
  if (sources.has('weak')) probability = Math.min(probability, 55);
  if (hasDependents) probability = Math.min(probability, 10);

  return probability;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
