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

const importPattern =
  /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

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
      confidence: 20,
      evidence: [{ source: 'none', detail: 'No source, config, script, CI, or framework evidence found.', confidence: 20 }],
      safeRemovalProbability: kind === 'dev' ? 95 : 75,
      role: roleFor(name, kind)
    });
  }

  let importCount = 0;
  const sourceFiles = await fg(sourceGlobs, { cwd: context.root, absolute: true, ignore });
  await Promise.all(
    sourceFiles.map(async (file) => {
      if (!sourceExtensions.has(extname(file))) return;
      const source = await readFile(file, 'utf8');
      for (const match of source.matchAll(importPattern)) {
        const specifier = match[1] ?? match[2] ?? match[3];
        if (!specifier || specifier.startsWith('.') || specifier.startsWith('node:')) continue;
        const packageName = packageNameFromSpecifier(specifier);
        importCount += 1;
        addEvidence(usage, packageName, {
          source: 'source',
          file: relative(context.root, file),
          detail: `Imported as ${specifier}`,
          confidence: 100
        });
      }
    })
  );

  const configFiles = await fg(configGlobs, { cwd: context.root, absolute: true, ignore, dot: true });
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
            confidence: 90
          });
        }
      }
    })
  );

  await addPackageScriptEvidence(context, usage);
  await addCiEvidence(context, usage);
  addFrameworkEvidence(usage);

  // Add weak evidence (confidence 40)
  for (const name of usage.keys()) {
    const item = usage.get(name)!;
    if (item.evidence.length === 0 || item.evidence.some(e => e.source === 'none')) {
      if (name.startsWith('@types/')) {
        addEvidence(usage, name, {
          source: 'weak',
          detail: 'TypeScript declaration package (implied usage).',
          confidence: 40
        });
      } else if (name.includes('plugin') || name.includes('preset') || name.includes('loader') || name.includes('config')) {
        addEvidence(usage, name, {
          source: 'weak',
          detail: 'Config/Plugin/Loader package that may be loaded dynamically.',
          confidence: 40
        });
      }
    }
  }

  const usedPackages = new Set<string>();
  for (const item of usage.values()) {
    item.confidence = Math.max(...item.evidence.map((evidence) => evidence.confidence));
    
    // Check transitive impact if graph is available
    const hasDependents = graph
      ? (graph.byName.get(item.name) ?? [])
          .map(id => graph.nodes.get(id))
          .some(node => node && node.dependents.length > 0)
      : false;
      
    item.safeRemovalProbability = calculateSafeRemovalProbability(item, direct[item.name] ?? 'prod', hasDependents);
    if (item.confidence >= 30) usedPackages.add(item.name);
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
          confidence: 80
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
            confidence: 70
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
        detail: 'Known framework/config package that may be consumed implicitly.',
        confidence: 60
      });
    }
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

export function calculateSafeRemovalProbability(usage: PackageUsage, kind: string, hasDependents: boolean): number {
  const name = usage.name;
  // If it's a framework or core runtime, it is never safe to remove
  if (usage.role === 'CORE_RUNTIME' || usage.role === 'FRAMEWORK' || name === 'react' || name === 'react-dom') {
    return 2; // Extremely risky
  }

  // Check highest confidence evidence
  const maxConfidence = usage.confidence;

  if (maxConfidence === 100) return 1; // Direct source import -> definitely don't remove
  if (maxConfidence === 90) return 5;  // Config reference -> definitely don't remove
  if (maxConfidence === 80) return 8;  // Script reference -> definitely don't remove
  if (maxConfidence === 70) return 12; // CI workflow reference -> definitely don't remove
  if (maxConfidence === 60) return 15; // Known framework package -> don't remove

  // At this point, confidence is <= 40 (weak or no evidence)
  let probability = 95;

  if (kind === 'prod') {
    probability = 50; // prod packages are riskier to remove
  } else if (kind === 'peer') {
    probability = 30; // peer deps are required by others
  } else if (kind === 'optional') {
    probability = 40;
  } else if (kind === 'dev') {
    probability = 95; // dev package with no evidence by default
  }

  // Adjust if there is weak evidence (confidence 40)
  if (maxConfidence === 40) {
    probability = Math.min(probability, 55); // max 55% if there's weak evidence (requiring manual review)
  }

  // Adjust for transitive impact (if other packages depend on this package)
  if (hasDependents) {
    probability = Math.min(probability, 25); // definitely not safe to remove if other packages depend on it
  }

  return probability;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
