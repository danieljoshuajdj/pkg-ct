#!/usr/bin/env node
import { cwd, exit } from 'node:process';
import { cac } from 'cac';
import chalk from 'chalk';
import ora from 'ora';
import { analyzeProject } from '../core/analyzer.js';
import { explainPackage } from '../core/explain.js';
import { enrichWithAiSummary } from '../ai/index.js';
import { renderReport } from '../reporters/index.js';
import { renderExplain, renderRoast } from '../reporters/terminal.js';
import { predictInstallRisk } from '../risk/predictor.js';
import { runFixes } from '../fixers/fix-engine.js';
import { severityRank } from '../utils/severity.js';
import type { ReporterOptions } from '../types/index.js';

const cli = cac('depdoctor');

cli
  .command('scan', 'Scan dependencies and emit a dependency intelligence report')
  .option('--root <path>', 'Project root', { default: cwd() })
  .option('--json', 'Print JSON')
  .option('--markdown', 'Print markdown')
  .option('--html', 'Print HTML')
  .option('--ci', 'Emit CI annotations and enforce configured thresholds')
  .option('--output <file>', 'Write report to file')
  .option('--online-metadata', 'Fetch npm registry metadata with pacote')
  .option('--no-offline', 'Allow network-backed metadata')
  .option('--verbose', 'Show more findings')
  .action(async (options) => {
    await withErrors(async () => {
      const result = await runAnalysis('Scanning dependency graph', options);
      const report = await renderReport(result, reporterOptions(options));
      console.log(report);
      enforceCi(result, options.ci);
    });
  });

cli
  .command('doctor', 'Run the flagship senior-architect dependency review')
  .option('--root <path>', 'Project root', { default: cwd() })
  .option('--json', 'Print JSON')
  .option('--markdown', 'Print markdown')
  .option('--html', 'Print HTML')
  .option('--ci', 'Emit CI annotations and enforce configured thresholds')
  .option('--output <file>', 'Write report to file')
  .option('--ai', 'Use configured AI provider to summarize deterministic findings')
  .option('--online-metadata', 'Fetch npm registry metadata with pacote')
  .option('--no-offline', 'Allow network-backed metadata')
  .option('--verbose', 'Show more findings')
  .action(async (options) => {
    await withErrors(async () => {
      let result = await runAnalysis('Running full dependency doctor', options);
      if (options.ai) result = await enrichWithAiSummary(result);
      const report = await renderReport(result, reporterOptions(options));
      console.log(report);
      if (result.aiSummary) console.log(`\n${chalk.bold('AI Architect Summary')}\n${result.aiSummary}`);
      enforceCi(result, options.ci);
    });
  });

cli
  .command('health', 'Print the project health score and scoring explanation')
  .option('--root <path>', 'Project root', { default: cwd() })
  .option('--json', 'Print JSON')
  .option('--ci', 'Enforce configured thresholds')
  .action(async (options) => {
    await withErrors(async () => {
      const result = await runAnalysis('Calculating dependency health', options);
      if (options.json) {
        console.log(JSON.stringify(result.score, null, 2));
      } else {
        console.log(await renderReport({ ...result, findings: result.findings.slice(0, 10) }, { format: 'terminal' }));
      }
      enforceCi(result, options.ci);
    });
  });

cli
  .command('explain <packageName>', 'Explain why a package exists and what it costs')
  .option('--root <path>', 'Project root', { default: cwd() })
  .option('--json', 'Print JSON')
  .action(async (packageName: string, options) => {
    await withErrors(async () => {
      const result = await runAnalysis(`Tracing ${packageName}`, options);
      const explanation = explainPackage(result, packageName);
      console.log(options.json ? JSON.stringify(explanation, null, 2) : renderExplain(explanation));
    });
  });

