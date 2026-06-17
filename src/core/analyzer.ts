import { performance } from 'node:perf_hooks';
import type { AnalysisResult, DoctorConfig, Rule, ScanOptions } from '../types/index.js';
import { loadConfig } from '../config/index.js';
import { discoverProject } from '../scanner/workspace.js';
import { buildDependencyGraph } from '../graph/graph.js';
import { collectPackageIntelligence } from '../scanner/package-intelligence.js';
import { scanSourceUsage } from '../scanner/source-usage.js';
import { analyzeLockfile } from '../scanner/lockfile.js';
import { runAudit } from '../scanner/audit.js';
import { builtinRules } from '../rules/builtin.js';
import { scoreFindings } from '../health/scoring.js';
import { buildRemediationPlan } from './remediation.js';
import { loadPlugins } from '../plugins/index.js';

export async function analyzeProject(options: ScanOptions, extraRules: Rule[] = []): Promise<AnalysisResult> {
  const started = performance.now();
  const overrides: DoctorConfig = {
    root: options.root,
    ...(options.offline === undefined ? {} : { offline: options.offline }),
    ...(options.ai ? {} : { ai: { provider: 'none' as const } })
  };
  const config = await loadConfig(options.root, overrides);
  const context = await discoverProject(config);
  const plugins = await loadPlugins(context.config.plugins);
  const graph = await buildDependencyGraph(context);
  const [usage, lockfileAnalysis, audit, intelligence] = await Promise.all([
    scanSourceUsage(context, options.unused ?? true),
    analyzeLockfile(context),
    runAudit(context, Boolean(options.audit)),
    collectPackageIntelligence(context, graph, options.onlineMetadata)
  ]);
  const enabledRules = [...builtinRules, ...plugins.rules, ...extraRules].filter(
    (rule) => context.config.rules[rule.id] !== false
  );
  const findings = (
    await Promise.all(
      enabledRules.map((rule) => rule.run({ context, graph, intelligence, usage, lockfileAnalysis, audit }))
    )
  ).flat();
  const filtered = findings.filter((finding) => !finding.packageName || !config.ignorePackages.includes(finding.packageName));
  const score = scoreFindings(filtered, config);
  const remediation = buildRemediationPlan(filtered);

  return {
    context,
    graph,
    findings: filtered,
    score,
    remediation,
    usage,
    lockfileAnalysis,
    audit,
    packageIntelligence: [...intelligence.values()],
    generatedAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - started)
  };
}
