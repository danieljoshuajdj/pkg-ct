import satisfies from 'semver/functions/satisfies.js';
import gt from 'semver/functions/gt.js';
import type { AnalysisResult } from '../types/index.js';

export type UpgradeRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';

export interface UpgradeAdvisoryResult {
  packageName: string;
  currentVersion: string;
  requestedVersion: string;
  risk: UpgradeRisk;
  evidence: string[];
  potentiallyAffected: string[];
  reasons: string[];
  recommendation: string;
}

/**
 * Analyzes the risk of upgrading a package to a new version.
 * All evidence comes exclusively from the resolved dependency graph and findings.
 * No external network calls are made.
 */
export function adviseUpgrade(
  packageName: string,
  requestedVersion: string,
  result: AnalysisResult
): UpgradeAdvisoryResult {
  const evidence: string[] = [];
  const reasons: string[] = [];
  const potentiallyAffected: string[] = [];
  let riskScore = 0;

  // 1. Locate current installed version(s)
  const installedIds = result.graph.byName.get(packageName) ?? [];
  const installedVersions = installedIds
    .map((id) => result.graph.nodes.get(id)?.version)
    .filter((v): v is string => Boolean(v));

  const currentVersion = installedVersions[0] ?? 'not installed';
  evidence.push(`Currently installed: ${packageName}@${currentVersion}`);
  evidence.push(`Requested: ${packageName}@${requestedVersion}`);

  if (currentVersion === 'not installed') {
    reasons.push(`${packageName} is not currently installed in the dependency tree.`);
    riskScore += 5;
  } else {
    // Detect major version jump
    try {
      const currentMajor = parseInt(currentVersion.split('.')[0] ?? '0', 10);
      const requestedMajor = parseInt(requestedVersion.replace(/^[^0-9]*/, '').split('.')[0] ?? '0', 10);
      if (!isNaN(requestedMajor) && requestedMajor > currentMajor) {
        reasons.push(`Major version jump from v${currentMajor} to v${requestedMajor}.`);
        riskScore += 30;
        evidence.push(`Major version bump: v${currentMajor} → v${requestedMajor}`);
      } else if (!isNaN(requestedMajor) && requestedMajor === currentMajor) {
        evidence.push('Same major version — likely backward-compatible.');
        riskScore += 2;
      }
    } catch {
      // Non-semver requested version (e.g. 'latest', 'next') — treat as potentially risky
      reasons.push(`Non-semver version specifier "${requestedVersion}" — exact impact unknown.`);
      riskScore += 15;
    }
  }

  // 2. Check for peers that depend on this package
  for (const node of result.graph.nodes.values()) {
    const peerRange = node.peerDependencies[packageName];
    if (!peerRange) continue;

    const requestedClean = requestedVersion.replace(/^[^0-9]*/, '');
    const peerSatisfied = requestedClean
      ? satisfies(requestedClean, peerRange)
      : false;

    potentiallyAffected.push(node.name);

    if (!peerSatisfied) {
      reasons.push(`${node.name} has peer range "${peerRange}" — new version may not satisfy it.`);
      evidence.push(`Peer conflict risk: ${node.name} requires ${packageName}@${peerRange}`);
      riskScore += 20;
    } else {
      evidence.push(`${node.name} peer range "${peerRange}" is compatible.`);
    }
  }

  // 3. Check for packages that depend on this package (direct dependents)
  for (const id of installedIds) {
    const node = result.graph.nodes.get(id);
    if (!node) continue;
    for (const depId of node.dependents) {
      const depNode = result.graph.nodes.get(depId);
      if (depNode && depNode.name !== packageName) {
        if (!potentiallyAffected.includes(depNode.name)) {
          potentiallyAffected.push(depNode.name);
        }
      }
    }
  }

  // 4. Check for framework compatibility (React/ReactDOM must be in sync, etc.)
  const frameworkPairs: Array<[string, string]> = [
    ['react', 'react-dom'],
    ['next', 'react'],
    ['nuxt', 'vue']
  ];
  for (const [a, b] of frameworkPairs) {
    if (packageName === a) {
      const bVersions = (result.graph.byName.get(b) ?? [])
        .map((id) => result.graph.nodes.get(id)?.version)
        .filter(Boolean);
      if (bVersions.length > 0) {
        reasons.push(`Upgrading ${a} may require aligning ${b}@${bVersions.join(', ')}.`);
        evidence.push(`Framework alignment required: ${b} currently at ${bVersions.join(', ')}`);
        riskScore += 15;
        if (!potentiallyAffected.includes(b)) potentiallyAffected.push(b);
      }
    }
  }

  // 5. Check existing duplicate findings for this package
  const dupFindings = result.findings.filter(
    (f) => f.category === 'duplication' && f.packageName === packageName
  );
  if (dupFindings.length > 0) {
    reasons.push(`${packageName} already has multiple versions installed — upgrade may worsen duplication.`);
    evidence.push(`Existing duplication: ${dupFindings[0]?.title}`);
    riskScore += 10;
  }

  // 6. Check intelligence for outdated info
  const intel = result.packageIntelligence.find((i) => i.name === packageName);
  if (intel?.latest) {
    evidence.push(`Registry latest: ${packageName}@${intel.latest}`);
    const requestedClean = requestedVersion.replace(/^[^0-9]*/, '');
    if (requestedClean && gt(intel.latest, requestedClean)) {
      evidence.push(`Note: ${intel.latest} is newer than requested ${requestedVersion}.`);
    }
  }

  // Derive risk level from score
  const risk: UpgradeRisk =
    riskScore >= 50 ? 'EXTREME' :
    riskScore >= 30 ? 'HIGH' :
    riskScore >= 15 ? 'MEDIUM' : 'LOW';

  // Build recommendation from evidence
  let recommendation: string;
  if (risk === 'EXTREME' || risk === 'HIGH') {
    const peerNames = potentiallyAffected.slice(0, 3).join(', ');
    recommendation = peerNames
      ? `Audit ${peerNames} compatibility before upgrading. Test in a branch before merging.`
      : `High-risk upgrade. Test thoroughly in a branch. Review CHANGELOG for breaking changes.`;
  } else if (risk === 'MEDIUM') {
    recommendation = `Moderate risk. Run tests after upgrading. Review peer dependency satisfaction.`;
  } else {
    recommendation = `Low risk upgrade. Proceed with normal testing.`;
  }

  return {
    packageName,
    currentVersion,
    requestedVersion,
    risk,
    evidence,
    potentiallyAffected: [...new Set(potentiallyAffected)],
    reasons,
    recommendation
  };
}
