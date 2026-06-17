import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { LockfileAnalysis, PackageManager, ProjectContext } from '../types/index.js';

export async function analyzeLockfile(context: ProjectContext): Promise<LockfileAnalysis> {
  const empty: LockfileAnalysis = {
    type: context.packageManager,
    packageCount: 0,
    duplicatePackages: new Map(),
    missingDirectDependencies: [],
    staleDirectDependencies: [],
    evidence: []
  };
  if (!context.lockfile) return { ...empty, evidence: ['No lockfile detected.'] };

  const content = await readFile(context.lockfile, 'utf8');
  if (context.packageManager === 'npm') return analyzePackageLock(context, content);
  return analyzeTextLockfile(context.packageManager, basename(context.lockfile), content);
}

function analyzePackageLock(context: ProjectContext, content: string): LockfileAnalysis {
  const json = JSON.parse(content) as {
    packages?: Record<string, { version?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>;
    dependencies?: Record<string, { version?: string }>;
  };
  const packages = json.packages ?? {};
  const rootPackage = packages[''] ?? {};
  const rootLockDeps = {
    ...(rootPackage.dependencies ?? {}),
    ...(rootPackage.devDependencies ?? {})
  };
  const directDeps = {
    ...context.rootProject.dependencies,
    ...context.rootProject.devDependencies,
    ...context.rootProject.optionalDependencies
  };

  const versions = new Map<string, Set<string>>();
  for (const [path, meta] of Object.entries(packages)) {
    if (!path.startsWith('node_modules/') || !meta.version) continue;
    const name = packageNameFromNodeModulesPath(path);
    const set = versions.get(name) ?? new Set<string>();
    set.add(meta.version);
    versions.set(name, set);
  }

  const missingDirectDependencies = Object.keys(directDeps).filter((name) => !rootLockDeps[name]);
  const staleDirectDependencies = Object.keys(rootLockDeps).filter((name) => !directDeps[name]);

  return {
    type: 'npm',
    packageCount: Object.keys(packages).filter((path) => path.startsWith('node_modules/')).length,
    duplicatePackages: duplicatesFromVersions(versions),
    missingDirectDependencies,
    staleDirectDependencies,
    evidence: [`package-lock contains ${Object.keys(packages).length} package entries.`]
  };
}

function analyzeTextLockfile(type: PackageManager, filename: string, content: string): LockfileAnalysis {
  const versions = new Map<string, Set<string>>();
  const packagePatterns = [
    /(?:^|\n)\s{0,2}([@a-zA-Z0-9._/-]+)@[^:\n]+:\n\s+version[:=]\s+["']?([^"'\n]+)["']?/g,
    /(?:^|\n)\s{0,2}\/([@a-zA-Z0-9._/-]+)@([^:\n(]+)(?:\(|:)/g
  ];

  for (const pattern of packagePatterns) {
    for (const match of content.matchAll(pattern)) {
      const name = cleanPackageName(match[1] ?? '');
      const version = (match[2] ?? '').trim();
      if (!name || !version) continue;
      const set = versions.get(name) ?? new Set<string>();
      set.add(version);
      versions.set(name, set);
    }
  }

  return {
    type,
    packageCount: versions.size,
    duplicatePackages: duplicatesFromVersions(versions),
    missingDirectDependencies: [],
    staleDirectDependencies: [],
    evidence: [`${filename} contains ${versions.size} parsed package families.`]
  };
}

function packageNameFromNodeModulesPath(path: string): string {
  const parts = path.split('/').slice(1);
  if (parts[0]?.startsWith('@')) return `${parts[0]}/${parts[1]}`;
  return parts[0] ?? path;
}

function cleanPackageName(raw: string): string {
  return raw.replace(/^["']|["']$/g, '').replace(/^\/+/, '');
}

function duplicatesFromVersions(versions: Map<string, Set<string>>): Map<string, string[]> {
  const duplicates = new Map<string, string[]>();
  for (const [name, set] of versions) {
    if (set.size > 1) duplicates.set(name, [...set]);
  }
  return duplicates;
}
