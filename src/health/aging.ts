import semver from 'semver';
import type { AnalysisResult, PackageIntelligence } from '../types/index.js';

export type PackageActivityStatus =
  | 'RECENTLY_UPDATED'
  | 'OLD_MAINTAINED'
  | 'OLD_INACTIVE'
  | 'LONG_TERM_STABLE'
  | 'DEPRECATED'
  | 'ARCHIVED'
  | 'OLD_UNVERIFIED'
  | 'UNKNOWN';

export interface PackageActivity {
  name: string;
  status: PackageActivityStatus;
  evidence: string[];
  heuristic: boolean;
}

export interface AgingResult {
  averageAgeDays: number;
  olderThan1Year: string[];
  olderThan2Years: string[];
  olderThan5Years: string[];
  technicalLagScore: number;
  aiInsight: string;
  packages: PackageActivity[];
}

export function classifyPackageActivity(info: PackageIntelligence): PackageActivity {
  const evidence: string[] = [];
  if (info.deprecated) {
    return {
      name: info.name,
      status: 'DEPRECATED',
      evidence: [`npm deprecation metadata: ${info.deprecated}`],
      heuristic: false
    };
  }
  if (info.repositoryArchived) {
    return {
      name: info.name,
      status: 'ARCHIVED',
      evidence: ['Repository host reports archived=true'],
      heuristic: false
    };
  }
  if (!validAgeDays(info.ageDays) || info.ageStatus === 'invalid') {
    return {
      name: info.name,
      status: 'UNKNOWN',
      evidence: ['Latest publish date is unavailable or invalid'],
      heuristic: false
    };
  }

  evidence.push(`Latest npm release was ${info.ageDays} days ago`);
  if (info.ageDays <= 365) {
    return { name: info.name, status: 'RECENTLY_UPDATED', evidence, heuristic: false };
  }

  const repositoryAgeDays = daysSince(info.repositoryPushedAt);
  if (repositoryAgeDays !== undefined) {
    evidence.push(`Repository was pushed ${repositoryAgeDays} days ago`);
  } else {
    evidence.push('Repository activity is unavailable');
  }

  // Heuristic: a package with an old release, substantial current usage, and no
  // newer version can be intentionally stable rather than abandoned.
  if (
    info.ageDays > 730 &&
    !info.isOutdated &&
    (info.weeklyDownloads ?? 0) >= 100_000 &&
    (repositoryAgeDays === undefined || repositoryAgeDays <= 730)
  ) {
    evidence.push(`Weekly npm downloads: ${info.weeklyDownloads?.toLocaleString()}`);
    evidence.push('Installed release matches the latest npm dist-tag');
    return { name: info.name, status: 'LONG_TERM_STABLE', evidence, heuristic: true };
  }

  if (repositoryAgeDays !== undefined && repositoryAgeDays <= 730) {
    return { name: info.name, status: 'OLD_MAINTAINED', evidence, heuristic: false };
  }
  if (
    (repositoryAgeDays !== undefined && repositoryAgeDays > 730) ||
    info.maintainers === 0
  ) {
    if (info.maintainers === 0) evidence.push('npm metadata lists no maintainers');
    return { name: info.name, status: 'OLD_INACTIVE', evidence, heuristic: false };
  }

  return { name: info.name, status: 'OLD_UNVERIFIED', evidence, heuristic: false };
}

export function calculateAging(result: AnalysisResult): AgingResult {
  const intelligenceByName = new Map(result.packageIntelligence.map((info) => [info.name, info]));
  const names = new Set([
    ...result.packageIntelligence.map((info) => info.name),
    ...[...result.graph.nodes.values()]
      .filter((node) => node.id !== result.graph.rootId)
      .map((node) => node.name)
  ]);
  const activities = [...names].map((name) =>
    classifyPackageActivity(intelligenceByName.get(name) ?? { name })
  );
  const byName = new Map(activities.map((activity) => [activity.name, activity]));
  const olderThan1Year: string[] = [];
  const olderThan2Years: string[] = [];
  const olderThan5Years: string[] = [];
  let totalAgeDays = 0;
  let countWithAge = 0;
  let technicalLagScore = 0;

  for (const info of result.packageIntelligence) {
    if (!validAgeDays(info.ageDays) || info.ageStatus === 'invalid') continue;
    const activity = byName.get(info.name)!;
    totalAgeDays += info.ageDays;
    countWithAge += 1;
    const label = `${info.name} (${activity.status.toLowerCase().replaceAll('_', ' ')}, ${Math.round(info.ageDays / 365)}y)`;
    if (info.ageDays > 5 * 365) olderThan5Years.push(label);
    else if (info.ageDays > 2 * 365) olderThan2Years.push(label);
    else if (info.ageDays > 365) olderThan1Year.push(label);

    if (activity.status === 'DEPRECATED') technicalLagScore += 40;
    else if (activity.status === 'ARCHIVED') technicalLagScore += 30;
    else if (activity.status === 'OLD_INACTIVE') technicalLagScore += 20;

    if (info.isOutdated && info.latest) {
      const installed = result.graph.byName.get(info.name)
        ?.map((id) => result.graph.nodes.get(id)?.version)
        .find((version): version is string => Boolean(version));
      const current = installed ? semver.coerce(installed) : null;
      const latest = semver.coerce(info.latest);
      if (current && latest) {
        if (latest.major > current.major) technicalLagScore += 30;
        else if (latest.minor > current.minor) technicalLagScore += 10;
        else if (latest.patch > current.patch) technicalLagScore += 2;
      }
    }
  }

  const inactive = activities.filter((activity) =>
    activity.status === 'OLD_INACTIVE' || activity.status === 'ARCHIVED' || activity.status === 'DEPRECATED'
  ).length;
  const stable = activities.filter((activity) =>
    activity.status === 'LONG_TERM_STABLE' || activity.status === 'OLD_MAINTAINED'
  ).length;
  const unknown = activities.filter((activity) =>
    activity.status === 'UNKNOWN' || activity.status === 'OLD_UNVERIFIED'
  ).length;

  const aiInsight = activities.length === 0
    ? 'No npm activity metadata is available; pkg-ct will not infer age from version numbers.'
    : inactive > 0
      ? `${inactive} package(s) have deprecation, archive, or inactivity evidence; ${stable} older package(s) show maintenance or stability evidence.`
      : stable > 0
        ? `${stable} older package(s) show maintenance or long-term stability evidence. Age alone is not treated as a defect.`
        : unknown > 0
          ? `${unknown} package(s) lack enough repository evidence for an activity judgment.`
          : 'Available release metadata shows recent package activity.';

  return {
    averageAgeDays: countWithAge > 0 ? Math.round(totalAgeDays / countWithAge) : 0,
    olderThan1Year,
    olderThan2Years,
    olderThan5Years,
    technicalLagScore,
    aiInsight,
    packages: activities
  };
}

function daysSince(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp) || timestamp > Date.now() || timestamp < 0) return undefined;
  return Math.floor((Date.now() - timestamp) / 86_400_000);
}

function validAgeDays(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0 && value <= 36_500;
}
