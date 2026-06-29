import chalk from 'chalk';
import type {
  AnalysisResult,
  ExplainResult,
  Finding,
  PackageUsageEvidence,
  ReporterOptions
} from '../types/index.js';
import { formatBytes } from '../utils/bytes.js';
import {
  packageCountTemplates,
  duplicateTemplates,
  peerTemplates,
  securityTemplates,
  deprecatedTemplates,
  unusedTemplates,
  roastVerdict,
  pickTemplate
} from './roast-templates.js';

const WIDTH = 72;
const DIVIDER = '-'.repeat(WIDTH);

export function renderTerminal(result: AnalysisResult, options: ReporterOptions = {}): string {
  if (process.env.PKG_CT_DEBUG) process.stderr.write('[pkg-ct] ANALYZE_PIPELINE\n');
  const lines = [
    '',
    chalk.bold('pkg-ct'),
    `${scoreBadge(result.score.overall)} ${chalk.bold(`Project Health Score: ${result.score.overall}/100 (${result.score.grade})`)}`,
    chalk.dim(`Analyzed ${result.graph.nodes.size} packages in ${result.durationMs}ms`),
    '',
    chalk.bold('Top Findings')
  ];
  const top = [...result.findings].sort(bySeverity).slice(0, options.verbose ? 20 : 8);
  if (top.length === 0) lines.push(`${chalk.green('OK')} No material dependency issues detected.`);
  else top.forEach((finding) => lines.push(formatFinding(finding)));

  lines.push('', chalk.bold('Health Breakdown'));
  result.score.breakdown.forEach((item) => {
    lines.push(`${bar(item.score)} ${item.category.padEnd(20)} ${String(item.score).padStart(3)}/100`);
  });

  if (result.remediation.length > 0) {
    lines.push('', chalk.bold('Remediation Plan'));
    for (const plan of result.remediation.slice(0, 5)) {
      lines.push(`${chalk.cyan('->')} ${chalk.bold(plan.title)} ${chalk.dim(`impact:${plan.impact} difficulty:${plan.difficulty}`)}`);
      if (plan.actions[0]?.commands[0]) lines.push(chalk.dim(`   ${plan.actions[0].commands[0]}`));
    }
  }
  return lines.join('\n');
}

export function renderHealthSummary(result: AnalysisResult): string {
  if (process.env.PKG_CT_DEBUG) process.stderr.write('[pkg-ct] ANALYZE_PIPELINE (health)\n');
  const lines = [
    '',
    chalk.bold('pkg-ct health'),
    `${scoreBadge(result.score.overall)} ${chalk.bold(`Project Health Score: ${result.score.overall}/100 (${result.score.grade})`)}`,
    chalk.dim(`Analyzed ${result.graph.nodes.size} packages in ${result.durationMs}ms`),
    '',
    chalk.bold('Score Breakdown')
  ];
  result.score.breakdown.forEach((item) => {
    lines.push(`${bar(item.score)} ${item.category.padEnd(20)} ${String(item.score).padStart(3)}/100  ${chalk.dim(item.explanation)}`);
  });
  const critical = result.findings.filter((finding) =>
    finding.severity === 'critical' || finding.severity === 'high'
  ).slice(0, 3);
  if (critical.length > 0) {
    lines.push('', chalk.bold('Critical Attention Required'));
    critical.forEach((finding) => lines.push(formatFinding(finding)));
  }
  return lines.join('\n');
}

export function renderScanInventory(result: AnalysisResult): string {
  const metrics = inventoryMetrics(result);
  return [
    '',
    chalk.bold('pkg-ct scan'),
    `Packages:                   ${metrics.packages}`,
    `Duplicate package families: ${metrics.duplicates}`,
    `Deprecated packages:        ${metrics.deprecated}`,
    `Peer dependency issues:     ${metrics.peerConflicts}`,
    `Install script packages:    ${metrics.installScripts}`,
    `Native build risks:         ${metrics.nativeRisks}`,
    `Lockfile:                   ${result.context.lockfile ? result.context.packageManager : 'missing'}`,
    chalk.dim(`Scanned in ${result.durationMs}ms`)
  ].join('\n');
}

