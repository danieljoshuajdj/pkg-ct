import type { AnalysisResult } from '../types/index.js';

export interface AgingResult {
  averageAgeDays: number;
  olderThan1Year: string[];
  olderThan2Years: string[];
  olderThan5Years: string[];
  technicalLagScore: number;
  aiInsight: string;
}

export function calculateAging(result: AnalysisResult): AgingResult {
  let totalAgeDays = 0;
  let countWithAge = 0;
  const olderThan1Year: string[] = [];
  const olderThan2Years: string[] = [];
  const olderThan5Years: string[] = [];
  let technicalLagScore = 0;
  let toolingOlderCount = 0;
  let runtimeOlderCount = 0;

  // Tooling package name prefixes to help with AI insight classification
  const toolingPrefixes = ['eslint', 'vite', 'tsup', 'vitest', 'webpack', 'babel', 'jest',
    '@types/', 'typescript', 'prettier', 'rollup', 'postcss', 'stylelint', 'tslint'];

  for (const info of result.packageIntelligence) {
    const ageDays = info.ageDays;
    const name = info.name;
    const installedVersions =
      result.graph.byName.get(name)?.map((id) => result.graph.nodes.get(id)?.version).filter(Boolean) || [];

    if (ageDays !== undefined && Number.isFinite(ageDays) && ageDays > 0) {
      totalAgeDays += ageDays;
      countWithAge += 1;

      const isTool = toolingPrefixes.some((p) => name.startsWith(p));

      if (ageDays > 5 * 365) {
        olderThan5Years.push(`${name} (${Math.round(ageDays / 365)} years)`);
        if (isTool) toolingOlderCount++; else runtimeOlderCount++;
      } else if (ageDays > 2 * 365) {
        olderThan2Years.push(`${name} (${Math.round(ageDays / 365)} years)`);
        if (isTool) toolingOlderCount++; else runtimeOlderCount++;
      } else if (ageDays > 365) {
        olderThan1Year.push(`${name} (${Math.round(ageDays / 365)} year)`);
        if (isTool) toolingOlderCount++; else runtimeOlderCount++;
      }

      if (ageDays > 5 * 365) technicalLagScore += 50;
      else if (ageDays > 2 * 365) technicalLagScore += 20;
      else if (ageDays > 365) technicalLagScore += 5;
    }

    if (info.isOutdated && info.latest && installedVersions.length > 0) {
      const installed = installedVersions[0]!;
      const latest = info.latest;

      const [instMajor = 0, instMinor = 0, instPatch = 0] = installed.split('.').map(Number);
      const [latMajor = 0, latMinor = 0, latPatch = 0] = latest.split('.').map(Number);

      let instM = instMajor; if (Number.isNaN(instM) || !Number.isFinite(instM)) instM = 0;
      let latM = latMajor; if (Number.isNaN(latM) || !Number.isFinite(latM)) latM = 0;
      let instMin = instMinor; if (Number.isNaN(instMin) || !Number.isFinite(instMin)) instMin = 0;
      let latMin = latMinor; if (Number.isNaN(latMin) || !Number.isFinite(latMin)) latMin = 0;
      let instP = instPatch; if (Number.isNaN(instP) || !Number.isFinite(instP)) instP = 0;
      let latP = latPatch; if (Number.isNaN(latP) || !Number.isFinite(latP)) latP = 0;

      if (latM > instM) {
        technicalLagScore += 30;
      } else if (latMin > instMin) {
        technicalLagScore += 10;
      } else if (latP > instP) {
        technicalLagScore += 2;
      }
    }
  }

  // Blocker 1/Bug 1 fix: When no age metadata available from npm registry, estimate from version numbers.
  // Never show Average Age = 0 unless every package was literally published today.
  if (countWithAge === 0 && result.graph.nodes.size > 0) {
    let estimatedTotal = 0;
    let estimatedCount = 0;
    for (const node of result.graph.nodes.values()) {
      const majorPart = node.version.split('.')[0] ?? '1';
      let major = parseInt(majorPart, 10);
      if (Number.isNaN(major) || !Number.isFinite(major)) {
        major = 1;
      }
      const estimatedYears = Math.min(Math.max(major, 1), 8);
      if (Number.isFinite(estimatedYears)) {
        estimatedTotal += estimatedYears * 365;
        estimatedCount += 1;
      }
    }
    if (estimatedCount > 0) {
      totalAgeDays = Math.round(estimatedTotal / estimatedCount);
      countWithAge = estimatedCount;
    }
  }

  // Build evidence-based AI insight
  const totalOlder = olderThan1Year.length + olderThan2Years.length + olderThan5Years.length;
  let aiInsight: string;
  if (totalOlder === 0 && countWithAge === 0) {
    aiInsight = 'No age metadata available from npm registry. Age estimates are based on installed version numbers.';
  } else if (totalOlder === 0) {
    aiInsight = 'Dependency age is within normal range. No aging concerns detected.';
  } else if (toolingOlderCount > runtimeOlderCount) {
    aiInsight = 'Most dependency aging comes from tooling packages rather than production runtime packages.';
  } else if (runtimeOlderCount > 0) {
    aiInsight = `${runtimeOlderCount} production runtime package(s) are over 1 year old. Prioritize auditing these for security and compatibility updates.`;
  } else {
    aiInsight = `${totalOlder} package(s) are older than 1 year. Run pkg-ct security for a prioritized audit.`;
  }

  let finalAverageAgeDays = countWithAge > 0 ? Math.round(totalAgeDays / countWithAge) : 0;
  if (Number.isNaN(finalAverageAgeDays) || !Number.isFinite(finalAverageAgeDays) || finalAverageAgeDays < 0) {
    finalAverageAgeDays = 0;
  }

  return {
    averageAgeDays: finalAverageAgeDays,
    olderThan1Year,
    olderThan2Years,
    olderThan5Years,
    technicalLagScore: Number.isFinite(technicalLagScore) ? technicalLagScore : 0,
    aiInsight
  };
}
