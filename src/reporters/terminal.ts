import chalk from 'chalk';
import type { AnalysisResult, ExplainResult, Finding, ReporterOptions } from '../types/index.js';
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

const icon = {
  ok: 'OK',
  warn: '!',
  fail: 'x',
  info: 'i'
};

export function renderTerminal(result: AnalysisResult, options: ReporterOptions = {}): string {
  const lines: string[] = [];
  if (process.env.PKG_CT_DEBUG) process.stderr.write(`[pkg-ct] ANALYZE_PIPELINE\n`);
  lines.push(chalk.bold('\npkg-ct'));
  lines.push(
    `${scoreBadge(result.score.overall)} ${chalk.bold(`Project Health Score: ${result.score.overall}/100 (${result.score.grade})`)}`
  );
  lines.push(chalk.dim(`Analyzed ${result.graph.nodes.size} packages in ${result.durationMs}ms`));
  lines.push('');

  lines.push(chalk.bold('Top Findings'));
  const top = [...result.findings].sort(bySeverity).slice(0, options.verbose ? 20 : 8);
  if (top.length === 0) {
    lines.push(`${chalk.green(icon.ok)} No material dependency issues detected.`);
  } else {
    for (const finding of top) {
      lines.push(formatFinding(finding));
    }
  }

  lines.push('');
  lines.push(chalk.bold('Health Breakdown'));
  for (const item of result.score.breakdown) {
    lines.push(`${bar(item.score)} ${item.category.padEnd(20)} ${String(item.score).padStart(3)}/100`);
  }

  if (result.remediation.length > 0) {
    lines.push('');
    lines.push(chalk.bold('Remediation Plan'));
    for (const plan of result.remediation.slice(0, 5)) {
      lines.push(
        `${chalk.cyan('->')} ${chalk.bold(plan.title)} ${chalk.dim(`impact:${plan.impact} difficulty:${plan.difficulty}`)}`
      );
      if (plan.actions[0]?.commands[0]) lines.push(chalk.dim(`  ${plan.actions[0].commands[0]}`));
    }
  }

  return lines.join('\n');
}

export function renderHealthSummary(result: AnalysisResult, options: ReporterOptions = {}): string {
  const lines: string[] = [];
  if (process.env.PKG_CT_DEBUG) process.stderr.write(`[pkg-ct] ANALYZE_PIPELINE (health)\n`);
  lines.push(chalk.bold('\npkg-ct health'));
  lines.push(
    `${scoreBadge(result.score.overall)} ${chalk.bold(`Project Health Score: ${result.score.overall}/100 (${result.score.grade})`)}`
  );
  lines.push(chalk.dim(`Analyzed ${result.graph.nodes.size} packages in ${result.durationMs}ms`));
  lines.push('');
  lines.push(chalk.bold('Score Breakdown'));
  for (const item of result.score.breakdown) {
    lines.push(`${bar(item.score)} ${item.category.padEnd(20)} ${String(item.score).padStart(3)}/100  ${chalk.dim(item.explanation)}`);
  }
  const criticalFindings = result.findings.filter((f) => f.severity === 'critical' || f.severity === 'high').slice(0, 3);
  if (criticalFindings.length > 0) {
    lines.push('');
    lines.push(chalk.bold('Critical Attention Required'));
    for (const finding of criticalFindings) lines.push(formatFinding(finding));
  }
  return lines.join('\n');
}

export function renderScanInventory(result: AnalysisResult): string {
  const metrics = inventoryMetrics(result);
  return [
    chalk.bold('\npkg-ct scan'),
    `Packages: ${metrics.packages}`,
    `Duplicate package families: ${metrics.duplicates}`,
    `Deprecated packages: ${metrics.deprecated}`,
    `Peer dependency issues: ${metrics.peerConflicts}`,
    `Install script packages: ${metrics.installScripts}`,
    `Native build risks: ${metrics.nativeRisks}`,
    `Lockfile: ${result.context.lockfile ? result.context.packageManager : 'missing'}`,
    chalk.dim(`Scanned in ${result.durationMs}ms`)
  ].join('\n');
}