export function renderDoctor(result: AnalysisResult, options: ReporterOptions = {}): string {
  if (process.env.PKG_CT_DEBUG) process.stderr.write('[pkg-ct] DOCTOR_PIPELINE\n');
  const metrics = inventoryMetrics(result);
  const lines = [
    '',
    chalk.bold('='.repeat(WIDTH)),
    chalk.bold('PKG-CT DEPENDENCY DOCTOR'),
    chalk.bold('='.repeat(WIDTH)),
    `${scoreBadge(result.score.overall)} Health Score: ${chalk.bold(`${result.score.overall}/100`)}  Grade: ${chalk.bold(result.score.grade)}`,
    chalk.dim(`${result.graph.nodes.size} packages | ${result.findings.length} findings | ${result.durationMs}ms`),
    '',
    heading('INVENTORY'),
    `Packages             ${String(metrics.packages).padStart(6)}`,
    `Duplicate families   ${String(metrics.duplicates).padStart(6)}`,
    `Deprecated           ${String(metrics.deprecated).padStart(6)}`,
    `Peer issues          ${String(metrics.peerConflicts).padStart(6)}`,
    `Native risks         ${String(metrics.nativeRisks).padStart(6)}`,
    '',
    heading('HEALTH BREAKDOWN')
  ];

  result.score.breakdown.forEach((item) => {
    lines.push(`${bar(item.score)}  ${item.category.padEnd(20)} ${String(item.score).padStart(3)}/100`);
  });

  lines.push('', heading('TOP ACTIONS'));
  const prioritized = rankFindings(result);
  if (prioritized.length === 0) lines.push(chalk.green('OK  No critical actions required.'));
  else prioritized.forEach((finding, index) => {
    lines.push(`${index + 1}. ${finding.title} [${finding.severity.toUpperCase()}]`);
    lines.push(`   ${shorten(finding.recommendation, WIDTH - 3)}`);
  });

  lines.push('', heading('ROOT CAUSES'));
  const rootCauses = buildRootCauses(result);
  if (rootCauses.length === 0) lines.push(chalk.green('OK  No systemic root causes detected.'));
  else rootCauses.forEach((cause, index) => {
    lines.push(`Root Cause ${index + 1}: ${cause.issue}`);
    lines.push(`  Symptoms: ${cause.count}`);
    lines.push(`  Triggered by: ${cause.triggers.join(', ')}`);
    lines.push(`  Next step: ${cause.recommendation}`);
  });

  for (const [title, category] of [
    ['SECURITY', 'security'],
    ['DUPLICATION', 'duplication'],
    ['COMPATIBILITY', 'compatibility'],
    ['FRESHNESS', 'freshness']
  ] as const) {
    lines.push('', findingSection(title, result.findings.filter((finding) => finding.category === category), options));
  }

  lines.push('', heading('UNUSED DEPENDENCIES  (Confidence Engine)'));
  const unused = result.findings.filter((finding) => finding.id.startsWith('unused:')).sort(bySeverity);
  if (unused.length === 0) lines.push(chalk.dim('No low-confidence direct dependencies detected.'));
  else {
    for (const finding of unused.slice(0, options.verbose ? 12 : 5)) {
      lines.push(`${findingIcon(finding.severity)} ${chalk.bold(finding.packageName ?? finding.id)}`);
      // Display additive confidence evidence table
      const confLine = finding.evidence.find((item) => item.startsWith('usage confidence:'));
      const safeLine = finding.evidence.find((item) => item.startsWith('safe removal probability:'));
      if (confLine) lines.push(`  ${confLine}`);
      if (safeLine) lines.push(`  ${safeLine}`);
      const evidenceSignals = finding.evidence.filter((item) => /: \+\d+$/.test(item));
      if (evidenceSignals.length > 0) {
        lines.push(`  ${'Evidence'.padEnd(24)} Weight`);
        lines.push(`  ${chalk.dim('-'.repeat(36))}`);
        for (const signal of evidenceSignals) {
          const [label, weight] = signal.split(': +');
          if (label && weight) {
            lines.push(`  ${label.padEnd(24)} ${chalk.cyan(`+${weight}`)}`);
          }
        }
      }
      lines.push(`  ${finding.recommendation}`);
    }
  }

  lines.push('', heading('AI FIX PLAN'));
  const fixPlan = buildFixPlan(result);
  if (fixPlan.length === 0) lines.push(chalk.green('OK  No fix steps required.'));
  else {
    fixPlan.forEach((step, index) => {
      lines.push(`Step ${index + 1}: ${step.title}`);
      if (step.command) lines.push(`  $ ${step.command}`);
      lines.push(`  Expected gain: +${step.scoreGain} pts  ${progressBar(step.confidence)}`);
    });
    const totalGain = fixPlan.reduce((sum, step) => sum + step.scoreGain, 0);
    const noFindings = result.findings.length === 0;
    const current = noFindings ? result.score.overall : Math.min(95, result.score.overall);
    const optimistic = noFindings ? 100 : Math.min(95, current + Math.round(totalGain * 0.8));
    const likely = noFindings ? 100 : Math.min(95, current + Math.round(totalGain * 0.65));
    const conservative = noFindings ? 100 : Math.min(90, current + Math.round(totalGain * 0.35));
    lines.push(
      '',
      'Projected score:',
      `  Optimistic:   ${optimistic}`,
      `  Likely:       ${likely}`,
      `  Conservative: ${conservative}`
    );
  }

  lines.push('', heading('RELEASE READINESS'));
  const readiness = buildReleaseReadiness(result);
  lines.push(`Score: ${readiness.score}/100  ${progressBar(readiness.score)}`);
  readiness.checks.forEach((check) => {
    lines.push(`${check.passed ? 'OK' : 'X '}  ${check.label.padEnd(28)} ${check.passed ? check.reason : check.reason}`);
  });
  lines.push('', `Ready: ${readiness.ready ? chalk.green.bold('YES') : chalk.red.bold('NO')}`);
  readiness.blocking.forEach((blocker) => lines.push(`  - ${blocker}`));
  lines.push('', chalk.bold('='.repeat(WIDTH)));
  return lines.join('\n');
}

