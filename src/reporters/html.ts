import { renderJson } from './json.js';
import type { AnalysisResult } from '../types/index.js';

export function renderHtml(result: AnalysisResult): string {
  const data = renderJson(result).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>depdoctor report</title>
  <style>
    body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; margin: 0; color: #14171a; background: #f6f8fa; }
    main { max-width: 1040px; margin: 0 auto; padding: 32px; }
    h1 { font-size: 32px; margin-bottom: 4px; }
    .score { font-size: 56px; font-weight: 800; margin: 24px 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
    .card { background: white; border: 1px solid #d8dee4; border-radius: 8px; padding: 16px; }
    .sev-high, .sev-critical { color: #cf222e; }
    .sev-medium { color: #9a6700; }
    code { background: #eef1f4; padding: 2px 4px; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>depdoctor</h1>
    <p>Dependency intelligence report generated ${result.generatedAt}</p>
    <div class="score">${result.score.overall}/100</div>
    <section class="grid">
      ${result.score.breakdown
        .map((item) => `<article class="card"><strong>${item.category}</strong><p>${item.score}/100</p><p>${item.explanation}</p></article>`)
        .join('')}
    </section>
    <h2>Findings</h2>
    ${result.findings
      .map(
        (finding) =>
          `<article class="card"><h3 class="sev-${finding.severity}">${finding.title}</h3><p>${finding.description}</p><p><code>${finding.category}</code> <code>${finding.severity}</code></p><p>${finding.recommendation}</p></article>`
      )
      .join('')}
  </main>
  <script type="application/json" id="doctor-data">${data}</script>
</body>
</html>`;
}