export function renderDoctor(result: AnalysisResult, options: ReporterOptions = {}): string {
  if (process.env.PKG_CT_DEBUG) process.stderr.write(`[pkg-ct] DOCTOR_PIPELINE\n`);
  const metrics = inventoryMetrics(result);
  const byCategory = (category: string) => result.findings.filter((finding) => finding.category === category);
  const section = (title: string, findings: Finding[]) => {
    const lines = [chalk.bold(`\n=== ${title} ===`)];
    if (findings.length === 0) {
      lines.push('No material findings.');
    } else {
      for (const finding of findings.sort(bySeverity).slice(0, options.verbose ? 12 : 5)) {
        lines.push(formatFinding(finding));
      }
    }
    return lines.join('\n');
  };

  // Unused dependency confidence section
  const unusedFindings = result.findings.filter((f) => f.id.startsWith('unused:'));
  const confidenceSection = (): string => {
    const lines = [chalk.bold('\n=== Unused Dependencies (Confidence Engine) ===')];
    if (unusedFindings.length === 0) {
      lines.push('No low-confidence direct dependencies detected.');
    } else {
      for (const finding of unusedFindings.sort(bySeverity).slice(0, options.verbose ? 12 : 5)) {
        const confEvidence = finding.evidence.find((e) => e.startsWith('usage confidence:'));
        const safeEvidence = finding.evidence.find((e) => e.startsWith('safe removal probability:'));
        lines.push(`${findingIcon(finding.severity)} ${chalk.bold(finding.packageName ?? finding.id)}`);
        if (confEvidence) lines.push(`  ${chalk.cyan(confEvidence)}`);
        if (safeEvidence) lines.push(`  ${chalk.yellow(safeEvidence)}`);
        lines.push(`  ${chalk.dim(finding.recommendation)}`);
      }
    }
    return lines.join('\n');
  };

  const lines = [
    chalk.bold('\npkg-ct doctor'),
    chalk.bold('\n=== Inventory ==='),
    `Packages: ${metrics.packages}`,
    `Duplicate families: ${metrics.duplicates}`,
    `Deprecated packages: ${metrics.deprecated}`,
    `Peer issues: ${metrics.peerConflicts}`,
    `Native risks: ${metrics.nativeRisks}`,
    chalk.bold('\n=== Health ==='),
    `Project Health Score: ${result.score.overall}/100 (${result.score.grade})`,
    ...result.score.breakdown.map((item) => `${item.category}: ${item.score}/100 - ${item.explanation}`),
    section('Security', byCategory('security')),
    section('Duplication', byCategory('duplication')),
    section('Compatibility', byCategory('compatibility')),
    section('Freshness', byCategory('freshness')),
    confidenceSection(),
    chalk.bold('\n=== Fix Plan ===')
  ];

  if (result.remediation.length === 0) {
    lines.push('No automatic remediation plan required.');
  } else {
    for (const plan of result.remediation.slice(0, options.verbose ? 10 : 5)) {
      lines.push(`${plan.title} (${plan.impact} impact, ${plan.difficulty})`);
      if (plan.actions[0]?.commands[0]) lines.push(`  ${plan.actions[0].commands[0]}`);
    }
  }

  return lines.join('\n');
}

