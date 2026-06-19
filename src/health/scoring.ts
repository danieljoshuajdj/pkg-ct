import type { AnalysisResult, Finding, FindingCategory, HealthScore, RequiredDoctorConfig } from '../types/index.js';
import { severityDeduction } from '../utils/severity.js';

const categories: FindingCategory[] = [
  'hygiene',
  'security',
  'freshness',
  'duplication',
  'maintainability',
  'install-performance',
  'runtime-impact',
  'bundle-impact',
  'compatibility'
];

export function scoreFindings(findings: Finding[], config: RequiredDoctorConfig): HealthScore {
  const breakdown = categories.map((category) => {
    const categoryFindings = findings.filter((finding) => finding.category === category);

    if (categoryFindings.length === 0) {
      return {
        category,
        score: 100,
        weight: config.scoring[category],
        deductions: 0,
        explanation: 'No material issues detected.'
      };
    }

    // Weighted severity sum (raw signal)
    const rawSignal = categoryFindings.reduce(
      (sum, finding) => sum + severityDeduction(finding.severity) * finding.confidence,
      0
    );

    // Logarithmic normalization: dampens large finding counts
    // log(1 + signal) grows fast at first then flattens — fair for real projects
    // Sensitivity constant: tune so that signal=14 (1 high finding) ≈ 15pts deduction
    const SENSITIVITY = 6.5;
    const logDeduction = Math.log1p(rawSignal) * SENSITIVITY;

    // Apply category weight as a multiplier on top of log deduction
    const weight = config.scoring[category];
    const weightedDeduction = logDeduction * Math.min(1, weight);

    // Category floor: 15 ensures no category hits 0 on realistic projects
    // Only a flood of critical findings breaks through the floor
    const CATEGORY_FLOOR = 15;
    const criticalCount = categoryFindings.filter((f) => f.severity === 'critical').length;
    const floor = criticalCount >= 5 ? 5 : criticalCount >= 2 ? 10 : CATEGORY_FLOOR;

    const score = Math.max(floor, Math.round(100 - weightedDeduction));

    return {
      category,
      score,
      weight,
      deductions: Math.round(weightedDeduction),
      explanation: `${categoryFindings.length} issue(s) reduced this category score.`
    };
  });

  const totalWeight = breakdown.reduce((sum, item) => sum + item.weight, 0);
  const overall = Math.max(
    5,
    Math.round(breakdown.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight)
  );

  return {
    overall,
    breakdown,
    grade: overall >= 90 ? 'A' : overall >= 75 ? 'B' : overall >= 60 ? 'C' : overall >= 40 ? 'D' : 'F'
  };
}


export function summarizeProblems(result: AnalysisResult): string[] {
  const counts = new Map<string, number>();
  for (const finding of result.findings) {
    const key = finding.title.replace(/ .*/, '');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => `${count} ${name.toLowerCase()} issue(s)`);
}
