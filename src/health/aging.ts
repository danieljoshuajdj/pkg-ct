import type { AnalysisResult } from '../types/index.js';

export interface AgingResult {
  averageAgeDays: number;
  olderThan1Year: string[];
  olderThan2Years: string[];
  olderThan5Years: string[];
  technicalLagScore: number;
}

export function calculateAging(result: AnalysisResult): AgingResult {
  let totalAgeDays = 0;
  let countWithAge = 0;
  const olderThan1Year: string[] = [];
  const olderThan2Years: string[] = [];
  const olderThan5Years: string[] = [];
  let technicalLagScore = 0;

  for (const info of result.packageIntelligence) {
    const ageDays = info.ageDays;
    const name = info.name;
    const installedVersions =
      result.graph.byName.get(name)?.map((id) => result.graph.nodes.get(id)?.version).filter(Boolean) || [];

    if (ageDays !== undefined) {
      totalAgeDays += ageDays;
      countWithAge += 1;

      if (ageDays > 5 * 365) {
        olderThan5Years.push(`${name} (${Math.round(ageDays / 365)} years)`);
      } else if (ageDays > 2 * 365) {
        olderThan2Years.push(`${name} (${Math.round(ageDays / 365)} years)`);
      } else if (ageDays > 365) {
        olderThan1Year.push(`${name} (${Math.round(ageDays / 365)} year)`);
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

      if (latMajor > instMajor) {
        technicalLagScore += 30;
      } else if (latMinor > instMinor) {
        technicalLagScore += 10;
      } else if (latPatch > instPatch) {
        technicalLagScore += 2;
      }
    }
  }

  return {
    averageAgeDays: countWithAge > 0 ? Math.round(totalAgeDays / countWithAge) : 0,
    olderThan1Year,
    olderThan2Years,
    olderThan5Years,
    technicalLagScore
  };
}
