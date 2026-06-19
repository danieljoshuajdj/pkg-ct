# Changelog

All notable changes to `@danijsrr/pkg-ct` are documented here.

---

## [0.4.0] — 2026-06-20

### Summary

0.4.0 transforms pkg-ct from a dependency checker into a full **AI-powered Dependency Intelligence Platform**. Every new feature produces explainable, evidence-backed output. No hallucinated recommendations.

---

### New Commands

#### `pkg-ct missing`
Detects packages imported in source files that are not declared in `package.json`.

- Scans TypeScript, JavaScript, ESM, CJS, Vue, Svelte, Astro files
- Detects: `import`, `export-from`, `import()`, `require()`
- Filters Node built-ins and sub-path imports of declared packages
- Risk classification: `HIGH` (≥5 files) / `MEDIUM` (≥2) / `LOW` (1 file)

#### `pkg-ct upgrade <package[@version]>`
Predicts upgrade risk before you bump a dependency.

- Major version jump detection
- Peer dependency satisfaction check across all graph nodes
- Framework alignment detection (react/react-dom, next/react, nuxt/vue)
- Existing duplication impact analysis
- Risk levels: `LOW` / `MEDIUM` / `HIGH` / `EXTREME`
- All evidence sourced from dependency graph — no network calls, no hallucination

#### `pkg-ct timeline`
Dependency age and technical lag analysis.

- Average dependency age in days and years
- Technical lag score with grade (LOW LAG / MEDIUM LAG / HIGH LAG)
- Packages grouped by age: >1yr / >2yr / >5yr
- Major versions behind count

#### `pkg-ct workspace`
Monorepo workspace dependency intelligence.

- Detects shared dependencies across workspaces
- Version drift detection with risk classification
- Recommendations for version alignment
- Supports npm, pnpm, yarn workspaces

#### `pkg-ct ci`
CI quality gates with structured exit codes.

- `--min-score` threshold (default: 70)
- `--fail-on` severity (default: high)
- Exit codes: `0=PASS`, `1=WARN`, `2=FAIL`
- Suitable for GitHub Actions, GitLab CI, Azure DevOps, Jenkins
- JSON output mode for CI log parsing

---

### Upgraded Commands

#### `pkg-ct explain <package>` — Phase C

New output sections:
- **Role**: `CORE_RUNTIME` / `FRAMEWORK` / `TOOL` / `TRANSITIVE`
- **Why it exists**: Evidence with source file references
- **Dependency chain**: Full transitive chain
- **Direct dependents**: Who uses it in the graph
- **Blast radius**: `NONE` / `LOW` / `MEDIUM` / `HIGH` / `EXTREME` + count
- **Production impact**: `CRITICAL` / `HIGH` / `MEDIUM` / `LOW` / `NONE`
- **Safe removal probability**: % with color coding
- **Upgrade impact**: Risk narrative with actionable next step

#### `pkg-ct doctor` — Phase C/G

New section: `=== Unused Dependencies (Confidence Engine) ===`
- Shows `usage confidence: X%` and `safe removal probability: X%` per package
- Previously invisible confidence scores are now surfaced

#### `pkg-ct health`
- Now uses a **dedicated reporter** (`renderHealthSummary`) — distinct output from `analyze`
- Shows Score Breakdown with per-category explanations
- Highlights Critical/High findings only

---

### Bug Fixes

#### TS2532: `src/health/aging.ts` — Object is possibly undefined (lines 49–53)
```ts
// Before (broken)
const instParts = installed.split('.').map(Number);
if (latParts[0] > instParts[0]) ...

// After (fixed)
const [instMajor = 0, instMinor = 0, instPatch = 0] = installed.split('.').map(Number);
const [latMajor = 0, latMinor = 0, latPatch = 0] = latest.split('.').map(Number);
if (latMajor > instMajor) ...
```
No `@ts-ignore`. No non-null assertions. Pure destructuring with numeric defaults.

#### Missing private helper functions in `src/reporters/terminal.ts`
`scoreBadge`, `bar`, `findingIcon`, `formatFinding`, `bySeverity`, `renderChain` were absent from source (only existed in stale `dist/`). All added.

---

### Score Calibration — Phase A

**Problem**: 22 duplicate families in 447 packages → `duplication: 0/100`. Trust-destroying.

**Fix**: Replaced linear deductions with **logarithmic normalization**.

```
rawSignal    = Σ (severityDeduction × confidence)
logDeduction = ln(1 + rawSignal) × 6.5
weighted     = logDeduction × min(1, categoryWeight)
score        = max(floor, round(100 - weighted))
```

- Category floor: `15` normally → never hits 0 on realistic projects
- Overall floor: `5` absolute minimum
- Updated grade thresholds to match spec: `B=75`, `C=60`, `D=40`

**Expected impact** (447 pkgs, 22 dups, 34 compat issues):

| Category | Before | After |
|---|---|---|
| duplication | 0 | ~54 |
| compatibility | 0 | ~40 |
| maintainability | 0 | ~58 |

---

### Pipeline Identity

All three analyzers now stamp results with a `pipeline` field:
- `scanProject` → `SCAN_PIPELINE`
- `analyzeProject` → `ANALYZE_PIPELINE`
- `doctorProject` → `DOCTOR_PIPELINE`

Set `PKG_CT_DEBUG=1` to see pipeline labels on stderr.

---

### Architecture

#### New files
| File | Purpose |
|---|---|
| `src/scanner/missing-deps.ts` | Phase B: missing dependency scanner |
| `src/risk/upgrade-advisor.ts` | Phase D: upgrade risk advisor |

#### Modified files
| File | Change |
|---|---|
| `src/health/aging.ts` | TS2532 fix |
| `src/health/scoring.ts` | Logarithmic normalization, updated grade ranges |
| `src/core/explain.ts` | Blast radius, production impact, direct dependents |
| `src/types/index.ts` | `pipeline` field on `AnalysisResult`; `blastRadius`, `productionImpact`, `directDependents` on `ExplainResult` |
| `src/core/analyzer.ts` | Pipeline stamps on all three analyzers |
| `src/reporters/terminal.ts` | `renderHealthSummary`, `renderExplain` upgrade, confidence section in doctor, all helper functions |
| `src/cli/index.ts` | 5 new commands: `missing`, `upgrade`, `timeline`, `workspace`, `ci` |
| `src/index.ts` | 2 new exports: `adviseUpgrade`, `detectMissingDependencies` |
| `docs/scoring-rules.md` | Logarithmic formula, grade table, CI gate reference |

---

## [0.3.0] — Previous Release

- Separate `scan` / `analyze` / `doctor` pipelines
- Confidence engine for unused dependency detection
- Safe removal probability (0–100%)
- Roast Engine 2.0
- Blast command
- Production command
- Aging command
- Security command
- AI provider integration (Ollama, OpenAI, Anthropic)
