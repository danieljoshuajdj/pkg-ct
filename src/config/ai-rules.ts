/**
 * Phase S — AI Learning Rules
 *
 * Loads .ai-rules.json from the project root.
 * Users can teach pkg-ct which packages are always used or
 * should never be suggested for removal.
 *
 * Example .ai-rules.json:
 * {
 *   "alwaysUsed": ["tailwindcss", "@hookform/resolvers"],
 *   "neverSuggestRemoval": ["react", "react-dom"]
 * }
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface AiRules {
  /** Packages that are always considered used — never flagged as unused. */
  alwaysUsed: string[];
  /** Packages that should never appear in removal suggestions. */
  neverSuggestRemoval: string[];
}

const DEFAULT_RULES: AiRules = { alwaysUsed: [], neverSuggestRemoval: [] };

export function loadAiRules(root: string): AiRules {
  const rulePath = join(root, '.ai-rules.json');
  if (!existsSync(rulePath)) return DEFAULT_RULES;
  try {
    const raw = readFileSync(rulePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AiRules>;
    return {
      alwaysUsed: Array.isArray(parsed.alwaysUsed) ? parsed.alwaysUsed : [],
      neverSuggestRemoval: Array.isArray(parsed.neverSuggestRemoval) ? parsed.neverSuggestRemoval : []
    };
  } catch {
    return DEFAULT_RULES;
  }
}

/** Returns true if a package should be excluded from unused / removal analysis. */
export function isProtectedByRules(packageName: string, rules: AiRules): boolean {
  return rules.alwaysUsed.includes(packageName) || rules.neverSuggestRemoval.includes(packageName);
}

/** Render the rules banner for CLI output. */
export function renderAiRulesBanner(rules: AiRules): string | null {
  if (rules.alwaysUsed.length === 0 && rules.neverSuggestRemoval.length === 0) return null;
  const lines = ['\n📚 AI Learning Rules Loaded'];
  if (rules.alwaysUsed.length > 0) {
    lines.push('  Always Used:');
    for (const pkg of rules.alwaysUsed) lines.push(`    ✓ ${pkg}`);
  }
  if (rules.neverSuggestRemoval.length > 0) {
    lines.push('  Protected (never suggest removal):');
    for (const pkg of rules.neverSuggestRemoval) lines.push(`    ✓ ${pkg}`);
  }
  return lines.join('\n');
}
