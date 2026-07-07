import type { AnalysisResult, AuditVulnerability } from '../types/index.js';
import { classifyPackageActivity } from '../health/aging.js';

export interface PrioritizedVulnerability {
  name: string;
  severity: string;
  title: string;
  reachability: 'HIGH' | 'MEDIUM' | 'LOW';
  exploitability: 'UNKNOWN';
  productionRelevance: 'Production critical' | 'Production reachable' | 'Development only' | 'Unknown';
  reason: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  evidence: string[];
}

export interface SecurityReport {
  vulnerabilities: PrioritizedVulnerability[];
  deprecated: string[];
  maintainerInactivity: string[];
  abandonmentRisk: string[];
  supplyChainRisk: string[];
}

export function generateSecurityReport(result: AnalysisResult): SecurityReport {
  const vulnerabilities = result.audit.vulnerabilities.map((vulnerability) =>
    prioritizeVulnerability(result, vulnerability)
  );

  const deprecated = result.findings
    .filter((f) => f.id.startsWith('deprecated:'))
    .map((f) => `${f.packageName}@${f.packageVersion}`);

  const maintainerInactivity: string[] = [];
  const abandonmentRisk: string[] = [];
  const supplyChainRisk: string[] = [];

  for (const info of result.packageIntelligence) {
    const activity = classifyPackageActivity(info);
    const name = info.name;

    if (activity.status === 'OLD_INACTIVE') {
      maintainerInactivity.push(`${name} (${activity.evidence.join('; ')})`);
      abandonmentRisk.push(`${name} (release and repository inactivity evidence)`);
    } else if (activity.status === 'ARCHIVED') {
      abandonmentRisk.push(`${name} (repository archived)`);
    }
  }

  for (const dep of deprecated) {
    if (!abandonmentRisk.includes(dep)) {
      abandonmentRisk.push(`${dep} (deprecated by maintainer)`);
    }
  }

  for (const node of result.graph.nodes.values()) {
    const runsScripts = ['preinstall', 'install', 'postinstall'].some((s) => node.scripts[s]);
    const hasNative = /node-gyp|prebuild|cmake-js|node-pre-gyp|make\b|g\+\+/.test(
      Object.values(node.scripts).join(' ')
    );
    const intelligence = result.packageIntelligence.find((info) => info.name === node.name);
    const lowMaintainers =
      intelligence && intelligence.maintainers !== undefined && intelligence.maintainers <= 1;

    if (runsScripts || hasNative) {
      const risks: string[] = [];
      if (runsScripts) risks.push('runs install scripts');
      if (hasNative) risks.push('compiles native code');
      if (lowMaintainers) risks.push('low maintainer count');

      supplyChainRisk.push(`${node.name}@${node.version} (${risks.join(', ')})`);
    }
  }

  return {
    vulnerabilities,
    deprecated,
    maintainerInactivity,
    abandonmentRisk,
    supplyChainRisk
  };
}

export function prioritizeVulnerability(
  result: AnalysisResult,
  vulnerability: AuditVulnerability
): PrioritizedVulnerability {
  const nodeIds = result.graph.byName.get(vulnerability.name) ?? [];
  const nodes = nodeIds
    .map((id) => result.graph.nodes.get(id))
    .filter((node): node is NonNullable<typeof node> => Boolean(node));
  const usage = result.usage.packageUsage.get(vulnerability.name);
  const imported = usage?.evidence.some((evidence) =>
    evidence.source === 'source' || evidence.source === 'dynamic' || evidence.source === 'runtime'
  ) ?? false;
  const directProduction = Boolean(result.context.rootProject.dependencies[vulnerability.name]);
  const productionReachable = directProduction || nodes.some((node) => !node.dev);

  const productionRelevance = directProduction
    ? 'Production critical'
    : productionReachable
      ? 'Production reachable'
      : nodes.length > 0
        ? 'Development only'
        : 'Unknown';
  const reachability = imported && productionReachable
    ? 'HIGH'
    : productionReachable
      ? 'MEDIUM'
      : 'LOW';

  const priority = securityPriority(vulnerability.severity, reachability, productionRelevance);
  const reason = productionRelevance === 'Development only'
    ? 'Installed nodes are development-only, so the advisory is not reachable in the production tree.'
    : reachability === 'HIGH'
      ? 'The affected package has source/runtime references and is present in the production tree.'
      : reachability === 'MEDIUM'
        ? 'The affected package is production-reachable, but no direct source/runtime reference was found.'
        : 'No installed production-reachable node or source/runtime reference was found.';

  return {
    name: vulnerability.name,
    severity: vulnerability.severity,
    title: vulnerability.title,
    reachability,
    exploitability: 'UNKNOWN',
    productionRelevance,
    reason,
    priority,
    evidence: [
      `npm audit severity: ${vulnerability.severity}`,
      imported ? 'Source/runtime reference found' : 'No source/runtime reference found',
      `${nodes.length} installed node(s); ${nodes.filter((node) => !node.dev).length} production node(s)`,
      'Exploit maturity is not provided by npm audit metadata'
    ]
  };
}

function securityPriority(
  severity: string,
  reachability: 'HIGH' | 'MEDIUM' | 'LOW',
  relevance: PrioritizedVulnerability['productionRelevance']
): PrioritizedVulnerability['priority'] {
  if (relevance === 'Development only' || relevance === 'Unknown') return 'LOW';
  if (severity === 'critical') {
    if (reachability === 'HIGH') return 'CRITICAL';
    return reachability === 'MEDIUM' ? 'HIGH' : 'MEDIUM';
  }
  if (severity === 'high') {
    if (reachability === 'HIGH') return 'HIGH';
    return reachability === 'MEDIUM' ? 'MEDIUM' : 'LOW';
  }
  if (severity === 'medium' && reachability !== 'LOW') return 'MEDIUM';
  return 'LOW';
}
