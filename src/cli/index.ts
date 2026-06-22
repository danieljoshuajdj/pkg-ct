#!/usr/bin/env node
import { cwd, exit } from 'node:process';
import { cac } from 'cac';
import chalk from 'chalk';
import ora from 'ora';
import { analyzeProject, scanProject, doctorProject } from '../core/analyzer.js';
import { explainPackage } from '../core/explain.js';
import { enrichWithAiSummary } from '../ai/index.js';
import { renderReport } from '../reporters/index.js';
import { renderDoctor, renderExplain, renderHealthSummary, renderRoast, renderScanInventory } from '../reporters/terminal.js';
import { predictInstallRisk } from '../risk/predictor.js';
import { runFixes } from '../fixers/fix-engine.js';
import { severityRank } from '../utils/severity.js';
import { calculateBlastRadius } from '../graph/blast.js';
import { classifyProductionPackages } from '../scanner/production.js';
import { calculateAging } from '../health/aging.js';
import { generateSecurityReport } from '../scanner/security.js';
import { detectMissingDependencies } from '../scanner/missing-deps.js';
import { adviseUpgrade } from '../risk/upgrade-advisor.js';
import { loadAiRules, renderAiRulesBanner } from '../config/ai-rules.js';
import { satisfiesPeerRequirement } from '../utils/semver.js';
import type { AnalysisResult, Finding, ReporterOptions } from '../types/index.js';

const cli = cac('pkg-ct');

cli
  .command('scan', 'Scan dependencies and emit a dependency intelligence report')
  .option('--root <path>', 'Project root', { default: cwd() })
  .option('--json', 'Print JSON')
  .option('--markdown', 'Print markdown')
  .option('--html', 'Print HTML')
  .option('--ci', 'Emit CI annotations and enforce configured thresholds')
  .option('--output <file>', 'Write report to file')
  .option('--online-metadata', 'Fetch npm registry metadata with pacote')
  .option('--audit', 'Run npm audit and map vulnerabilities into findings')
  .option('--skip-unused', 'Skip static unused dependency detection')
  .option('--verbose', 'Show more findings')
  .action(async (options) => {
    await withErrors(async () => {
      if (process.env.PKG_CT_DEBUG) process.stderr.write('[pkg-ct] SCAN_PIPELINE\n');
      const result = await runAnalysis('Scanning dependency graph', options, scanProject);
      const report = options.json
        ? JSON.stringify(scanInventory(result), null, 2)
        : options.markdown || options.html || options.ci
          ? await renderReport(result, reporterOptions(options))
          : renderScanInventory(result);
      console.log(report);
      enforceCi(result, options.ci);
    });
  });

