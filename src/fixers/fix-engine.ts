import { execa } from 'execa';
import type { AnalysisResult, FixAction, FixOptions, RemediationPlan } from '../types/index.js';

export interface FixPlanResult {
  plans: RemediationPlan[];
  commands: string[];
  executed: string[];
  skipped: string[];
}

export function createFixPlan(result: AnalysisResult): RemediationPlan[] {
  const plans = new Map<string, RemediationPlan>();
  for (const finding of result.findings) {
    if (!finding.fix) continue;
    const key = `${finding.fix.type}:${finding.packageName ?? finding.id}`;
    const current = plans.get(key);
    if (current) {
      current.actions.push(finding.fix);
      continue;
    }
    plans.set(key, {
      id: key,
      title: finding.fix.title,
      priority: priorityFor(finding.severity),
      difficulty: finding.fix.safe ? 'easy' : 'medium',
      impact: finding.severity === 'critical' || finding.severity === 'high' ? 'high' : 'medium',
      actions: [finding.fix],
      rationale: finding.recommendation
    });
  }
  return [...plans.values()].sort((a, b) => b.priority - a.priority);
}

export async function runFixes(result: AnalysisResult, options: FixOptions): Promise<FixPlanResult> {
  const plans = createFixPlan(result);
  const commands = unique(plans.flatMap((plan) => plan.actions.flatMap((action) => selectCommands(action, result))));
  const executed: string[] = [];
  const skipped: string[] = [];

  if (options.dryRun || options.ci) {
    return { plans, commands, executed, skipped: commands };
  }

  for (const command of commands) {
    const [file, ...args] = command.split(' ');
    if (!file) continue;
    await execa(file, args, { cwd: options.root, stdio: 'inherit', shell: true });
    executed.push(command);
  }

  if (options.install && !commands.some((command) => / install$| install /.test(command))) {
    const installCommand = installFor(result.context.packageManager);
    const [file, ...args] = installCommand.split(' ');
    if (!file) return { plans, commands, executed, skipped };
    await execa(file, args, { cwd: options.root, stdio: 'inherit', shell: true });
    executed.push(installCommand);
  }

  return { plans, commands, executed, skipped };
}

function selectCommands(action: FixAction, result: AnalysisResult): string[] {
  if (action.type === 'dedupe') return [dedupeFor(result.context.packageManager)];
  return action.commands.slice(0, 1);
}

function dedupeFor(manager: string): string {
  if (manager === 'pnpm') return 'pnpm dedupe';
  if (manager === 'yarn') return 'yarn dedupe';
  return 'npm dedupe';
}

function installFor(manager: string): string {
  if (manager === 'pnpm') return 'pnpm install';
  if (manager === 'yarn') return 'yarn install';
  if (manager === 'bun') return 'bun install';
  return 'npm install';
}

function priorityFor(severity: string): number {
  return { critical: 100, high: 80, medium: 50, low: 20, info: 5 }[severity] ?? 10;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
