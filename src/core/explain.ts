import type { AnalysisResult, ExplainResult } from '../types/index.js';
import { traceChains } from '../graph/graph.js';

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
  const installImpactBytes = nodes.reduce((sum, node) => sum + (node?.sizeBytes ?? 0), 0);
  const direct = chains.some((chain) => chain.length <= 2);
  const highRisk = findings.some((finding) => finding.severity === 'high' || finding.severity === 'critical');

  return {
    packageName,
    nodes,
    chains,
    duplicates,
    findings,
    installImpactBytes,
    health,
    safeRemovalProbability: direct || highRisk ? 'LOW' : findings.length > 0 ? 'MEDIUM' : 'HIGH',
    alternatives: alternatives[packageName] ?? ['Inspect npm trends and ecosystem-specific alternatives']
  };
}
