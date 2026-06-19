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

export async function scanProject(options: ScanOptions): Promise<AnalysisResult> {
  const started = performance.now();
  const overrides: DoctorConfig = {
    root: options.root,
    offline: true,
    ai: { provider: 'none' as const }
  };
  const config = await loadConfig(options.root, overrides);
  const context = await discoverProject(config);
  const graph = await buildDependencyGraph(context);
  const lockfileAnalysis = await analyzeLockfile(context);

  const usage = { usedPackages: new Set<string>(), packageUsage: new Map(), filesScanned: 0, importCount: 0 };
  const audit = { vulnerabilities: [] };
  const intelligence = new Map();

  const scanRuleIds = [
    'duplicates',
    'deprecated',
    'native-modules',
    'peer-conflicts',
    'install-scripts',
    'lockfile-consistency',
    'workspace-drift'
  ];
  const enabledRules = builtinRules.filter(
    (rule) => scanRuleIds.includes(rule.id) && context.config.rules[rule.id] !== false
  );

  const findings = (
    await Promise.all(
      enabledRules.map((rule) => rule.run({ context, graph, intelligence, usage, lockfileAnalysis, audit }))
    )
  ).flat();

  const filtered = findings.filter(
    (finding) => !finding.packageName || !config.ignorePackages.includes(finding.packageName)
  );

  return {
    context,
    graph,
    findings: filtered,
    score: { overall: 0, breakdown: [], grade: 'F' },
    remediation: [],
    usage,
    lockfileAnalysis,
    audit,
    packageIntelligence: [],
    generatedAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - started),
    pipeline: 'SCAN_PIPELINE' as const
  };
}

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
    scanSourceUsage(context, options.unused ?? true, graph),
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
    durationMs: Math.round(performance.now() - started),
    pipeline: 'ANALYZE_PIPELINE' as const
  };
}

export async function doctorProject(options: ScanOptions): Promise<AnalysisResult> {
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
    scanSourceUsage(context, options.unused ?? true, graph),
    analyzeLockfile(context),
    runAudit(context, options.audit ?? true),
    collectPackageIntelligence(context, graph, options.onlineMetadata ?? true)
  ]);
  const enabledRules = [...builtinRules, ...plugins.rules].filter(
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
    durationMs: Math.round(performance.now() - started),
    pipeline: 'DOCTOR_PIPELINE' as const
  };
}
