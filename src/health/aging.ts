import type { AnalysisResult } from '../types/index.js';

export interface AgingResult {
  averageAgeDays: number;
  olderThan1Year: string[];
  olderThan2Years: string[];
  olderThan5Years: string[];
  technicalLagScore: number;
  aiInsight: string;
}

const KNOWN_AGES: Record<string, number> = {
  react: 10 * 365,
  'react-dom': 10 * 365,
  lodash: 11 * 365,
  eslint: 10 * 365,
  vite: 4 * 365,
  semver: 11 * 365,
  typescript: 12 * 365,
  esbuild: 4 * 365,
  postcss: 10 * 365,
  webpack: 12 * 365,
  jest: 10 * 365,
  vitest: 2 * 365,
  rollup: 8 * 365,
  babel: 9 * 365,
  workerd: 2 * 365,
  wrangler: 4 * 365
};

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

  const processedPackages = new Set<string>();

  for (const node of result.graph.nodes.values()) {
    if (node.id === result.graph.rootId) continue;
    if (processedPackages.has(node.name)) continue;
    processedPackages.add(node.name);

    const name = node.name;
    const info = result.packageIntelligence.find((item) => item.name === name);
    const installedVersions =
      result.graph.byName.get(name)?.map((id) => result.graph.nodes.get(id)?.version).filter(Boolean) || [];

    let ageDays = info?.ageDays;

    // Fallback hierarchy
    if (ageDays === undefined || !Number.isFinite(ageDays) || ageDays <= 0 || ageDays > 36500) {
      const normalizedName = name.toLowerCase();
      if (KNOWN_AGES[normalizedName] !== undefined) {
        ageDays = KNOWN_AGES[normalizedName]!;
      } else {
        const version = node.version.replace(/(workspace|link|file):/g, '').replace(/^[\^~>=<]+/g, '').trim();
        const majorPart = version.split('.')[0] ?? '1';
        let major = parseInt(majorPart, 10);
        if (Number.isNaN(major) || !Number.isFinite(major)) major = 1;
        
        const minorPart = version.split('.')[1] ?? '0';
        let minor = parseInt(minorPart, 10);
        if (Number.isNaN(minor) || !Number.isFinite(minor)) minor = 0;

        ageDays = major * 365 + minor * 30;
        if (ageDays <= 0 || ageDays > 36500) ageDays = 90; // Conservative estimate
      }
    }

    if (process.env.PKG_CT_DEBUG) {
      process.stderr.write(`[pkg-ct] [AGING] ${name}: info.ageDays=${info?.ageDays}, resolved=${ageDays}\n`);
    }

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

    if (info?.isOutdated && info?.latest && installedVersions.length > 0) {
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

  // Build evidence-based AI insight
  const totalOlder = olderThan1Year.length + olderThan2Years.length + olderThan5Years.length;
  let aiInsight: string;
  const registryCount = result.packageIntelligence.filter(i => i.ageDays !== undefined && i.ageDays > 0).length;
  
  if (totalOlder === 0 && registryCount === 0) {
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
