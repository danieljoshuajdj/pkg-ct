import pacote from 'pacote';
import type { DependencyGraph, PackageIntelligence, ProjectContext } from '../types/index.js';
import { mapLimit } from '../utils/concurrency.js';

type Packument = {
  name: string;
  'dist-tags'?: { latest?: string };
  versions?: Record<string, { deprecated?: string; license?: string; repository?: unknown }>;
  time?: Record<string, string>;
  maintainers?: unknown[];
  repository?: unknown;
};

type DownloadsResponse = {
  downloads?: number;
};

type RepositoryActivity = {
  archived?: boolean;
  pushed_at?: string;
};

export async function collectPackageIntelligence(
  context: ProjectContext,
  graph: DependencyGraph,
  onlineMetadata = false
): Promise<Map<string, PackageIntelligence>> {
  const names = [...graph.byName.keys()].filter((name) => !context.config.ignorePackages.includes(name));
  const directNames = new Set([
    ...Object.keys(context.rootProject.dependencies),
    ...Object.keys(context.rootProject.devDependencies),
    ...Object.keys(context.rootProject.optionalDependencies),
    ...Object.keys(context.rootProject.peerDependencies)
  ]);
  const intelligence = new Map<string, PackageIntelligence>();

  for (const name of names) {
    const nodes = graph.byName.get(name)?.map((id) => graph.nodes.get(id)).filter(Boolean) ?? [];
    const deprecated = nodes.find((node) => node?.deprecated)?.deprecated;
    intelligence.set(name, {
      name,
      deprecated,
      license: nodes.find((node) => node?.license)?.license,
      repository: nodes.find((node) => node?.repository)?.repository
    });
  }

  if (context.config.offline || !onlineMetadata) return intelligence;

  await mapLimit(names, 8, async (name) => {
    try {
      const packument = (await pacote.packument(name, { fullMetadata: true })) as Packument;
      const latest = packument['dist-tags']?.latest;
      const latestMeta = latest ? packument.versions?.[latest] : undefined;
      const publishedAt = latest ? packument.time?.[latest] : undefined;
      const weeklyDownloads = await fetchWeeklyDownloads(name);
      const repository = normalizeRepository(latestMeta?.repository ?? packument.repository)
        ?? intelligence.get(name)?.repository;
      const repositoryActivity = directNames.has(name)
        ? await fetchRepositoryActivity(repository)
        : undefined;
      const ageD = publishedAt ? ageDays(publishedAt) : undefined;
      const ageY = ageD ? ageD / 365 : 0;
      const ageStatus = ageY > 20 ? 'invalid' : 'valid';

      intelligence.set(name, {
        ...intelligence.get(name),
        name,
        latest,
        deprecated: latestMeta?.deprecated ?? intelligence.get(name)?.deprecated,
        publishedAt,
        weeklyDownloads,
        maintainers: packument.maintainers?.length,
        license: latestMeta?.license ?? intelligence.get(name)?.license,
        repository,
        repositoryArchived: repositoryActivity?.archived,
        repositoryPushedAt: repositoryActivity?.pushed_at,
        versions: Object.keys(packument.versions ?? {}).slice(-20),
        ageDays: ageD,
        ageStatus,
        isOutdated: latest ? !graph.byName.get(name)?.some((id) => graph.nodes.get(id)?.version === latest) : undefined
      });
    } catch {
      // Network metadata is opportunistic; deterministic analysis remains authoritative.
    }
  });

  return intelligence;
}

async function fetchRepositoryActivity(repository: string | undefined): Promise<RepositoryActivity | undefined> {
  const slug = githubSlug(repository);
  if (!slug) return undefined;
  try {
    const response = await fetch(`https://api.github.com/repos/${slug}`, {
      headers: { 'User-Agent': 'pkg-ct' }
    });
    if (!response.ok) return undefined;
    return (await response.json()) as RepositoryActivity;
  } catch {
    return undefined;
  }
}

function githubSlug(repository: string | undefined): string | undefined {
  if (!repository) return undefined;
  const normalized = repository
    .replace(/^git\+/, '')
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/^git:\/\/github\.com\//, 'https://github.com/')
    .replace(/\.git$/, '');
  const match = normalized.match(/github\.com\/([^/]+\/[^/#]+)/i);
  return match?.[1];
}

function normalizeRepository(repository: unknown): string | undefined {
  if (typeof repository === 'string') return repository;
  if (repository && typeof repository === 'object' && 'url' in repository) {
    const url = (repository as { url?: unknown }).url;
    return typeof url === 'string' ? url : undefined;
  }
  return undefined;
}

async function fetchWeeklyDownloads(name: string): Promise<number | undefined> {
  try {
    const response = await fetch(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`);
    if (!response.ok) return undefined;
    const json = (await response.json()) as DownloadsResponse;
    return json.downloads;
  } catch {
    return undefined;
  }
}

function ageDays(isoDate: string): number | undefined {
  const parsed = new Date(isoDate).getTime();
  if (!Number.isFinite(parsed)) return undefined;
  if (parsed < 0) return undefined;
  if (parsed > Date.now()) return undefined;
  const days = Math.floor((Date.now() - parsed) / 86_400_000);
  if (days < 0 || days > 36500) return undefined;
  return days;
}
