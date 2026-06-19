# Scoring & Calibration Rules

This document describes the scoring algorithms, grade thresholds, and calibration decisions used in `@danijsrr/pkg-ct` version `0.3.0+`.

---

## 1. Overall Health Score

The health score ranges from `5` to `100` and is graded as follows:

| Grade | Range | Label |
|---|---|---|
| A | 90–100 | Excellent |
| B | 75–89 | Good |
| C | 60–74 | Fair |
| D | 40–59 | Needs Attention |
| F | 5–39 | High Risk |

> **Design principle**: A score of `0` is never emitted on a real project. Even a project with 22 duplicate families and 34 compatibility issues should not read `duplication: 0/100` — that destroys trust. The floor ensures actionable, human-readable output.

---

## 2. Logarithmic Deduction Model (v0.3.0+)

Previous versions used linear deductions which produced `0/100` scores on real projects with moderate finding counts. The new model uses **logarithmic normalization**.

### Formula

```
rawSignal     = Σ (severityDeduction(finding) × finding.confidence)
logDeduction  = ln(1 + rawSignal) × SENSITIVITY
weightedDeduction = logDeduction × min(1, categoryWeight)
score         = max(floor, round(100 - weightedDeduction))
```

Where:
- `SENSITIVITY = 6.5` — tuned so 1 high-severity finding (signal=14) ≈ 15-point deduction
- `floor = 15` for normal projects; `10` if ≥2 critical findings; `5` if ≥5 critical findings
- Overall score floor: `5`

### Severity Deductions

| Severity | Raw Signal |
|---|---|
| info | 1 |
| low | 3 |
| medium | 7 |
| high | 14 |
| critical | 24 |

### Example Calibrations

| Scenario | Finding Count | Old Score | New Score |
|---|---|---|---|
| 22 duplicate families (medium) | 22 | 0 | ~54 |
| 34 compatibility issues (high) | 34 | 0 | ~40 |
| 1 critical security finding | 1 | ~76 | ~72 |
| 0 findings | 0 | 100 | 100 |

### Why Logarithmic?

`log(1 + x)` grows fast for small `x` (first finding matters a lot) and flattens for large `x` (the 30th duplicate family matters less than the 1st). This mirrors how engineers actually perceive dependency risk.

---

## 3. Category Weights

| Category | Default Weight |
|---|---|
| security | 1.5 |
| compatibility | 1.3 |
| maintainability | 1.2 |
| hygiene | 1.0 |
| duplication | 1.0 |
| install-performance | 1.0 |
| freshness | 0.9 |
| runtime-impact | 0.8 |
| bundle-impact | 0.8 |

---

## 4. Package Usage Confidence Model

| Evidence Type | Confidence Score |
|---|---|
| Direct source import (`import`/`require`) | 100 |
| Config file reference (vite.config, tailwind, eslint, etc.) | 90 |
| `package.json` scripts invocation | 80 |
| CI workflow reference (`.github/workflows`) | 70 |
| Known framework package (react, next, vue, etc.) | 60 |
| Weak evidence (plugin/preset/loader naming, @types/) | 40 |
| No evidence found | 20 |

Packages with confidence `< 30` are flagged as low-confidence and surfaced in the **Unused Dependencies** section of `doctor`.

---

## 5. Safe Removal Probability

| Condition | Probability |
|---|---|
| Direct source import (confidence=100) | 1% — never remove |
| Config reference (confidence=90) | 5% |
| Script reference (confidence=80) | 8% |
| CI reference (confidence=70) | 12% |
| Known framework (confidence=60) | 15% |
| Prod dep, no evidence | 50% |
| Dev dep, no evidence | 95% |
| Has transitive dependents | ≤25% (capped) |
| Core runtime (react, react-dom) | 2% — never remove |

---

## 6. CI Quality Gates

`pkg-ct ci` returns one of three statuses:

| Status | Exit Code | Meaning |
|---|---|---|
| PASS | 0 | Score ≥ minScore AND no findings above failOn severity |
| WARN | 1 | One condition met but not both |
| FAIL | 2 | Both score below threshold AND severity violations found |

Default thresholds: `--min-score 70 --fail-on high`
