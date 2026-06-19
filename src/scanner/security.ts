import type { AnalysisResult } from '../types/index.js';

export interface SecurityReport {
  vulnerabilities: { name: string; severity: string; title: string }[];
  deprecated: string[];
  maintainerInactivity: string[];
  abandonmentRisk: string[];
  supplyChainRisk: string[];
}

export function generateSecurityReport(result: AnalysisResult): SecurityReport {
  const vulnerabilities = result.audit.vulnerabilities.map((v) => ({
    name: v.name,
    severity: v.severity,
    title: v.title
  }));

  const deprecated = result.findings
    .filter((f) => f.id.startsWith('deprecated:'))
    .map((f) => `${f.packageName}@${f.packageVersion}`);

  const maintainerInactivity: string[] = [];
  const abandonmentRisk: string[] = [];
  const supplyChainRisk: string[] = [];

  for (const info of result.packageIntelligence) {
    const ageDays = info.ageDays;
    const name = info.name;

    if (ageDays && ageDays > 730) {
      maintainerInactivity.push(`${name} (last release: ${ageDays} days ago)`);

      if (info.maintainers !== undefined && info.maintainers <= 1) {
        abandonmentRisk.push(`${name} (1 maintainer, inactive for ${Math.round(ageDays / 365)} years)`);
      }
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
