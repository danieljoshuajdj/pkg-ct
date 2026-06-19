import type { AnalysisResult, ExplainResult } from '../types/index.js';
import { traceChains } from '../graph/graph.js';
import { roleFor } from '../scanner/source-usage.js';

const alternatives: Record<string, string[]> = {
  lodash: ['es-toolkit', 'radash', 'native platform APIs'],
  moment: ['date-fns', 'dayjs', 'Temporal polyfill'],
  request: ['undici', 'got', 'ky'],
  chalk: ['picocolors', 'kleur'],
  webpack: ['vite', 'rspack', 'esbuild']
};

export function explainPackage(result: AnalysisResult, packageName: string): ExplainResult {
  const ids = result.graph.byName.get(packageName) ?? [];
  const nodes = ids
    .map((id) => result.graph.nodes.get(id))
    .filter((node): node is NonNullable<typeof node> => Boolean(node));
  const chains = ids.flatMap((id) => traceChains(result.graph, id));
  const duplicates = ids.length > 1 ? nodes : [];
  const findings = result.findings.filter((finding) => finding.packageName === packageName);
  const health = result.packageIntelligence.find((item) => item.name === packageName);
  const usage = result.usage.packageUsage.get(packageName);
  const installImpactBytes = nodes.reduce((sum, node) => sum + (node?.sizeBytes ?? 0), 0);
  const directDeclared = Boolean(
    result.context.rootProject.dependencies[packageName] ||
      result.context.rootProject.devDependencies[packageName] ||
      result.context.rootProject.optionalDependencies[packageName] ||
      result.context.rootProject.peerDependencies[packageName]
  );
  const direct = directDeclared || chains.some((chain) => chain.length <= 2);
  const directKind = result.context.rootProject.dependencies[packageName]
    ? 'prod'
    : result.context.rootProject.devDependencies[packageName]
      ? 'dev'
      : result.context.rootProject.optionalDependencies[packageName]
        ? 'optional'
        : result.context.rootProject.peerDependencies[packageName]
          ? 'peer'
          : undefined;

  const role = usage?.role ?? (directKind ? roleFor(packageName, directKind) : 'TRANSITIVE');

  let safeRemovalProbabilityPercent = usage?.safeRemovalProbability ?? (direct ? 55 : 70);

  if (
    role === 'CORE_RUNTIME' ||
    role === 'FRAMEWORK' ||
    packageName === 'react' ||
    packageName === 'react-dom' ||
    result.context.rootProject.dependencies[packageName]
  ) {
    safeRemovalProbabilityPercent = 2;
  }

  const referencedBy = [
    ...new Set(
      usage?.evidence
        .filter((evidence) => evidence.source !== 'none')
        .map((evidence) => (evidence.file ? evidence.file : evidence.detail)) ?? []
    )
  ];

  // --- Blast Radius: count all nodes that would lose a dependency if this package were removed ---
  const directDependents: string[] = [];
  for (const node of result.graph.nodes.values()) {
    if (node.name === packageName) continue;
    if (ids.some((id) => node.dependents.includes(id) || node.dependencies[packageName])) {
      if (!directDependents.includes(node.name)) directDependents.push(node.name);
    }
  }

  // Transitive blast: BFS to find all reachable dependents
  const visited = new Set<string>(ids);
  const queue = [...ids];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const node = result.graph.nodes.get(current);
    if (!node) continue;
    for (const depId of node.dependents) {
      if (!visited.has(depId)) {
        visited.add(depId);
        queue.push(depId);
      }
    }
  }
  const blastRadiusCount = Math.max(0, visited.size - ids.length);
  const blastRadius =
    blastRadiusCount === 0 ? 'NONE' :
    blastRadiusCount <= 5 ? 'LOW' :
    blastRadiusCount <= 20 ? 'MEDIUM' :
    blastRadiusCount <= 60 ? 'HIGH' : 'EXTREME';

  // --- Production Impact: derived from role and declared dep type ---
  const isProdDep = Boolean(result.context.rootProject.dependencies[packageName]);
  const productionImpact =
    role === 'CORE_RUNTIME' || role === 'FRAMEWORK' ? 'CRITICAL' :
    isProdDep && blastRadiusCount > 20 ? 'HIGH' :
    isProdDep ? 'MEDIUM' :
    directKind === 'dev' ? 'NONE' :
    'LOW';

  return {
    packageName,
    nodes,
    chains,
    duplicates,
    findings,
    installImpactBytes,
    health,
    role,
    referencedBy,
    usageConfidence: usage?.confidence ?? (direct ? 60 : 20),
    safeRemovalProbabilityPercent,
    removalRisk:
      safeRemovalProbabilityPercent <= 10
        ? 'EXTREME'
        : safeRemovalProbabilityPercent <= 35
          ? 'HIGH'
          : safeRemovalProbabilityPercent <= 70
            ? 'MEDIUM'
            : 'LOW',
    safeRemovalProbability:
      safeRemovalProbabilityPercent <= 35 ? 'LOW' :
      safeRemovalProbabilityPercent <= 70 ? 'MEDIUM' : 'HIGH',
    alternatives: alternatives[packageName] ?? ['Inspect npm trends and ecosystem-specific alternatives'],
    blastRadius,
    blastRadiusCount,
    productionImpact,
    directDependents
  };
}