cli
  .command('fix', 'Generate or run safe dependency maintenance fixes')
  .option('--root <path>', 'Project root', { default: cwd() })
  .option('--dry-run', 'Show commands without running them', { default: true })
  .option('--run', 'Execute safe fix commands')
  .option('--interactive', 'Reserved for interactive fix selection')
  .option('--ci', 'CI-safe mode; never mutates files')
  .option('--install', 'Run package manager install after fixes')
  .action(async (options) => {
    await withErrors(async () => {
      const result = await runAnalysis('Planning fixes', options);
      const plan = await runFixes(result, {
        root: options.root,
        dryRun: !options.run || options.dryRun,
        interactive: Boolean(options.interactive),
        ci: Boolean(options.ci),
        install: Boolean(options.install)
      });
      console.log(chalk.bold('\nFix Plan'));
      for (const command of plan.commands) console.log(`${chalk.cyan('→')} ${command}`);
      if (plan.commands.length === 0) console.log(chalk.green('No automatic fixes are needed.'));
      if (plan.executed.length > 0) console.log(chalk.green(`Executed ${plan.executed.length} command(s).`));
      if (plan.skipped.length > 0) console.log(chalk.dim('Dry run: no files were changed.'));
    });
  });

cli
  .command('roast', 'Generate a humorous but accurate shareable dependency report')
  .option('--root <path>', 'Project root', { default: cwd() })
  .action(async (options) => {
    await withErrors(async () => {
      const result = await runAnalysis('Preparing roast', options);
      console.log(renderRoast(result));
    });
  });

cli
  .command('risk <packageSpec>', 'Predict install risks before adding a dependency')
  .option('--root <path>', 'Project root', { default: cwd() })
  .option('--json', 'Print JSON')
  .action(async (packageSpec: string, options) => {
    await withErrors(async () => {
      const result = await runAnalysis(`Predicting install risk for ${packageSpec}`, options);
      const prediction = predictInstallRisk(packageSpec, result.context, result.graph, result.findings);
      if (options.json) {
        console.log(JSON.stringify(prediction, null, 2));
      } else {
        console.log(chalk.bold(`\nInstall Risk: ${prediction.risk.toUpperCase()}`));
        for (const warning of prediction.warnings) console.log(`${chalk.yellow('!')} ${warning}`);
        for (const conflict of prediction.likelyConflicts) console.log(`${chalk.red('×')} Likely conflict: ${conflict}`);
      }
    });
  });

cli.help();
cli.version('0.1.0');
cli.parse();

async function runAnalysis(message: string, options: any) {
  const spinner = shouldSpin(options) ? ora(message).start() : undefined;
  try {
    const result = await analyzeProject({
      root: options.root ?? cwd(),
      offline: options.offline ?? !options.onlineMetadata,
      onlineMetadata: Boolean(options.onlineMetadata),
      ci: Boolean(options.ci),
      verbose: Boolean(options.verbose)
    });
    spinner?.succeed(message);
    return result;
  } catch (error) {
    spinner?.fail(message);
    throw error;
  }
}

function reporterOptions(options: any): ReporterOptions {
  return {
    format: options.json
      ? 'json'
      : options.markdown
        ? 'markdown'
        : options.html
          ? 'html'
          : options.ci
            ? 'ci'
            : 'terminal',
    output: options.output,
    ci: Boolean(options.ci),
    verbose: Boolean(options.verbose)
  };
}

function enforceCi(result: Awaited<ReturnType<typeof analyzeProject>>, ci?: boolean): void {
  if (!ci) return;
  const threshold = result.context.config.ci.minScore;
  const failOn = result.context.config.ci.failOn;
  const violatesSeverity = result.findings.some(
    (finding) => severityRank[finding.severity] >= severityRank[failOn]
  );
  if (result.score.overall < threshold || violatesSeverity) exit(1);
}

function shouldSpin(options: any): boolean {
  return !options.json && !options.ci && !options.markdown && !options.html;
}

async function withErrors(task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`depdoctor failed: ${message}`));
    exit(1);
  }
}