export function renderExplain(explain: ExplainResult): string {
  const lines: string[] = [];
  lines.push(chalk.bold(`\n${explain.packageName}`));
  lines.push('');

  if (explain.nodes.length === 0) {
    lines.push(chalk.yellow(`No installed or declared package named ${explain.packageName} was found.`));
    return lines.join('\n');
  }

  const roleColor = explain.role === 'CORE_RUNTIME' || explain.role === 'FRAMEWORK' ? chalk.red :
    explain.role === 'TOOL' || explain.role === 'TRANSITIVE' ? chalk.blue : chalk.cyan;
  lines.push(`Role:                 ${roleColor(chalk.bold(explain.role))}`);
  lines.push('');

  lines.push(chalk.bold('Why it exists:'));
  if (explain.referencedBy.length > 0) {
    lines.push(`Referenced directly by ${explain.referencedBy.length} source file(s).`);
    for (const ref of explain.referencedBy.slice(0, 5)) lines.push(`  ${chalk.dim(ref)}`);
    if (explain.referencedBy.length > 5) lines.push(chalk.dim(`  ... and ${explain.referencedBy.length - 5} more`));
  } else {
    lines.push(`  No source, config, script, CI, or framework evidence found.`);
  }
  lines.push('');

  if (explain.chains.length > 0) {
    lines.push(chalk.bold('Dependency chain:'));
    for (const chain of explain.chains.slice(0, 3)) {
      lines.push(`  ${renderChain(chain.map((node) => `${node.name}@${node.version}`))}`);
    }
    lines.push('');
  }

  if (explain.directDependents.length > 0) {
    lines.push(chalk.bold('Direct dependents:'));
    for (const dep of explain.directDependents.slice(0, 6)) lines.push(`  ${dep}`);
    if (explain.directDependents.length > 6) lines.push(chalk.dim(`  ... and ${explain.directDependents.length - 6} more`));
    lines.push('');
  }

  const blastColor = explain.blastRadius === 'EXTREME' || explain.blastRadius === 'HIGH' ? chalk.red :
    explain.blastRadius === 'MEDIUM' ? chalk.yellow : chalk.green;
  lines.push(`Blast radius:         ${blastColor(chalk.bold(explain.blastRadius))} (${explain.blastRadiusCount} package(s) affected)`);

  const prodColor = explain.productionImpact === 'CRITICAL' || explain.productionImpact === 'HIGH' ? chalk.red :
    explain.productionImpact === 'MEDIUM' ? chalk.yellow : chalk.dim;
  lines.push(`Production impact:    ${prodColor(chalk.bold(explain.productionImpact))}`);

  const safeColor = explain.safeRemovalProbabilityPercent >= 90 ? chalk.green :
    explain.safeRemovalProbabilityPercent >= 60 ? chalk.yellow : chalk.red;
  lines.push(`Safe removal prob.:   ${safeColor(`${explain.safeRemovalProbabilityPercent}%`)}`);
  lines.push('');

  lines.push(chalk.bold('Impact:'));
  lines.push(`  ${formatBytes(explain.installImpactBytes)} estimated install footprint`);
  lines.push(`  duplicated ${explain.duplicates.length > 0 ? `${explain.duplicates.length} times` : '0 times'}`);
  if (explain.health?.latest) lines.push(`  latest version: ${explain.health.latest}`);
  if (explain.health?.weeklyDownloads !== undefined) {
    lines.push(`  weekly downloads: ${explain.health.weeklyDownloads.toLocaleString()}`);
  }
  if (explain.health?.maintainers !== undefined) lines.push(`  maintainers: ${explain.health.maintainers}`);
  if (explain.health?.ageDays !== undefined) lines.push(`  latest publish age: ${explain.health.ageDays} days`);
  lines.push('');

  if (explain.findings.length > 0) {
    lines.push(chalk.bold('Risks:'));
    for (const finding of explain.findings.slice(0, 5)) lines.push(`  ${formatFinding(finding)}`);
    lines.push('');
  }

  lines.push(chalk.bold('Upgrade impact:'));
  if (explain.blastRadius === 'EXTREME' || explain.blastRadius === 'HIGH') {
    lines.push(`  ${chalk.red('High risk')} — ${explain.blastRadiusCount} packages depend on this. Run pkg-ct upgrade ${explain.packageName}@<version> before bumping.`);
  } else if (explain.blastRadius === 'MEDIUM') {
    lines.push(`  ${chalk.yellow('Moderate risk')} — review ${explain.directDependents.slice(0, 3).join(', ')} compatibility.`);
  } else {
    lines.push(`  ${chalk.green('Low risk')} — few downstream dependents.`);
  }
  lines.push('');

  lines.push(chalk.bold('Alternatives:'));
  lines.push(explain.alternatives.map((item) => `  - ${item}`).join('\n'));
  return lines.join('\n');
}

