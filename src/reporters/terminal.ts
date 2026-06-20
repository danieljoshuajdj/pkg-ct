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
  const divider = chalk.dim('─'.repeat(50));

  const section = (title: string, findings: Finding[]) => {
    const inner = [chalk.bold(`\n${title}`), divider];
    if (findings.length === 0) {
      inner.push(chalk.dim('  No material findings.'));
    } else {
      for (const finding of findings.sort(bySeverity).slice(0, options.verbose ? 12 : 5)) {
        inner.push('  ' + formatFinding(finding));
      }
    }
    return inner.join('\n');
  };

  const lines: string[] = [
    '',
    chalk.bold('━'.repeat(50)),
    chalk.bold('  PKG-CT DEPENDENCY DOCTOR'),
    chalk.bold('━'.repeat(50)),
    '',
    `${scoreBadge(result.score.overall)}  Health Score: ${chalk.bold(`${result.score.overall}/100`)}  Grade: ${chalk.bold(result.score.grade)}`,
    chalk.dim(`  ${result.graph.nodes.size} packages · ${result.findings.length} findings · ${result.durationMs}ms`),
    '',
    chalk.bold('INVENTORY'), divider,
    `  Packages:           ${chalk.bold(String(metrics.packages))}`,
    `  Duplicate families: ${metrics.duplicates > 0 ? chalk.yellow(String(metrics.duplicates)) : chalk.green('0')}`,
    `  Deprecated:         ${metrics.deprecated > 0 ? chalk.yellow(String(metrics.deprecated)) : chalk.green('0')}`,
    `  Peer conflicts:     ${metrics.peerConflicts > 0 ? chalk.red(String(metrics.peerConflicts)) : chalk.green('0')}`,
    `  Native risks:       ${metrics.nativeRisks > 0 ? chalk.yellow(String(metrics.nativeRisks)) : chalk.green('0')}`,
    '',
    chalk.bold('HEALTH BREAKDOWN'), divider,
  ];

  for (const item of result.score.breakdown) {
    lines.push(`  ${bar(item.score)}  ${item.category.padEnd(20)} ${String(item.score).padStart(3)}/100  ${chalk.dim(item.explanation)}`);
  }
  lines.push('');

  // ── Phase M: AI Priority Queue ──────────────────────────────────────────────
  lines.push(chalk.hex('#8B5CF6').bold('🏆 TOP ACTIONS'), divider);
  const prioritized = rankFindings(result);
  if (prioritized.length === 0) {
    lines.push(chalk.green('  ✅  No critical actions required.'));
  } else {
    prioritized.slice(0, 5).forEach((f, idx) => {
      const impColor = f.severity === 'critical' || f.severity === 'high' ? chalk.red : f.severity === 'medium' ? chalk.yellow : chalk.blue;
      const effortLabel = f.fix?.type === 'dedupe' || f.fix?.type === 'remove' ? chalk.green('LOW') : chalk.yellow('MEDIUM');
      lines.push(`  ${chalk.bold(`[${idx + 1}]`)} ${f.title}`);
      lines.push(`      Impact: ${impColor(f.severity.toUpperCase())}  Effort: ${effortLabel}`);
      if (f.packageName) lines.push(`      Package: ${chalk.dim(f.packageName)}`);
      lines.push(`      ${chalk.dim('→')} ${chalk.dim(f.recommendation)}`);
    });
  }
  lines.push('');

  // ── Phase N: Root Cause Analysis ────────────────────────────────────────────
  lines.push(chalk.hex('#8B5CF6').bold('🔍 ROOT CAUSES'), divider);
  const rootCauses = buildRootCauses(result);
  if (rootCauses.length === 0) {
    lines.push(chalk.green('  ✅  No systemic root causes detected.'));
  } else {
    rootCauses.forEach((rc, idx) => {
      lines.push(`  ${chalk.bold(`Root Cause #${idx + 1}:`)} ${chalk.yellow(rc.issue)}`);
      lines.push(`  Triggered by:    ${rc.triggers.slice(0, 4).join(', ') || 'Multiple transitive deps'}`);
      lines.push(`  Recommendation:  ${chalk.cyan(rc.recommendation)}`);
      if (idx < rootCauses.length - 1) lines.push(chalk.dim('  ' + '·'.repeat(24)));
    });
  }
  lines.push('');

  lines.push(section('SECURITY', byCategory('security')));
  lines.push(section('DUPLICATION', byCategory('duplication')));
  lines.push(section('COMPATIBILITY', byCategory('compatibility')));
  lines.push(section('FRESHNESS', byCategory('freshness')));
  lines.push('');

  // ── Unused Dependency Confidence Engine ─────────────────────────────────────
  const unusedFindings = result.findings.filter((f) => f.id.startsWith('unused:'));
  lines.push(chalk.bold('UNUSED DEPENDENCIES  (Confidence Engine)'), divider);
  if (unusedFindings.length === 0) {
    lines.push(chalk.dim('  No low-confidence direct dependencies detected.'));
  } else {
    for (const finding of unusedFindings.sort(bySeverity).slice(0, options.verbose ? 12 : 5)) {
      const confEvidence = finding.evidence.find((e) => e.startsWith('usage confidence:'));
      const safeEvidence = finding.evidence.find((e) => e.startsWith('safe removal probability:'));
      lines.push(`  ${findingIcon(finding.severity)} ${chalk.bold(finding.packageName ?? finding.id)}`);
      if (confEvidence) lines.push(`    ${chalk.cyan(confEvidence)}`);
      if (safeEvidence) lines.push(`    ${chalk.yellow(safeEvidence)}`);
      lines.push(`    ${chalk.dim(finding.recommendation)}`);
    }
  }
  lines.push('');

  // ── Phase O: AI Fix Plan with Score Projections ──────────────────────────────
  lines.push(chalk.hex('#8B5CF6').bold('🛠  AI FIX PLAN'), divider);
  const fixPlan = buildFixPlan(result);
  if (fixPlan.length === 0) {
    lines.push(chalk.green('  ✅  No automated fix steps required.'));
  } else {
    fixPlan.forEach((step, idx) => {
      lines.push(`  ${chalk.bold(`Step ${idx + 1}:`)} ${step.title}`);
      if (step.command) lines.push(`    ${chalk.dim('$')} ${chalk.cyan(step.command)}`);
      lines.push(`    Expected gain: ${chalk.green(`+${step.scoreGain} pts`)}  ${progressBar(step.confidence)}`);
    });
    const totalGain = fixPlan.reduce((s, f) => s + f.scoreGain, 0);
    const projected = Math.min(100, result.score.overall + totalGain);
    lines.push('');
    lines.push(`  Projected score: ${chalk.bold(String(result.score.overall))} → ${chalk.green.bold(String(projected))}`);
  }
  lines.push('');

  // ── Phase Q: Release Readiness ───────────────────────────────────────────────
  lines.push(chalk.hex('#8B5CF6').bold('🚀 RELEASE READINESS'), divider);
  const rr = buildReleaseReadiness(result);
  const rrColor = rr.score >= 80 ? chalk.green : rr.score >= 60 ? chalk.yellow : chalk.red;
  lines.push(`  Score: ${rrColor.bold(`${rr.score}/100`)}  ${progressBar(rr.score)}`);
  lines.push('');
  for (const check of rr.checks) {
    const chkIcon = check.passed ? chalk.green('✅') : chalk.red('❌');
    lines.push(`  ${chkIcon}  ${check.label.padEnd(22)} ${check.passed ? chalk.dim('OK') : chalk.red(check.reason)}`);
  }
  lines.push('');
  lines.push(`  Ready: ${rr.ready ? chalk.green.bold('YES') : chalk.red.bold('NO')}`);
  if (rr.blocking.length > 0) {
    for (const b of rr.blocking) lines.push(`    ${chalk.red('•')} ${b}`);
  }
  lines.push('');

  if (result.aiSummary) {
    lines.push(chalk.hex('#8B5CF6').bold('🧠 AI SUMMARY'), divider);
    lines.push(chalk.hex('#8B5CF6')(result.aiSummary));
    lines.push('');
  }

  lines.push(chalk.bold('━'.repeat(50)));
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
  lines.push('');

  // Blocker 2: Evidence-based AI Summary — no LLM, no hallucination.
  // Every sentence is derived from a real data point in ExplainResult.
  lines.push(chalk.hex('#8B5CF6').bold('🧠 AI Summary'));
  lines.push(chalk.dim('─'.repeat(50)));

  // Build evidence sentences
  const aiEvidence: string[] = [];
  if (explain.referencedBy.length > 0) {
    aiEvidence.push(`• imported by ${explain.referencedBy.length} source file(s)`);
  }
  if (explain.directDependents.length > 0) {
    aiEvidence.push(`• required by ${explain.directDependents.slice(0, 3).join(', ')}${explain.directDependents.length > 3 ? ` and ${explain.directDependents.length - 3} more` : ''}`);
  }
  if (explain.chains.length > 0 && explain.chains[0] && explain.chains[0].length > 2) {
    const chain = explain.chains[0];
    aiEvidence.push(`• dependency path: ${chain.map((n) => n.name).slice(0, 3).join(' → ')}`);
  }
  if (explain.findings.length > 0) {
    aiEvidence.push(`• ${explain.findings.length} active finding(s) detected`);
  }

  // Role-based opening sentence
  let summary: string;
  if (explain.role === 'CORE_RUNTIME' || explain.role === 'FRAMEWORK') {
    summary = `${explain.packageName} is a foundational ${explain.role === 'FRAMEWORK' ? 'framework' : 'runtime'} dependency.`;
  } else if (explain.role === 'TOOL') {
    summary = `${explain.packageName} is a development tooling dependency.`;
  } else if (explain.directDependents.length === 0 && explain.referencedBy.length === 0) {
    summary = `${explain.packageName} has no detected source usage or direct dependents.`;
  } else {
    summary = `${explain.packageName} is a ${explain.productionImpact === 'NONE' ? 'dev-only' : 'production-reachable'} dependency.`;
  }
  lines.push(`  ${summary}`);
  lines.push('');
  if (aiEvidence.length > 0) {
    lines.push(`  Evidence:`);
    for (const e of aiEvidence) lines.push(`    ${chalk.dim(e)}`);
    lines.push('');
  }

  // Impact statement
  let impactSentence: string;
  if (explain.blastRadius === 'EXTREME' || explain.productionImpact === 'CRITICAL') {
    impactSentence = `Removing ${explain.packageName} would break ${explain.blastRadiusCount} packages. This is a ${chalk.red('CRITICAL')} dependency.`;
  } else if (explain.blastRadius === 'HIGH' || explain.productionImpact === 'HIGH') {
    impactSentence = `Removing ${explain.packageName} would affect ${explain.blastRadiusCount} packages — ${chalk.red('HIGH')} risk.`;
  } else if (explain.blastRadius === 'MEDIUM') {
    impactSentence = `Removing ${explain.packageName} would affect ${explain.blastRadiusCount} packages — ${chalk.yellow('MEDIUM')} risk.`;
  } else if (explain.safeRemovalProbabilityPercent >= 80) {
    impactSentence = `${explain.packageName} appears safe to remove based on available evidence (${explain.safeRemovalProbabilityPercent}% safe removal probability).`;
  } else {
    impactSentence = `Impact of removing ${explain.packageName}: ${explain.blastRadiusCount} package(s) affected.`;
  }
  lines.push(`  Impact:`);
  lines.push(`    ${impactSentence}`);
  lines.push('');

  // Risk level
  const riskLabel = explain.removalRisk;
  const riskColor = riskLabel === 'EXTREME' || riskLabel === 'HIGH' ? chalk.red :
    riskLabel === 'MEDIUM' ? chalk.yellow : chalk.green;
  lines.push(`  Risk: ${riskColor(chalk.bold(riskLabel))}`);

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
  if (score >= 75) return chalk.green('[B]');
  if (score >= 60) return chalk.yellow('[C]');
  if (score >= 40) return chalk.red('[D]');
  return chalk.red('[F]');
}