export function renderExplain(explain: ExplainResult): string {
  const lines = ['', chalk.bold(explain.packageName), DIVIDER];
  if (explain.nodes.length === 0) {
    lines.push(chalk.yellow(`No installed or declared package named ${explain.packageName} was found.`));
    return lines.join('\n');
  }

  lines.push(
    `Production role: ${chalk.bold(explain.role)}`,
    `Evidence: ${explain.productionEvidence.join('; ')}`,
    '',
    heading('WHY INSTALLED')
  );
  if (explain.directlyDeclared) {
    lines.push('Imported directly: YES');
    lines.push('Evidence: declared by the root package.json.');
  } else {
    lines.push('Imported directly: NO');
    lines.push('Evidence: absent from root package.json dependency fields.');
  }
  lines.push(`Imported indirectly: ${explain.directDependents.length > 0 ? 'YES' : 'NO'}`);
  lines.push(`Evidence: ${explain.directDependents.length} direct graph parent(s).`);
  if (explain.directDependents.length > 0) {
    lines.push(`Who imports it: ${explain.directDependents.slice(0, 8).join(', ')}`);
  }

  lines.push('', heading('SOURCE USAGE'));
  lines.push(`Files importing it: ${explain.importedByFiles.length}`);
  if (explain.importedByFiles.length > 0) {
    explain.importedByFiles.slice(0, 8).forEach((file) => lines.push(`  - ${file}`));
  } else {
    lines.push('Evidence: no static import, dynamic import, or require reference found.');
  }

  lines.push('', heading('EVIDENCE CONFIDENCE'));
  const breakdown = confidenceBreakdown(explain.usageEvidence);
  if (breakdown.length === 0) lines.push('No usage signals: +0');
  else breakdown.forEach((item) => lines.push(`${item.label.padEnd(24)} +${item.contribution}`));
  lines.push(`Total confidence: ${explain.usageConfidence}%`);

  lines.push('', heading('DEPENDENCY CHAIN'));
  if (explain.chains.length === 0) lines.push('No graph path was resolved.');
  else explain.chains.slice(0, 4).forEach((chain) => {
    lines.push(`  ${chain.map((node) => `${node.name}@${node.version}`).join(' -> ')}`);
  });

  lines.push('', heading('BLAST RADIUS'));
  lines.push(`${explain.blastRadius} (${explain.blastRadiusCount} reverse dependency node(s))`);
  lines.push(`Evidence: ${explain.directDependents.length} direct graph parent(s); ${explain.blastRadiusCount} total reverse-reachable node(s).`);

  lines.push('', heading('SAFE REMOVAL'));
  lines.push(`Probability: ${explain.safeRemovalProbabilityPercent}% (${explain.safeRemovalProbability})`);
  explain.safeRemovalEvidence.forEach((evidence) => lines.push(`  - ${evidence}`));

  lines.push('', heading('UPGRADE RISK'));
  lines.push(explain.upgradeRisk);
  explain.upgradeRiskEvidence.forEach((evidence) => lines.push(`  - ${evidence}`));

  lines.push('', heading('INSTALL AND PACKAGE EVIDENCE'));
  lines.push(`Install footprint: ${formatBytes(explain.installImpactBytes)} across ${explain.nodes.length} installed version(s).`);
  if (explain.health?.latest) lines.push(`Latest npm dist-tag: ${explain.health.latest}`);
  if (explain.health?.weeklyDownloads !== undefined) lines.push(`Weekly npm downloads: ${explain.health.weeklyDownloads.toLocaleString()}`);
  if (explain.health?.publishedAt) lines.push(`Latest npm publish: ${explain.health.publishedAt}`);

  if (explain.findings.length > 0) {
    lines.push('', heading('ACTIVE FINDINGS'));
    explain.findings.slice(0, 8).forEach((finding) => {
      lines.push(formatFinding(finding));
      finding.evidence.slice(0, 3).forEach((evidence) => lines.push(`  Evidence: ${evidence}`));
    });
  }
  return lines.join('\n');
}