export function renderRoast(result: AnalysisResult): string {
  const metrics = inventoryMetrics(result);
  const duplicates = metrics.duplicates;
  const deprecated = metrics.deprecated;
  const native = metrics.nativeRisks;
  const lifecycle = metrics.installScripts;
  const unused = result.findings.filter((finding) => finding.id.startsWith('unused:')).length;
  const peer = metrics.peerConflicts;
  const audit = result.findings.filter((finding) => finding.id.startsWith('audit:')).length;
  const nodeCount = result.graph.nodes.size;
  const findingCount = result.findings.length;

  const seedCount = nodeCount;
  const seedDup = duplicates + 3;
  const seedPeer = peer + 7;
  const seedSec = audit + 11;
  const seedDep = deprecated + 17;
  const seedUnused = unused + 23;

  const countText = pickTemplate(packageCountTemplates, seedCount).replace('{count}', chalk.bold(String(nodeCount)));
  const dupText = duplicates
    ? pickTemplate(duplicateTemplates, seedDup).replace('{count}', chalk.bold(String(duplicates)))
    : 'No duplicate families. Suspiciously disciplined. I will allow it.';
  const peerText = peer
    ? pickTemplate(peerTemplates, seedPeer).replace('{count}', chalk.bold(String(peer)))
    : 'No peer dependency drama detected. A rare diplomatic achievement.';
  const secText = audit
    ? pickTemplate(securityTemplates, seedSec).replace('{count}', chalk.bold(String(audit)))
    : 'No audit findings in this run. Security did not throw a chair today.';
  const depText = deprecated
    ? pickTemplate(deprecatedTemplates, seedDep).replace('{count}', chalk.bold(String(deprecated)))
    : 'No deprecated packages surfaced. The past has been kept at a polite distance.';
  const unusedText = unused
    ? pickTemplate(unusedTemplates, seedUnused).replace('{count}', chalk.bold(String(unused)))
    : 'No unused direct packages surfaced. The manifest is either clean or very good at hiding things.';

  const verdictText = roastVerdict(result.score.overall);
  const healthText = `Health score: ${result.score.overall}/100. ${verdictText}`;

  const lines = [
    chalk.bold('\nDependency Roast'),
    countText,
    `${findingCount} findings surfaced.`,
    dupText,
    unusedText,
    peerText,
    depText,
    native
      ? `${native} native install risk(s). CI will be fine, assuming every machine owns a compiler and a calming playlist.`
      : 'No native build drama detected. Your containers may sleep tonight.',
    lifecycle
      ? `${lifecycle} install script package(s). The install phase has side quests.`
      : 'No install lifecycle surprises. Refreshing, frankly.',
    secText,
    healthText
  ];
  return lines.join('\n');
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

function scoreBadge(score: number): string {
  if (score >= 90) return chalk.green('[A]');
  if (score >= 80) return chalk.green('[B]');
  if (score >= 70) return chalk.yellow('[C]');
  if (score >= 55) return chalk.red('[D]');
  return chalk.red('[F]');
}

function bar(score: number): string {
  const filled = Math.round(score / 10);
  return chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(10 - filled));
}

/** Returns a coloured icon string for a given severity level. */
function findingIcon(severity: string): string {
  switch (severity) {
    case 'critical': return chalk.red('[!!]');
    case 'high':     return chalk.red('[x]');
    case 'medium':   return chalk.yellow('[!]');
    case 'low':      return chalk.blue('[i]');
    default:         return chalk.dim('[ ]');
  }
}

function formatFinding(finding: Finding): string {
  const sev = finding.severity.toUpperCase().padEnd(8);
  const colorFn =
    finding.severity === 'critical' || finding.severity === 'high'
      ? chalk.red
      : finding.severity === 'medium'
        ? chalk.yellow
        : chalk.blue;
  return `${colorFn(sev)} ${finding.title}${finding.packageName ? chalk.dim(` (${finding.packageName})`) : ''}`;
}

function bySeverity(a: Finding, b: Finding): number {
  const rank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
  return (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0);
}

function renderChain(parts: string[]): string {
  return parts.join(chalk.dim(' → '));
}