cli
  .command('analyze', 'Alias for doctor; run the full dependency intelligence review')
  .option('--root <path>', 'Project root', { default: cwd() })
  .option('--json', 'Print JSON')
  .option('--markdown', 'Print markdown')
  .option('--html', 'Print HTML')
  .option('--ci', 'Emit CI annotations and enforce configured thresholds')
  .option('--output <file>', 'Write report to file')
  .option('--ai', 'Use configured AI provider to summarize deterministic findings')
  .option('--online-metadata', 'Fetch npm registry metadata with pacote')
  .option('--audit', 'Run npm audit and map vulnerabilities into findings')
  .option('--skip-unused', 'Skip static unused dependency detection')
  .option('--verbose', 'Show more findings')
  .action(async (options) => {
    await withErrors(async () => {
      let result = await runAnalysis('Analyzing dependency intelligence', options, analyzeProject);
      if (options.ai) result = await enrichWithAiSummary(result);
      const report = await renderReport(result, reporterOptions(options));
      console.log(report);
      if (result.aiSummary) console.log(`\n${chalk.bold('AI Architect Summary')}\n${result.aiSummary}`);
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
  .option('--audit', 'Run npm audit and map vulnerabilities into findings')
  .option('--skip-unused', 'Skip static unused dependency detection')
  .option('--verbose', 'Show more findings')
  .action(async (options) => {
    await withErrors(async () => {
      let result = await runAnalysis('Running full dependency doctor', options, doctorProject);
      if (options.ai) result = await enrichWithAiSummary(result);
      // Phase S: show ai-rules banner if .ai-rules.json found
      const rules = loadAiRules(options.root ?? cwd());
      const rulesBanner = renderAiRulesBanner(rules);
      if (rulesBanner) console.log(chalk.hex('#8B5CF6')(rulesBanner));
      const report = options.json ? await renderReport(result, reporterOptions(options)) : renderDoctor(result, reporterOptions(options));
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
      const result = await runAnalysis('Calculating dependency health', options, analyzeProject);
      if (options.json) {
        console.log(JSON.stringify(result.score, null, 2));
      } else {
        console.log(renderHealthSummary(result));
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
      const result = await runAnalysis(`Tracing ${packageName}`, options, analyzeProject);
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
      const result = await runAnalysis('Planning fixes', { ...options, noSpinner: true }, analyzeProject);
      const plan = await runFixes(result, {
        root: options.root,
        dryRun: !options.run || options.dryRun,
        interactive: Boolean(options.interactive),
        ci: Boolean(options.ci),
        install: Boolean(options.install)
      });
      console.log(chalk.bold('\nFix Plan'));
      for (const command of plan.commands) console.log(`${chalk.cyan('->')} ${command}`);
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
      const result = await runAnalysis('Preparing roast', options, analyzeProject);
      console.log(renderRoast(result));
    });
  });

cli
  .command('risk <packageSpec>', 'Predict install risks before adding a dependency')
  .option('--root <path>', 'Project root', { default: cwd() })
  .option('--json', 'Print JSON')
  .action(async (packageSpec: string, options) => {
    await withErrors(async () => {
      const result = await runAnalysis(`Predicting install risk for ${packageSpec}`, options, analyzeProject);
      const prediction = predictInstallRisk(packageSpec, result.context, result.graph, result.findings);
      if (options.json) {
        console.log(JSON.stringify(prediction, null, 2));
      } else {
        const divider = chalk.dim('─'.repeat(50));
        const riskColor = prediction.risk === 'high' ? chalk.red :
          prediction.risk === 'medium' ? chalk.yellow : chalk.green;
        console.log('');
        console.log(chalk.bold('━'.repeat(50)));
        console.log(chalk.bold(`  UPGRADE RISK: ${riskColor(prediction.risk.toUpperCase())}  →  ${packageSpec}`));
        console.log(chalk.bold('━'.repeat(50)));
        console.log('');
        if (prediction.warnings.length > 0) {
          console.log(chalk.bold('WARNINGS'), divider);
          for (const w of prediction.warnings) console.log(`  ${chalk.yellow('⚠')} ${w}`);
          console.log('');
        }
        if (prediction.likelyConflicts.length > 0) {
          console.log(chalk.bold('POTENTIAL CONFLICTS'), divider);
          for (const conflict of prediction.likelyConflicts) {
            // Find peer conflict findings for this package
            const peerFindings = result.findings.filter(
              (f: Finding) => f.category === 'compatibility' && (f.packageName === conflict || f.evidence?.some((e: string) => e.includes(conflict)))
            );
            console.log(`  ${chalk.red('[CONFLICT]')} ${chalk.bold(conflict)}`);
            // Reason: describe why from findings or graph
            const peerNode = result.graph.nodes.get((result.graph.byName.get(conflict) ?? [])[0] ?? '');
            if (peerNode?.peerDependencies) {
              for (const [peer, range] of Object.entries(peerNode.peerDependencies).slice(0, 3)) {
                const installedNode = result.graph.byName.get(peer)?.[0];
                const installedVersion = installedNode ? result.graph.nodes.get(installedNode)?.version : undefined;
                if (!installedVersion) {
                  console.log(`    Reason:    Peer dependency missing`);
                  console.log(`    Peer:      ${peer}@${range}`);
                  console.log(`    Current:   none`);
                  console.log(`    Expected:  ${range}`);
                } else if (!satisfiesPeerRequirement(installedVersion, range)) {
                  console.log(`    Reason:    Peer dependency mismatch`);
                  console.log(`    Peer:      ${peer}@${range}`);
                  console.log(`    Current:   ${peer}@${installedVersion}`);
                  console.log(`    Expected:  ${range}`);
                }
              }
            } else if (peerFindings.length > 0) {
              for (const f of peerFindings.slice(0, 2)) {
                console.log(`    Reason:    ${f.title}`);
                for (const e of f.evidence?.slice(0, 2) ?? []) console.log(`    Evidence:  ${e}`);
              }
            }
            // Confidence based on peer data completeness
            const confidence = peerNode?.peerDependencies && Object.keys(peerNode.peerDependencies).length > 0 ? 87 : 65;
            // Count direct dependents for evidence
            const dependentCount = (result.graph.byName.get(conflict) ?? [])
              .map((id) => result.graph.nodes.get(id))
              .filter(Boolean)
              .reduce((sum, n) => sum + (n?.dependents?.length ?? 0), 0);
            if (dependentCount > 0) console.log(`    Evidence:  ${dependentCount} direct dependent(s) in tree`);
            console.log(`    Confidence: ${confidence}%`);
            // Dependency chain
            const chainIds = result.graph.byName.get(conflict) ?? [];
            if (chainIds.length > 0) {
              const chainNode = result.graph.nodes.get(chainIds[0] ?? '');
              if (chainNode && chainNode.dependents && chainNode.dependents.length > 0) {
                const parentId = chainNode.dependents[0];
                const parentNode = parentId ? result.graph.nodes.get(parentId) : undefined;
                if (parentNode) console.log(`    Chain:     ${parentNode.name} → ${conflict}`);
              }
            }
            console.log('');
          }
        } else {
          console.log(chalk.green('  ✅  No conflicts predicted.'));
        }
        console.log(chalk.bold('━'.repeat(50)));
      }
    });
  });

cli
  .command('blast <packageName>', 'Analyze the blast radius of a dependency')
  .option('--root <path>', 'Project root', { default: cwd() })
  .option('--json', 'Print JSON')
  .action(async (packageName: string, options) => {
    await withErrors(async () => {
      const result = await runAnalysis(`Analyzing blast radius of ${packageName}`, options, analyzeProject);
      const blastRadius = calculateBlastRadius(result.graph, packageName);
      if (options.json) {
        console.log(JSON.stringify(blastRadius, null, 2));
      } else {
        console.log(chalk.bold(`\nDependency Blast Radius: ${packageName}`));
        console.log(`Risk Level: ${chalk.bold(blastRadius.riskLevel)}`);
        console.log(`\nDirect dependents (${blastRadius.directDependents.length}):`);
        for (const dep of blastRadius.directDependents) console.log(`  - ${dep}`);
        console.log(`\nTransitive dependents (${blastRadius.transitiveDependents.length}):`);
        for (const dep of blastRadius.transitiveDependents) console.log(`  - ${dep}`);
        console.log(`\nCritical dependents (${blastRadius.criticalDependents.length}):`);
        for (const dep of blastRadius.criticalDependents) console.log(`  - ${dep}`);
      }
    });
  });

cli
  .command('production', 'Classify installed packages by production relevance')
  .option('--root <path>', 'Project root', { default: cwd() })
  .option('--json', 'Print JSON')
  .action(async (options) => {
    await withErrors(async () => {
      const result = await runAnalysis('Analyzing production relevance', options, analyzeProject);
      const classification = classifyProductionPackages(result);
      if (options.json) {
        console.log(JSON.stringify(classification, null, 2));
      } else {
        console.log(chalk.bold('\nPackage Production Relevance'));
        const groups = {
          'Production critical': classification.filter((c) => c.classification === 'Production critical'),
          'Build only': classification.filter((c) => c.classification === 'Build only'),
          'Development only': classification.filter((c) => c.classification === 'Development only'),
          Unknown: classification.filter((c) => c.classification === 'Unknown')
        };
        for (const [key, list] of Object.entries(groups)) {
          console.log(`\n${chalk.bold(key)} (${list.length}):`);
          for (const item of list.slice(0, 15)) {
            console.log(`  - ${item.packageName}@${item.version} ${chalk.dim(`(role: ${item.role})`)}`);
          }
          if (list.length > 15) console.log(`  ... and ${list.length - 15} more`);
        }
      }
    });
  });

cli
  .command('aging', 'Analyze the age of dependencies and technical lag')
  .option('--root <path>', 'Project root', { default: cwd() })
  .option('--json', 'Print JSON')
  .action(async (options) => {
    await withErrors(async () => {
      const runOpts = { onlineMetadata: true, ...options };
      const result = await runAnalysis('Analyzing package aging', runOpts, analyzeProject);
      const aging = calculateAging(result);
      if (options.json) {
        console.log(JSON.stringify(aging, null, 2));
      } else {
        const divider = chalk.dim('─'.repeat(50));
        console.log('');
        console.log(chalk.bold('━'.repeat(50)));
        console.log(chalk.bold('  DEPENDENCY AGING & TECHNICAL LAG'));
        console.log(chalk.bold('━'.repeat(50)));
        console.log('');
        const years = (aging.averageAgeDays / 365).toFixed(1);
        const ageColor = aging.averageAgeDays > 2 * 365 ? chalk.red :
          aging.averageAgeDays > 365 ? chalk.yellow : chalk.green;
        console.log(chalk.bold('AVERAGE DEPENDENCY AGE'), divider);
        console.log(`  ${ageColor(chalk.bold(`${years} years`))} (${aging.averageAgeDays} days)`);
        console.log('');
        const lagLabel = aging.technicalLagScore > 100 ? chalk.red('HIGH') :
          aging.technicalLagScore > 50 ? chalk.yellow('MEDIUM') : chalk.green('LOW');
        console.log(chalk.bold('TECHNICAL LAG'), divider);
        console.log(`  Score: ${aging.technicalLagScore}  Level: ${lagLabel}`);
        console.log('');
        console.log(chalk.bold('PACKAGES OLDER THAN'), divider);
        console.log(`  1 year:  ${aging.olderThan1Year.length}`);
        for (const p of aging.olderThan1Year.slice(0, 6)) console.log(`    ${chalk.dim('-')} ${p}`);
        if (aging.olderThan1Year.length > 6) console.log(`    ${chalk.dim(`... and ${aging.olderThan1Year.length - 6} more`)}`);
        console.log(`  2 years: ${aging.olderThan2Years.length}`);
        for (const p of aging.olderThan2Years.slice(0, 6)) console.log(`    ${chalk.dim('-')} ${p}`);
        if (aging.olderThan2Years.length > 6) console.log(`    ${chalk.dim(`... and ${aging.olderThan2Years.length - 6} more`)}`);
        console.log(`  5 years: ${aging.olderThan5Years.length}`);
        for (const p of aging.olderThan5Years.slice(0, 6)) console.log(`    ${chalk.dim('-')} ${p}`);
        if (aging.olderThan5Years.length > 6) console.log(`    ${chalk.dim(`... and ${aging.olderThan5Years.length - 6} more`)}`);
        console.log('');
        console.log(chalk.hex('#8B5CF6').bold('🧠 AI INSIGHT'), divider);
        console.log(`  ${aging.aiInsight}`);
        console.log('');
        console.log(chalk.bold('━'.repeat(50)));
      }
    });
  });

cli
  .command('security', 'Run detailed supply-chain and security analysis')
  .option('--root <path>', 'Project root', { default: cwd() })
  .option('--json', 'Print JSON')
  .option('--audit', 'Run audit check', { default: true })
  .action(async (options) => {
    await withErrors(async () => {
      const runOpts = { audit: true, ...options };
      const result = await runAnalysis('Running security diagnostics', runOpts, doctorProject);
      const sec = generateSecurityReport(result);
      // Phase P: classify production relevance for each vulnerability
      const prodKeys = new Set(Object.keys(result.context.rootProject.dependencies));
      const classifyProdRelevance = (name: string): string => {
        if (prodKeys.has(name)) return 'Production Critical';
        const node = result.graph.byName.get(name)?.[0];
        if (!node) return 'Unknown';
        const graphNode = result.graph.nodes.get(node);
        return graphNode?.dev ? 'Development Only' : 'Production Reachable';
      };
      if (options.json) {
        console.log(JSON.stringify(sec, null, 2));
      } else {
        const divider = chalk.dim('─'.repeat(50));
        console.log('');
        console.log(chalk.bold('━'.repeat(50)));
        console.log(chalk.bold('  PKG-CT SECURITY REPORT'));
        console.log(chalk.bold('━'.repeat(50)));
        console.log('');

        // Vulnerabilities with production triage
        console.log(chalk.bold('VULNERABILITIES'), divider);
        if (sec.vulnerabilities.length === 0) {
          console.log(chalk.green('  ✅  No vulnerabilities detected.'));
        } else {
          for (const v of sec.vulnerabilities) {
            const rel = classifyProdRelevance(v.name);
            const relColor = rel === 'Production Critical' ? chalk.red :
              rel === 'Production Reachable' ? chalk.yellow :
              rel === 'Development Only' ? chalk.dim : chalk.blue;
            const sevColor = v.severity === 'critical' || v.severity === 'high' ? chalk.red : chalk.yellow;
            console.log(`  ${sevColor(`[${v.severity.toUpperCase()}]`)} ${chalk.bold(v.name)}`);
            console.log(`    ${chalk.dim(v.title)}`);
            console.log(`    Production Relevance: ${relColor(rel)}`);
            const priority = rel === 'Production Critical' ? chalk.red('HIGH') :
              rel === 'Production Reachable' ? chalk.yellow('MEDIUM') : chalk.dim('LOW');
            console.log(`    Priority: ${priority}`);
            if (rel === 'Development Only') {
              console.log(`    ${chalk.dim('→ Defer until runtime issues are resolved.')}`);
            }
          }
        }
        console.log('');

        console.log(chalk.bold('DEPRECATED PACKAGES'), divider);
        if (sec.deprecated.length === 0) {
          console.log(chalk.green('  ✅  No deprecated packages.'));
        } else {
          for (const d of sec.deprecated) console.log(`  ${chalk.yellow('[DEPRECATED]')} ${d}`);
        }
        console.log('');

        console.log(chalk.bold('MAINTAINER INACTIVITY'), divider);
        if (sec.maintainerInactivity.length === 0) {
          console.log(chalk.green('  ✅  All packages have recent releases.'));
        } else {
          for (const m of sec.maintainerInactivity.slice(0, 8)) console.log(`  ${chalk.yellow('!')} ${m}`);
          if (sec.maintainerInactivity.length > 8) console.log(`  ${chalk.dim(`... and ${sec.maintainerInactivity.length - 8} more`)}`);
        }
        console.log('');

        console.log(chalk.bold('ABANDONMENT RISK'), divider);
        if (sec.abandonmentRisk.length === 0) {
          console.log(chalk.green('  ✅  No packages at abandonment risk.'));
        } else {
          for (const a of sec.abandonmentRisk.slice(0, 8)) console.log(`  ${chalk.red('[RISK]')} ${a}`);
          if (sec.abandonmentRisk.length > 8) console.log(`  ${chalk.dim(`... and ${sec.abandonmentRisk.length - 8} more`)}`);
        }
        console.log('');

        console.log(chalk.bold('SUPPLY CHAIN RISKS'), divider);
        if (sec.supplyChainRisk.length === 0) {
          console.log(chalk.green('  ✅  No supply chain risk factors detected.'));
        } else {
          for (const s of sec.supplyChainRisk.slice(0, 8)) console.log(`  ${chalk.red('[SUPPLY]')} ${s}`);
          if (sec.supplyChainRisk.length > 8) console.log(`  ${chalk.dim(`... and ${sec.supplyChainRisk.length - 8} more`)}`);
        }
        console.log('');
        console.log(chalk.bold('━'.repeat(50)));
      }
    });
  });

cli
  .command('missing', 'Detect packages imported in source but missing from package.json')
  .option('--root <path>', 'Project root', { default: cwd() })
  .option('--json', 'Print JSON')
  .action(async (options) => {
    await withErrors(async () => {
      const spinner = shouldSpin(options) ? ora('Scanning for missing dependencies').start() : undefined;
      const context = await runAnalysis('Building context', { ...options, noSpinner: true }, analyzeProject);
      spinner?.stop();
      const missingResult = await detectMissingDependencies(context.context);
      if (options.json) {
        console.log(JSON.stringify(missingResult, null, 2));
        return;
      }
      console.log(chalk.bold('\nMissing Dependencies'));
      console.log(chalk.dim(`Scanned ${missingResult.scannedFiles} source files`));
      if (missingResult.missing.length === 0) {
        console.log(chalk.green('\nNo missing dependencies detected.'));
        return;
      }
      console.log('');
      for (const dep of missingResult.missing) {
        const riskColor = dep.risk === 'HIGH' ? chalk.red : dep.risk === 'MEDIUM' ? chalk.yellow : chalk.blue;
        console.log(`${riskColor(`[${dep.risk}]`)} ${chalk.bold(dep.packageName)}`);
        console.log(`  Referenced in:`);
        for (const file of dep.referencedIn.slice(0, 5)) console.log(`    - ${file}`);
        if (dep.referencedIn.length > 5) console.log(`    ... and ${dep.referencedIn.length - 5} more`);
      }
      console.log(chalk.yellow(`\nAction: Add missing packages to package.json and run your package manager install.`));
    });
  });

cli
  .command('upgrade <packageSpec>', 'Predict upgrade risk before bumping a dependency')
  .option('--root <path>', 'Project root', { default: cwd() })
  .option('--json', 'Print JSON')
  .action(async (packageSpec: string, options) => {
    await withErrors(async () => {
      const [packageName, requestedVersion = 'latest'] = packageSpec.split('@').filter(Boolean) as [string, string?];
      const result = await runAnalysis(`Analyzing upgrade risk for ${packageName}`, options, analyzeProject);
      const advisory = adviseUpgrade(packageName, requestedVersion, result);
      if (options.json) {
        console.log(JSON.stringify(advisory, null, 2));
        return;
      }
      const riskColor = advisory.risk === 'EXTREME' || advisory.risk === 'HIGH' ? chalk.red :
        advisory.risk === 'MEDIUM' ? chalk.yellow : chalk.green;
      console.log(chalk.bold('\nUpgrade Risk Advisor'));
      console.log(`Package:  ${chalk.bold(advisory.packageName)}`);
      console.log(`Current:  ${advisory.currentVersion}`);
      console.log(`Target:   ${advisory.requestedVersion}`);
      console.log(`Risk:     ${riskColor(chalk.bold(advisory.risk))}`);
      console.log('');
      if (advisory.reasons.length > 0) {
        console.log(chalk.bold('Reasons:'));
        for (const reason of advisory.reasons) console.log(`  - ${reason}`);
      }
      if (advisory.potentiallyAffected.length > 0) {
        console.log(chalk.bold('\nPotentially affected:'));
        for (const pkg of advisory.potentiallyAffected.slice(0, 8)) console.log(`  - ${pkg}`);
        if (advisory.potentiallyAffected.length > 8) console.log(`  ... and ${advisory.potentiallyAffected.length - 8} more`);
      }
      console.log(chalk.bold('\nEvidence:'));
      for (const e of advisory.evidence) console.log(`  ${chalk.dim(e)}`);
      console.log('');
      console.log(chalk.bold('Recommendation:'));
      console.log(`  ${advisory.recommendation}`);
    });
  });

cli
  .command('timeline', 'Analyze dependency age and technical lag over time')
  .option('--root <path>', 'Project root', { default: cwd() })
  .option('--json', 'Print JSON')
  .action(async (options) => {
    await withErrors(async () => {
      const runOpts = { onlineMetadata: true, ...options };
      const result = await runAnalysis('Building dependency timeline', runOpts, analyzeProject);
      const aging = calculateAging(result);
      const totalPkgs = result.packageIntelligence.length;
      const majorBehind = result.findings.filter((f: Finding) => f.id.startsWith('outdated:')).length;
      const staleCount = result.findings.filter((f: Finding) => f.id.startsWith('stale:')).length;
      if (options.json) {
        console.log(JSON.stringify({ ...aging, majorBehind, staleCount, totalPackagesWithMetadata: totalPkgs }, null, 2));
        return;
      }
      const lagGrade = aging.technicalLagScore > 100 ? chalk.red('HIGH LAG') :
        aging.technicalLagScore > 50 ? chalk.yellow('MEDIUM LAG') : chalk.green('LOW LAG');
      console.log(chalk.bold('\nDependency Health Timeline'));
      console.log(`Average dependency age: ${chalk.bold(aging.averageAgeDays)} days (${(aging.averageAgeDays / 365).toFixed(1)} years)`);
      console.log(`Technical lag score:    ${aging.technicalLagScore} (${lagGrade})`);
      console.log(`Major versions behind:  ${chalk.bold(String(majorBehind))}`);
      console.log(`Stale packages (2yr+):  ${chalk.bold(String(staleCount))}`);
      console.log('');
      const printGroup = (label: string, list: string[]) => {
        console.log(chalk.bold(`${label} (${list.length}):`));
        for (const p of list.slice(0, 8)) console.log(`  - ${p}`);
        if (list.length > 8) console.log(`  ... and ${list.length - 8} more`);
        if (list.length === 0) console.log('  None detected.');
      };
      printGroup('Older than 1 year', aging.olderThan1Year);
      printGroup('Older than 2 years', aging.olderThan2Years);
      printGroup('Older than 5 years', aging.olderThan5Years);
      if (totalPkgs > 0) {
        const buildToolAgeDays = result.packageIntelligence
          .filter((i) => i.ageDays !== undefined && i.ageDays > 365)
          .length;
        if (buildToolAgeDays > 0) {
          console.log(chalk.dim(`\nAI Insight: Dependency aging is concentrated across ${buildToolAgeDays} package(s) with no release in over a year.`));
        }
      }
    });
  });

cli
  .command('workspace', 'Inspect monorepo workspace dependency health')
  .option('--root <path>', 'Project root', { default: cwd() })
  .option('--json', 'Print JSON')
  .action(async (options) => {
    await withErrors(async () => {
      const result = await runAnalysis('Analyzing workspace dependencies', options, analyzeProject);
      const ctx = result.context;
      if (!ctx.isMonorepo) {
        console.log(chalk.yellow('\nNo workspaces detected. This project does not appear to be a monorepo.'));
        return;
      }
      const driftFindings = result.findings.filter((f: Finding) => f.id.startsWith('workspace-drift:'));
      // Build shared deps map
      const shared = new Map<string, Map<string, string[]>>();
      for (const ws of ctx.workspaces) {
          const deps: Record<string, string> = { ...ws.dependencies, ...ws.devDependencies };
          for (const [name, range] of Object.entries(deps)) {
            const byRange = shared.get(name) ?? new Map<string, string[]>();
            const owners = byRange.get(range) ?? [];
            owners.push(ws.name);
            byRange.set(range, owners);
            shared.set(name, byRange);
          }
      }
      const driftPkgs = [...shared.entries()].filter(([, byRange]) => byRange.size > 1);
      const sharedPkgs = [...shared.entries()].filter(([, byRange]) => {
        const total = [...byRange.values()].reduce((s, a) => s + a.length, 0);
        return total > 1 && byRange.size === 1;
      }).map(([name]) => name);
      if (options.json) {
        console.log(JSON.stringify({ workspaces: ctx.workspaces.length, driftPackages: driftPkgs.length, driftFindings: driftFindings.length }, null, 2));
        return;
      }
      const divider = chalk.dim('─'.repeat(50));
      console.log('');
      console.log(chalk.bold('━'.repeat(50)));
      console.log(chalk.bold('  PKG-CT WORKSPACE INTELLIGENCE'));
      console.log(chalk.bold('━'.repeat(50)));
      console.log('');
      console.log(chalk.bold('WORKSPACES'), divider);
      console.log(`  ${ctx.workspaces.map((w: { name: string }) => w.name).join('  ·  ')}`);
      console.log('');
      console.log(`  Shared dependencies: ${sharedPkgs.slice(0, 8).join(', ')}${sharedPkgs.length > 8 ? ` ... +${sharedPkgs.length - 8}` : ''}`);
      console.log('');
      console.log(chalk.bold(`VERSION DRIFT  (${driftPkgs.length} packages)`), divider);
      for (const [name, byRange] of driftPkgs.slice(0, 10)) {
        const risk = [...byRange.keys()].length > 2 ? chalk.red('[HIGH]') : chalk.yellow('[MEDIUM]');
        console.log(`  ${risk} ${chalk.bold(name)}`);
        for (const [range, owners] of byRange) {
          console.log(`    ${range.padEnd(16)}  →  ${owners.join(', ')}`);
        }
      }
      if (driftPkgs.length === 0) console.log(chalk.green('  ✅  No version drift detected.'));
      console.log('');
      // Phase R: AI Workspace Advice
      console.log(chalk.hex('#8B5CF6').bold('🧠 AI WORKSPACE ADVICE'), divider);
      if (driftPkgs.length > 0) {
        console.log(`  ${chalk.yellow('⚠')} Version drift detected in ${driftPkgs.length} package(s).`);
        for (const [name, byRange] of driftPkgs.slice(0, 3)) {
          const versions = [...byRange.keys()];
          const latest = versions.sort().reverse()[0];
          console.log(`  ${chalk.bold(name)}: detected ${versions.join(' · ')}`);
          console.log(`  ${chalk.cyan('→')} Recommendation: standardize on ${chalk.bold(latest)} across all workspaces.`);
          const affected = [...byRange.values()].flat();
          const savedPkgs = affected.length - 1;
          if (savedPkgs > 0) console.log(`    Estimated duplicate reduction: ${chalk.green(`${savedPkgs} package(s)`)}`);
        }
      } else {
        console.log(chalk.green('  ✅  All workspace dependencies are consistently versioned.'));
      }
      console.log('');
      console.log(chalk.bold('RECOMMENDATION'), divider);
      if (driftPkgs.length > 0) {
        console.log(`  Align ${driftPkgs.slice(0, 3).map(([n]) => n).join(', ')} ranges across workspaces.`);
      } else {
        console.log('  All shared dependencies are consistently versioned.');
      }
      console.log(chalk.bold('━'.repeat(50)));
    });
  });

cli
  .command('ci', 'Run dependency quality gates for CI environments')
  .option('--root <path>', 'Project root', { default: cwd() })
  .option('--min-score <score>', 'Minimum health score (default: 70)', { default: 70 })
  .option('--fail-on <severity>', 'Fail on findings of this severity or above (default: high)', { default: 'high' })
  .option('--audit', 'Run npm audit')
  .option('--json', 'Print JSON')
  .action(async (options) => {
    await withErrors(async () => {
      const result = await runAnalysis('Running CI quality gates', { ...options, ci: true }, analyzeProject);
      const minScore = Number(options.minScore) || 70;
      const failOn: string = String(options.failOn || 'high');
      const severityRankLocal: Record<string, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
      const failOnRank = severityRankLocal[failOn] ?? 3;
      const scorePassed = result.score.overall >= minScore;
      const severityPassed = !result.findings.some(
        (f: { severity: string }) => (severityRankLocal[f.severity] ?? 0) >= failOnRank
      );
      const overallPassed = scorePassed && severityPassed;
      const status = overallPassed ? 'PASS' : (!scorePassed && !severityPassed) ? 'FAIL' : 'WARN';
      if (options.json) {
        console.log(JSON.stringify({
          status,
          score: result.score.overall,
          minScore,
          failOn,
          scorePassed,
          severityPassed,
          findingsCount: result.findings.length
        }, null, 2));
        const exitCode = status === 'PASS' ? 0 : status === 'WARN' ? 1 : 2;
        exit(exitCode);
        return;
      }
      const statusColor = status === 'PASS' ? chalk.green : status === 'WARN' ? chalk.yellow : chalk.red;
      console.log(chalk.bold('\npkg-ct CI Quality Gates'));
      console.log(`Status:     ${statusColor(chalk.bold(status))}`);
      console.log(`Score:      ${result.score.overall}/100 (min: ${minScore}) ${scorePassed ? chalk.green('OK') : chalk.red('FAIL')}`);
      console.log(`Severity:   fail-on=${failOn} ${severityPassed ? chalk.green('OK') : chalk.red('VIOLATIONS FOUND')}`);
      console.log(`Findings:   ${result.findings.length} total`);
      if (!severityPassed) {
        const violations = result.findings.filter(
          (f: Finding) => (severityRankLocal[f.severity] ?? 0) >= failOnRank
        );
        console.log(chalk.bold('\nViolating findings:'));
        for (const f of violations.slice(0, 5)) {
          console.log(`  ${chalk.red(f.severity.toUpperCase())} ${f.title}`);
        }
      }
      const exitCode = status === 'PASS' ? 0 : status === 'WARN' ? 1 : 2;
      exit(exitCode);
    });
  });

cli.help();
cli.version('0.4.0');
cli.parse();

async function runAnalysis(
  message: string,
  options: any,
  runFn: (opts: any) => Promise<AnalysisResult> = analyzeProject
): Promise<AnalysisResult> {
  const spinner = shouldSpin(options) ? ora(message).start() : undefined;
  try {
    const result = await runFn({
      root: options.root ?? cwd(),
      offline: options.offline ?? !options.onlineMetadata,
      onlineMetadata: Boolean(options.onlineMetadata),
      audit: Boolean(options.audit),
      unused: options.skipUnused !== true,
      ci: Boolean(options.ci),
      verbose: Boolean(options.verbose)
    });
    spinner?.stop();
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

function scanInventory(result: Awaited<ReturnType<typeof analyzeProject>>) {
  return {
    packages: result.graph.nodes.size,
    duplicateFamilies: result.findings.filter((finding) => finding.category === 'duplication').length,
    deprecatedPackages: result.findings.filter((finding) => finding.id.startsWith('deprecated:')).length,
    peerDependencyIssues: result.findings.filter((finding) => finding.id.startsWith('peer:')).length,
    installScriptPackages: result.findings.filter((finding) => finding.id.startsWith('lifecycle:')).length,
    nativeBuildRisks: result.findings.filter((finding) => finding.id.startsWith('native:')).length,
    durationMs: result.durationMs
  };
}

function shouldSpin(options: any): boolean {
  return !options.noSpinner && !options.json && !options.ci && !options.markdown && !options.html;
}

async function withErrors(task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`pkg-ct failed: ${message}`));
    exit(1);
  }
}