export function renderRoast(result: AnalysisResult): string {
  const metrics = inventoryMetrics(result);
  const unused = result.findings.filter((finding) => finding.id.startsWith('unused:')).length;
  const audit = result.findings.filter((finding) => finding.id.startsWith('audit:')).length;
  return [
    '',
    chalk.bold('Dependency Roast'),
    pickTemplate(packageCountTemplates, metrics.packages).replace('{count}', chalk.bold(String(metrics.packages))),
    metrics.duplicates
      ? pickTemplate(duplicateTemplates, metrics.duplicates + 3).replace('{count}', chalk.bold(String(metrics.duplicates)))
      : 'No duplicate families. Suspiciously disciplined. I will allow it.',
    unused
      ? pickTemplate(unusedTemplates, unused + 23).replace('{count}', chalk.bold(String(unused)))
      : 'No unused direct packages surfaced.',
    metrics.peerConflicts
      ? pickTemplate(peerTemplates, metrics.peerConflicts + 7).replace('{count}', chalk.bold(String(metrics.peerConflicts)))
      : 'No peer dependency drama detected.',
    metrics.deprecated
      ? pickTemplate(deprecatedTemplates, metrics.deprecated + 17).replace('{count}', chalk.bold(String(metrics.deprecated)))
      : 'No deprecated packages surfaced.',
    audit
      ? pickTemplate(securityTemplates, audit + 11).replace('{count}', chalk.bold(String(audit)))
      : 'No audit findings in this run.',
    `Health score: ${result.score.overall}/100. ${roastVerdict(result.score.overall)}`
  ].join('\n');
}

interface RootCause {
  issue: string;
  count: number;
  triggers: string[];
  recommendation: string;
}

