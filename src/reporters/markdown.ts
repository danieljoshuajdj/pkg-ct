import type { AnalysisResult } from '../types/index.js';

export function renderMarkdown(result: AnalysisResult): string {
  const lines = [
    '# pkgdoctor report',
    '',
    `Generated: ${result.generatedAt}`,
    `Health score: **${result.score.overall}/100 (${result.score.grade})**`,
    '',
    '## Findings',
    ''
  ];

  if (result.findings.length === 0) {
    lines.push('No material findings detected.');
  } else {
    for (const finding of result.findings) {
      lines.push(`### ${finding.title}`);
      lines.push('');
      lines.push(`- Severity: ${finding.severity}`);
      lines.push(`- Category: ${finding.category}`);
      if (finding.packageName) lines.push(`- Package: ${finding.packageName}`);
      lines.push(`- Recommendation: ${finding.recommendation}`);
      lines.push('');
    }
  }

  lines.push('## Remediation');
  for (const plan of result.remediation) {
    lines.push(`- **${plan.title}**: ${plan.rationale}`);
  }

  return lines.join('\n');
}
