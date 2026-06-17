import chalk from 'chalk';
import type { AnalysisResult, ExplainResult, Finding, ReporterOptions } from '../types/index.js';
import { formatBytes } from '../utils/bytes.js';

const icon = {
  ok: '✓',
  warn: '!',
  fail: '×',
  info: 'i'
};

export function renderTerminal(result: AnalysisResult, options: ReporterOptions = {}): string {
  const lines: string[] = [];
  lines.push(chalk.bold('\ndepdoctor'));
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
        `${chalk.cyan('→')} ${chalk.bold(plan.title)} ${chalk.dim(`impact:${plan.impact} difficulty:${plan.difficulty}`)}`
      );
      if (plan.actions[0]?.commands[0]) lines.push(chalk.dim(`  ${plan.actions[0].commands[0]}`));
    }
  }

  return lines.join('\n');
}

export function renderExplain(explain: ExplainResult): string {
  const lines: string[] = [];
  lines.push(chalk.bold(`\n${explain.packageName} dependency explanation`));

  if (explain.nodes.length === 0) {
    lines.push(chalk.yellow(`No installed or declared package named ${explain.packageName} was found.`));
    return lines.join('\n');
  }

  lines.push('');
  lines.push(chalk.bold('Why it exists'));
  for (const chain of explain.chains.slice(0, 5)) {
    lines.push(renderChain(chain.map((node) => `${node.name}@${node.version}`)));
  }

  lines.push('');
  lines.push(chalk.bold('Impact'));
  lines.push(`- ${formatBytes(explain.installImpactBytes)} estimated install footprint`);
  lines.push(`- duplicated ${explain.duplicates.length > 0 ? `${explain.duplicates.length} times` : '0 times'}`);
  lines.push(`- safe removal probability: ${explain.safeRemovalProbability}`);

  if (explain.findings.length > 0) {
    lines.push('');
    lines.push(chalk.bold('Risks'));
    for (const finding of explain.findings.slice(0, 5)) lines.push(formatFinding(finding));
  }

  lines.push('');
  lines.push(chalk.bold('Alternatives'));
  lines.push(explain.alternatives.map((item) => `- ${item}`).join('\n'));
  return lines.join('\n');
}

export function renderRoast(result: AnalysisResult): string {
  const duplicates = result.findings.filter((finding) => finding.category === 'duplication').length;
  const deprecated = result.findings.filter((finding) => finding.id.startsWith('deprecated:')).length;
  const native = result.findings.filter((finding) => finding.id.startsWith('native:')).length;
  const lifecycle = result.findings.filter((finding) => finding.id.startsWith('lifecycle:')).length;
  const nodeCount = result.graph.nodes.size;

  const lines = [
    chalk.bold('\nDependency Roast'),
    `Your project has ${chalk.bold(String(nodeCount))} packages, which is either engineering or sedimentary geology.`,
    duplicates
      ? `${duplicates} duplicate package family issue(s). The lockfile is doing jazz improvisation.`
      : 'No duplicate families. Suspiciously disciplined. Respect.',
    deprecated
      ? `${deprecated} deprecated package(s). Some of this dependency tree remembers Internet Explorer fondly.`
      : 'No deprecated packages surfaced. The past has been kept at a polite distance.',
    native
      ? `${native} native install risk(s). CI will be fine as long as every machine owns a tiny compiler shrine.`
      : 'No native build drama detected. Your containers may sleep tonight.',
    lifecycle
      ? `${lifecycle} install script package(s). The install phase has side quests.`
      : 'No install lifecycle surprises. Refreshing, frankly.',
    `Health score: ${result.score.overall}/100. ${roastVerdict(result.score.overall)}`
  ];
  return lines.join('\n');
}

function formatFinding(finding: Finding): string {
  const color = finding.severity === 'critical' || finding.severity === 'high' ? chalk.red : finding.severity === 'medium' ? chalk.yellow : chalk.gray;
  const marker = finding.severity === 'critical' || finding.severity === 'high' ? icon.fail : icon.warn;
  return `${color(marker)} ${chalk.bold(finding.title)} ${chalk.dim(`[${finding.category}/${finding.severity}]`)}\n  ${finding.recommendation}`;
}

function renderChain(parts: string[]): string {
  return parts.map((part, index) => `${'  '.repeat(index)}${index === 0 ? '' : '└── '}${part}`).join('\n');
}

function scoreBadge(score: number): string {
  if (score >= 85) return chalk.green(icon.ok);
  if (score >= 70) return chalk.yellow(icon.warn);
  return chalk.red(icon.fail);
}

function bar(score: number): string {
  const width = 18;
  const filled = Math.round((score / 100) * width);
  const content = '█'.repeat(filled) + '░'.repeat(width - filled);
  return score >= 80 ? chalk.green(content) : score >= 60 ? chalk.yellow(content) : chalk.red(content);
}

function bySeverity(a: Finding, b: Finding): number {
  const rank = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
  return rank[b.severity] - rank[a.severity];
}

function roastVerdict(score: number): string {
  if (score >= 90) return 'Annoyingly healthy.';
  if (score >= 75) return 'Mostly fine, with a few dependencies wearing fake mustaches.';
  if (score >= 60) return 'Stable enough to ship, chaotic enough to deserve tea.';
  return 'A senior engineer should sit with this tree and speak gently but firmly.';
}