export function buildRootCauses(result: AnalysisResult): RootCause[] {
  const causes: RootCause[] = [];
  const assigned = new Set<string>();
  const add = (issue: string, findings: Finding[], recommendation: string): void => {
    const unassigned = findings.filter((finding) => !assigned.has(finding.id));
    if (unassigned.length === 0) return;
    unassigned.forEach((finding) => assigned.add(finding.id));
    const triggers = [...new Set(unassigned.map((finding) => finding.packageName ?? finding.title))].slice(0, 4);
    causes.push({ issue, count: unassigned.length, triggers, recommendation });
  };

  add(
    'Framework mismatch',
    result.findings.filter((finding) => finding.id.includes('framework-mismatch')),
    'Align framework and renderer major versions.'
  );
  add(
    'Duplicate ecosystem',
    result.findings.filter((finding) => finding.category === 'duplication'),
    'Inspect introducer chains, align direct ranges, then run the package-manager dedupe command.'
  );
  add(
    'Build tooling',
    result.findings.filter((finding) => {
      const role = finding.packageName ? result.usage.packageUsage.get(finding.packageName)?.role : undefined;
      return finding.category === 'install-performance' ||
        ['BUILD_TOOL', 'BUILD_RUNTIME', 'CONFIG_TOOL', 'TRANSPILER', 'BUNDLER'].includes(role ?? '');
    }),
    'Upgrade or consolidate the direct build tool that introduces these findings.'
  );
  add(
    'Security',
    result.findings.filter((finding) => finding.category === 'security'),
    'Prioritize production-reachable advisories before development-only findings.'
  );
  add(
    'Unused dependencies',
    result.findings.filter((finding) => finding.id.startsWith('unused:')),
    'Review evidence per package; remove only after build and test verification.'
  );
  add(
    'Dependency compatibility',
    result.findings.filter((finding) => finding.category === 'compatibility'),
    'Resolve required peer and engine conflicts at their direct introducer.'
  );
  add(
    'Freshness lag',
    result.findings.filter((finding) => finding.category === 'freshness'),
    'Review outdated and stale packages; upgrade those with changelog-proven compatibility.'
  );
  add(
    'Maintainability',
    result.findings.filter((finding) => finding.category === 'maintainability'),
    'Evaluate single-maintainer and deep-chain packages for long-term continuity risk.'
  );
  return causes;
}

interface FixStep {
  title: string;
  command?: string;
  scoreGain: number;
  confidence: number;
}

function buildFixPlan(result: AnalysisResult): FixStep[] {
  const steps: FixStep[] = [];
  const duplicates = result.findings.filter((finding) => finding.category === 'duplication').length;
  const requiredPeers = result.findings.filter((finding) =>
    finding.id.startsWith('peer:') && finding.severity !== 'low' && finding.severity !== 'info'
  ).length;
  const unused = result.findings.filter((finding) => finding.id.startsWith('unused:')).length;
  const security = result.findings.filter((finding) =>
    finding.category === 'security' && finding.severity !== 'low'
  ).length;
  if (duplicates > 0) steps.push({
    title: 'Deduplicate packages',
    command: 'npm dedupe',
    scoreGain: Math.min(20, Math.round(duplicates * 0.8)),
    confidence: 80
  });
  if (requiredPeers > 0) steps.push({
    title: 'Review peer dependency tree and install required peers',
    scoreGain: Math.min(18, Math.round(requiredPeers * 0.6)),
    confidence: 65
  });
  if (unused > 0) steps.push({
    title: `Review ${unused} suspected unused direct dependencies`,
    scoreGain: Math.min(10, Math.round(unused * 0.5)),
    confidence: 50
  });
  if (security > 0) steps.push({
    title: `Review ${security} security findings`,
    command: 'npm audit fix',
    scoreGain: 8,
    confidence: 70
  });
  return steps;
}

interface ReadinessCheck {
  label: string;
  passed: boolean;
  reason: string;
}

export interface ReleaseReadiness {
  score: number;
  ready: boolean;
  checks: ReadinessCheck[];
  blocking: string[];
}

