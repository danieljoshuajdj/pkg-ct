# `@danijsrr/pkg-ct@0.5.1` Accuracy Report

This report documents the accuracy tuning implemented for the `v0.5.1` release to resolve occurrence over-penalization in scoring and ensure realistic, trusted project health summaries.

---

## 🏛️ 1. Problem
On large or heavily nested Node.js projects, a single dependency issue (such as duplicates of a low-level build tool like `esbuild` or transitive peer conflicts) can be repeated many times in the dependency graph. 

Previously, `pkg-ct` deducted points for *every single occurrence* of these findings. This resulted in:
* Highly inflated raw signals and excessive deductions.
* Scores that crashed to the minimum floor even for healthy modern projects with minor duplication chains.
* Distrust from senior developers who found the tool "too loud" and alarmist.

---

## 🛠️ 2. Root Cause
The scoring engine in `src/health/scoring.ts` previously calculated deductions by directly iterating over all findings in a category:
```typescript
const rawSignal = categoryFindings.reduce(
  (sum, finding) => sum + severityDeduction(finding.severity) * finding.confidence,
  0
);
```
If `esbuild` was duplicate 12 times, this summed the penalty 12 times before applying the logarithmic function, heavily skewing the score.

---

## 🔍 3. Research Basis
Modern dependency trees are highly interconnected. In npm/pnpm/yarn monorepos or large web frameworks, transitive modules frequently install matching or duplicate helper versions. 

From an engineering maintenance perspective, resolving version conflicts or updating a package is a **single action** (the root cause), not 12 separate actions. Therefore:
* Health scores should reflect the number of maintenance tasks required, rather than counting each package subtree location.
* Aggregating findings by **Package Family**, **Finding Type**, and **Severity** groups occurrences into their single logical root cause, preventing double-penalization.
* Healthy modern projects should maintain an overall grade of **`70–85`** (Good/Fair) rather than falling to F grades due to repetitive transitive dependencies.

---

## 📂 4. Files Changed

* **[src/health/scoring.ts](./src/health/scoring.ts):** Refactored `scoreFindings` to aggregate category findings into root cause groups before calculating raw severity signals.
* **[src/types/index.ts](./src/types/index.ts):** Imported `Severity` where appropriate.
* **[package.json](./package.json):** Bumped package version to `0.5.1`.

---

## 🧪 5. Tests Added

* **[test/scoring.test.ts](./test/scoring.test.ts):** Added a unit test validating that 12 duplicate findings of the same package family yield the exact same overall deduction as a single finding, verifying the root-cause grouping behavior.

---

## 📊 6. Before vs. After Output Mappings

### Scenario: `esbuild` duplicate 12 times in duplication category

| Metric | Before (v0.5.0) | After (v0.5.1) |
| :--- | :---: | :---: |
| **Deduction Count** | 12 occurrences | 1 root cause group |
| **Raw Signal Points** | $12 \times 7 = 84$ | $1 \times 7 = 7$ |
| **Weighted Category Deduction** | ~29 points | ~13 points |
| **Target Project Category Score** | **`71`** | **`87`** |

---

## 🏁 7. Validation Results
* **`npm run typecheck`:** Passed ✅ (0 errors)
* **`npm run build`:** Passed ✅ (Bundles built successfully)
* **`npm test`:** Passed ✅ (63 unit and integration tests passing successfully)
* **`npm run lint`:** Passed ✅ (0 warnings, 0 errors)
* **`npm pack`:** Passed ✅ (Package bundle compiled)

---

## 🚦 8. Remaining Limitations
* **Package Name Resolution:** Grouping relies on the `packageName` attribute inside the finding. For global config or lockfile findings where `packageName` is omitted, the engine groups by finding ID, treating them as individual platform root causes.