function bar(score: number): string {
  const filled = Math.round(score / 10);
  return chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(10 - filled));
}

function progressBar(pct: number): string {
  const filled = Math.round(Math.min(100, Math.max(0, pct)) / 10);
  const color = pct >= 80 ? chalk.green : pct >= 60 ? chalk.yellow : chalk.red;
  return color('█'.repeat(filled)) + chalk.dim('░'.repeat(10 - filled)) + ` ${pct}%`;
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

// ── Phase M: Priority ranking ───────────────────────────────────────────────
function rankFindings(result: AnalysisResult): Finding[] {
  const severityScore: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
  const prodKeys = new Set(Object.keys(result.context.rootProject.dependencies));
  return [...result.findings]
    .map((f) => {
      const sev = severityScore[f.severity] ?? 0;
      const isProd = f.packageName ? prodKeys.has(f.packageName) : 0;
      const fixEase = f.fix?.type === 'dedupe' || f.fix?.type === 'remove' ? 2 : 1;
      return { finding: f, score: sev * 10 + (isProd ? 5 : 0) + fixEase };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.finding)
    .slice(0, 5);
}

// ── Phase N: Root cause clustering ──────────────────────────────────────────
interface RootCause { issue: string; triggers: string[]; recommendation: string; }

function buildRootCauses(result: AnalysisResult): RootCause[] {
  const causes: RootCause[] = [];

  const dupFindings = result.findings.filter((f) => f.category === 'duplication');
  if (dupFindings.length > 0) {
    const triggers = [...new Set(dupFindings.flatMap((f) => f.evidence).filter((e) => !e.includes(':') && e.length < 40))].slice(0, 4);
    causes.push({
      issue: `${dupFindings.length} duplicate package families`,
      triggers: triggers.length > 0 ? triggers : ['Multiple transitive dependency ranges'],
      recommendation: 'Run npm dedupe and align direct version ranges in package.json'
    });
  }

  const compatFindings = result.findings.filter((f) => f.category === 'compatibility');
  if (compatFindings.length > 0) {
    const pkgs = [...new Set(compatFindings.map((f) => f.packageName).filter(Boolean) as string[])].slice(0, 4);
    causes.push({
      issue: `${compatFindings.length} compatibility/peer conflicts`,
      triggers: pkgs.length > 0 ? pkgs : ['Transitive peer version drift'],
      recommendation: 'Align peer dependency versions; audit indirect dependencies'
    });
  }

  const freshFindings = result.findings.filter((f) => f.category === 'freshness' && (f.severity === 'high' || f.severity === 'critical'));
  if (freshFindings.length > 3) {
    causes.push({
      issue: `${freshFindings.length} severely outdated packages`,
      triggers: freshFindings.slice(0, 4).map((f) => f.packageName ?? 'unknown'),
      recommendation: 'Prioritise major upgrades for production dependencies first'
    });
  }

  return causes;
}

// ── Phase O: Fix plan with score projections ─────────────────────────────────
interface FixStep { title: string; command?: string; scoreGain: number; confidence: number; }

function buildFixPlan(result: AnalysisResult): FixStep[] {
  const steps: FixStep[] = [];
  const dupCount = result.findings.filter((f) => f.category === 'duplication').length;
  const peerCount = result.findings.filter((f) => f.id.startsWith('peer:')).length;
  const unusedCount = result.findings.filter((f) => f.id.startsWith('unused:')).length;
  const secCount = result.findings.filter((f) => f.category === 'security' && f.severity !== 'low').length;

  if (dupCount > 0) {
    const gain = Math.min(20, Math.round(dupCount * 0.8));
    steps.push({ title: 'Deduplicate packages', command: 'npm dedupe', scoreGain: gain, confidence: 80 });
  }
  if (peerCount > 0) {
    const gain = Math.min(18, Math.round(peerCount * 0.6));
    steps.push({ title: 'Align peer dependency versions', command: 'npm install --legacy-peer-deps', scoreGain: gain, confidence: 65 });
  }
  if (unusedCount > 0) {
    const gain = Math.min(10, Math.round(unusedCount * 0.5));
    steps.push({ title: `Remove ${unusedCount} suspected unused direct deps`, scoreGain: gain, confidence: 50 });
  }
  if (secCount > 0) {
    steps.push({ title: `Fix ${secCount} security findings`, command: 'npm audit fix', scoreGain: 8, confidence: 70 });
  }

  return steps;
}

// ── Phase Q: Release readiness ───────────────────────────────────────────────
interface RRCheck { label: string; passed: boolean; reason: string; }
interface ReleaseReadiness { score: number; ready: boolean; checks: RRCheck[]; blocking: string[]; }

function buildReleaseReadiness(result: AnalysisResult): ReleaseReadiness {
  const checks: RRCheck[] = [];
  const blocking: string[] = [];

  const criticals = result.findings.filter((f) => f.severity === 'critical');
  const hasCritical = criticals.length === 0;
  checks.push({ label: 'No critical findings', passed: hasCritical, reason: `${criticals.length} critical finding(s)` });
  if (!hasCritical) blocking.push(`${criticals.length} critical finding(s) must be resolved`);

  const hasPeerIssues = result.findings.filter((f) => f.id.startsWith('peer:') && f.severity === 'high').length;
  const peerOk = hasPeerIssues === 0;
  checks.push({ label: 'Peer deps satisfied', passed: peerOk, reason: `${hasPeerIssues} high-severity peer conflict(s)` });
  if (!peerOk) blocking.push(`${hasPeerIssues} unresolved peer dependency conflict(s)`);

  const secFindings = result.findings.filter((f) => f.category === 'security' && (f.severity === 'high' || f.severity === 'critical'));
  const secOk = secFindings.length === 0;
  checks.push({ label: 'No high security issues', passed: secOk, reason: `${secFindings.length} high/critical vuln(s)` });
  if (!secOk) blocking.push(`${secFindings.length} unpatched high/critical vulnerability/ies`);

  const dupCount = result.findings.filter((f) => f.category === 'duplication').length;
  const dupOk = dupCount < 10;
  checks.push({ label: 'Duplication under control', passed: dupOk, reason: `${dupCount} duplicate families (threshold: 10)` });
  if (!dupOk) blocking.push(`${dupCount} duplicate package families exceeds threshold (10)`);

  const scoreOk = result.score.overall >= 60;
  checks.push({ label: 'Health score ≥ 60', passed: scoreOk, reason: `Score is ${result.score.overall}/100` });
  if (!scoreOk) blocking.push(`Health score ${result.score.overall} is below release threshold (60)`);

  const passed = checks.filter((c) => c.passed).length;
  const score = Math.round((passed / checks.length) * 100);
  const ready = blocking.length === 0;

  return { score, ready, checks, blocking };
}