export function calculateDuplicateThreshold(result: AnalysisResult): { threshold: number; factors: string[] } {
  const packages = Math.max(result.graph.nodes.size, result.lockfileAnalysis.packageCount);
  let threshold = packages >= 500 ? 35 : packages >= 200 ? 20 : 10;
  const factors = [`${packages} packages`];
  const frameworkNames = ['react', 'react-dom', 'next', 'vite', 'expo', '@nestjs/core', '@tanstack/react-start'];
  const declared = new Set([
    ...Object.keys(result.context.rootProject.dependencies),
    ...Object.keys(result.context.rootProject.devDependencies)
  ]);
  const framework = frameworkNames.find((name) => declared.has(name) || result.graph.byName.has(name));
  if (framework) {
    threshold += 5;
    factors.push(`${framework} framework allowance +5`);
  }
  if (result.context.isMonorepo) {
    const workspaceAllowance = Math.min(10, 5 + Math.floor(result.context.workspaces.length / 10) * 5);
    threshold += workspaceAllowance;
    factors.push(`monorepo/workspace allowance +${workspaceAllowance}`);
  }
  return { threshold, factors };
}

export function buildReleaseReadiness(result: AnalysisResult): ReleaseReadiness {
  const checks: ReadinessCheck[] = [];
  const blocking: string[] = [];
  const critical = result.findings.filter((finding) => finding.severity === 'critical');
  checks.push({
    label: 'No critical findings',
    passed: critical.length === 0,
    reason: critical.length === 0 ? 'OK' : `${critical.length} critical finding(s)`
  });
  if (critical.length > 0) blocking.push(`${critical.length} critical finding(s) must be resolved`);

  const requiredPeers = result.findings.filter((finding) =>
    finding.id.startsWith('peer:') && finding.severity !== 'low' && finding.severity !== 'info'
  );
  const optionalPeers = result.findings.filter((finding) =>
    finding.id.startsWith('peer:') && (finding.severity === 'low' || finding.severity === 'info')
  );
  checks.push({
    label: 'Peer deps satisfied',
    passed: requiredPeers.length === 0,
    reason: requiredPeers.length > 0
      ? `${requiredPeers.length} required peer conflict(s)`
      : optionalPeers.length > 0
        ? `${optionalPeers.length} optional peers available`
        : 'OK'
  });
  if (requiredPeers.length > 0) blocking.push(`${requiredPeers.length} unresolved peer dependency conflict(s)`);

  const severeSecurity = result.findings.filter((finding) =>
    finding.category === 'security' && (finding.severity === 'high' || finding.severity === 'critical')
  );
  checks.push({
    label: 'No high security issues',
    passed: severeSecurity.length === 0,
    reason: severeSecurity.length === 0 ? 'OK' : `${severeSecurity.length} high/critical finding(s)`
  });
  if (severeSecurity.length > 0) blocking.push(`${severeSecurity.length} high/critical security finding(s)`);

  const { threshold, factors } = calculateDuplicateThreshold(result);
  const duplicateFindings = result.findings.filter((finding) => finding.category === 'duplication');
  const duplicateCount = duplicateFindings.length;
  const duplicatePressure = duplicateFindings.reduce((total, finding) => {
    if (finding.severity === 'high' || finding.severity === 'critical') return total + 2;
    if (finding.severity === 'medium') return total + 1;
    return total + 0.25;
  }, 0);
  const duplicatePressureLabel = Number.isInteger(duplicatePressure)
    ? String(duplicatePressure)
    : duplicatePressure.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  checks.push({
    label: 'Duplication under control',
    passed: duplicatePressure <= threshold,
    reason: `${duplicateCount} families; risk-adjusted ${duplicatePressureLabel}; threshold ${threshold} (${factors.join(', ')})`
  });
  if (duplicatePressure > threshold) {
    blocking.push(`${duplicateCount} duplicate package families exceeds threshold (${threshold})`);
  }

  const scoreOk = result.score.overall >= 60;
  checks.push({
    label: 'Health score >= 60',
    passed: scoreOk,
    reason: `Score is ${result.score.overall}/100`
  });
  if (!scoreOk) blocking.push(`Health score ${result.score.overall} is below release threshold (60)`);

  return {
    score: Math.round((checks.filter((check) => check.passed).length / checks.length) * 100),
    ready: blocking.length === 0,
    checks,
    blocking
  };
}

