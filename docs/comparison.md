# Feature Comparison: pkg-ct vs npm audit vs depcheck vs knip

> Version: pkg-ct **0.4.0** | Last updated: 2026-06-20

---

## Capability Matrix

| Feature | pkg-ct 0.4.0 | npm audit | depcheck | knip |
|---|:---:|:---:|:---:|:---:|
| **Security & Audit** | | | | |
| CVE vulnerability detection | ✅ | ✅ | ❌ | ❌ |
| Supply chain risk analysis | ✅ | ❌ | ❌ | ❌ |
| Maintainer inactivity detection | ✅ | ❌ | ❌ | ❌ |
| Abandonment risk scoring | ✅ | ❌ | ❌ | ❌ |
| **Dependency Intelligence** | | | | |
| Unused dependency detection | ✅ | ❌ | ✅ | ✅ |
| Usage confidence scoring (0–100%) | ✅ | ❌ | ❌ | ❌ |
| Safe removal probability | ✅ | ❌ | ❌ | ❌ |
| Missing dependency detection | ✅ | ❌ | ✅ | ✅ |
| Duplicate package families | ✅ | ❌ | ❌ | ❌ |
| Peer dependency violations | ✅ | ✅ | ❌ | ❌ |
| **Production Awareness** | | | | |
| Production vs dev classification | ✅ | ❌ | ❌ | ❌ |
| Production exposure scoring | ✅ | ❌ | ❌ | ❌ |
| Runtime impact analysis | ✅ | ❌ | ❌ | ❌ |
| **Upgrade Intelligence** | | | | |
| Upgrade risk prediction | ✅ | ❌ | ❌ | ❌ |
| Major version jump detection | ✅ | ❌ | ❌ | ❌ |
| Peer satisfaction pre-check | ✅ | ❌ | ❌ | ❌ |
| Framework alignment check | ✅ | ❌ | ❌ | ❌ |
| **Explainability** | | | | |
| Per-package explain command | ✅ | ❌ | ❌ | ❌ |
| Blast radius analysis (BFS graph) | ✅ | ❌ | ❌ | ❌ |
| Dependency chain tracing | ✅ | ❌ | ❌ | ❌ |
| Evidence-backed recommendations | ✅ | ❌ | ❌ | ❌ |
| Direct dependents list | ✅ | ❌ | ❌ | ❌ |
| **Health Scoring** | | | | |
| Overall health score (0–100) | ✅ | ❌ | ❌ | ❌ |
| Per-category breakdown | ✅ | ❌ | ❌ | ❌ |
| Logarithmic calibration (no 0/100) | ✅ | ❌ | ❌ | ❌ |
| Grade: A / B / C / D / F | ✅ | ❌ | ❌ | ❌ |
| **Workspace / Monorepo** | | | | |
| Workspace detection | ✅ | ❌ | ❌ | ✅ |
| Version drift detection | ✅ | ❌ | ❌ | ❌ |
| Cross-workspace risk analysis | ✅ | ❌ | ❌ | ❌ |
| **Timeline / Aging** | | | | |
| Dependency age analysis | ✅ | ❌ | ❌ | ❌ |
| Technical lag scoring | ✅ | ❌ | ❌ | ❌ |
| Stale package detection | ✅ | ❌ | ❌ | ❌ |
| **CI Integration** | | | | |
| CI quality gates (PASS/WARN/FAIL) | ✅ | ✅ (exit 1) | ❌ | ❌ |
| Configurable score threshold | ✅ | ❌ | ❌ | ❌ |
| Configurable severity threshold | ✅ | ✅ | ❌ | ❌ |
| Exit codes: 0/1/2 | ✅ | ❌ | ❌ | ❌ |
| GitHub Actions support | ✅ | ✅ | ❌ | ❌ |
| **AI & Summarization** | | | | |
| AI-powered summaries | ✅ | ❌ | ❌ | ❌ |
| Evidence-anchored AI (no hallucination) | ✅ | ❌ | ❌ | ❌ |
| Multi-provider: Ollama/OpenAI/Anthropic | ✅ | ❌ | ❌ | ❌ |
| **Output Formats** | | | | |
| Terminal (colored) | ✅ | ✅ | ✅ | ✅ |
| JSON | ✅ | ✅ | ✅ | ✅ |
| Markdown | ✅ | ❌ | ❌ | ❌ |
| HTML | ✅ | ❌ | ❌ | ❌ |

---

## Focus Differentiator

| Dimension | pkg-ct 0.4.0 | npm audit | depcheck | knip |
|---|---|---|---|---|
| **Primary focus** | Dependency Intelligence Platform | Security only | Unused deps only | Dead code + unused |
| **Production awareness** | Deep | None | None | None |
| **Upgrade guidance** | Evidence-based risk analysis | None | None | None |
| **Explainability** | Full: blast radius, role, chains, confidence | None | None | None |
| **Scoring** | Logarithmic health score, grade | Exit code only | None | None |
| **AI integration** | Grounded, evidence-anchored | None | None | None |
| **Trust model** | All recommendations cite concrete findings | Vuln database | Heuristic | Static analysis |

---

## Key Differentiators (pkg-ct only)

1. **Usage Confidence Model** — Not just "is it imported?" but *how confidently* (0–100%) with evidence sources (source, config, scripts, CI, framework)
2. **Safe Removal Probability** — `0–100%` before suggesting removal. Never removes without evidence
3. **Blast Radius BFS** — Graph traversal to count all packages affected by removal
4. **Upgrade Risk Advisor** — Predicts peer conflicts and breaking changes before you run `npm install`
5. **Logarithmic Score Calibration** — Real projects with 22 duplicates show `54/100`, not `0/100`
6. **Production Exposure** — Classifies which packages actually reach production runtime vs. build-only
7. **Evidence-anchored AI** — AI never reads `package.json` directly; receives only structured analysis results