function findingSection(title: string, findings: Finding[], options: ReporterOptions): string {
  const lines = [heading(title)];
  if (findings.length === 0) lines.push(chalk.dim('No material findings.'));
  else findings.sort(bySeverity).slice(0, options.verbose ? 12 : 5)
    .forEach((finding) => lines.push(formatFinding(finding)));
  return lines.join('\n');
}

function confidenceBreakdown(evidence: PackageUsageEvidence[]): { label: string; contribution: number }[] {
  const labels: Record<PackageUsageEvidence['source'], string> = {
    source: 'Source imports',
    dynamic: 'Dynamic imports',
    runtime: 'Runtime references',
    config: 'Configuration files',
    script: 'Package scripts',
    ci: 'CI references',
    framework: 'Framework metadata',
    workspace: 'Workspace references',
    peer: 'Peer dependency usage',
    'build-plugin': 'Build plugins',
    weak: 'Naming heuristic',
    none: 'No evidence'
  };
  const contributions = new Map<PackageUsageEvidence['source'], number>();
  evidence.forEach((item) => {
    contributions.set(item.source, Math.max(contributions.get(item.source) ?? 0, item.confidence));
  });
  return [...contributions]
    .filter(([source]) => source !== 'none')
    .map(([source, contribution]) => ({ label: labels[source], contribution }));
}

function inventoryMetrics(result: AnalysisResult) {
  return {
    packages: result.graph.nodes.size,
    duplicates: result.findings.filter((finding) => finding.category === 'duplication').length,
    deprecated: result.findings.filter((finding) => finding.id.startsWith('deprecated:')).length,
    peerConflicts: result.findings.filter((finding) => finding.id.startsWith('peer:')).length,
    installScripts: result.findings.filter((finding) => finding.id.startsWith('lifecycle:')).length,
    nativeRisks: result.findings.filter((finding) => finding.id.startsWith('native:')).length
  };
}

function rankFindings(result: AnalysisResult): Finding[] {
  const rank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
  const production = new Set(Object.keys(result.context.rootProject.dependencies));
  return [...result.findings]
    .sort((a, b) => {
      const aScore = (rank[a.severity] ?? 0) * 10 + (a.packageName && production.has(a.packageName) ? 5 : 0);
      const bScore = (rank[b.severity] ?? 0) * 10 + (b.packageName && production.has(b.packageName) ? 5 : 0);
      return bScore - aScore;
    })
    .slice(0, 5);
}

function heading(title: string): string {
  return `${chalk.bold(title)}\n${chalk.dim(DIVIDER)}`;
}

function scoreBadge(score: number): string {
  if (score >= 90) return chalk.green('[A]');
  if (score >= 75) return chalk.green('[B]');
  if (score >= 60) return chalk.yellow('[C]');
  if (score >= 40) return chalk.red('[D]');
  return chalk.red('[F]');
}

function bar(score: number): string {
  const filled = Math.round(score / 10);
  return chalk.green('#'.repeat(filled)) + chalk.dim('-'.repeat(10 - filled));
}

function progressBar(percent: number): string {
  const value = Math.min(100, Math.max(0, percent));
  const filled = Math.round(value / 10);
  return `[${'#'.repeat(filled)}${'-'.repeat(10 - filled)}] ${value}%`;
}

function findingIcon(severity: string): string {
  if (severity === 'critical') return chalk.red('[!!]');
  if (severity === 'high') return chalk.red('[x]');
  if (severity === 'medium') return chalk.yellow('[!]');
  return chalk.blue('[i]');
}

function formatFinding(finding: Finding): string {
  const label = finding.severity.toUpperCase().padEnd(8);
  const color = finding.severity === 'critical' || finding.severity === 'high'
    ? chalk.red
    : finding.severity === 'medium'
      ? chalk.yellow
      : chalk.blue;
  return `${color(label)} ${shorten(finding.title, 58)}`;
}

function bySeverity(a: Finding, b: Finding): number {
  const rank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
  return (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0);
}

function shorten(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 3))}...`;
}
