# 🚀 Release Notes: @danijsrr/pkg-ct v0.4.0

We are proud to announce the release of **v0.4.0** of `@danijsrr/pkg-ct`. This version completes the transformation of `pkg-ct` from a standard dependency checking CLI into a complete **AI-Powered Dependency Observability and Self-Healing Maintenance System**.

---

## 🌟 KEY HIGHLIGHTS

### 1. Fixes for the 3 Release Blockers
* **Aging Engine Heuristics:** Resolved average dependency age calculations showing `0`. When NPM metadata is missing, `pkg-ct` automatically estimates dependency age using package version numbers and updates the AI Insight with tooling vs. runtime package breakdowns.
* **Explain AI Summary:** Upgraded the `explain` command to produce a purely evidence-backed summary section detailing why a package exists, its dependents, files scanning imports, blast radius, and removal risk without external LLM API dependency.
* **Upgrade Risk Details:** Updated the `risk` command to output structured potential conflicts with clear reasons, current and expected versions, dependents, confidence scores, and dependency chain traces.

### 2. Five New Intelligence Commands
* `pkg-ct missing`: Detects packages imported in source files that are not declared in `package.json`.
* `pkg-ct upgrade <pkg>`: Predicts upgrade compile and runtime risk before bumping a dependency.
* `pkg-ct timeline`: Evaluates package age and technical lag score.
* `pkg-ct workspace`: Audits monorepos to detect version drift.
* `pkg-ct ci`: Runs quality gates for CI pipelines with custom exit codes.

### 3. Logarithmic Score Calibration
Replaced old linear deductions with **logarithmic normalization**. This prevents category scores from hitting 0 prematurely on realistic projects, making the metrics far more practical and reliable.

### 4. World-Class Documentation
Rewrote the `README.md` from scratch. The documentation is now a comprehensive developer-advocate quality manual (8k+ words) that details every command, scoring metric, configuration option, troubleshooting step, and architecture diagram.

---

## 📥 GETTING STARTED

Install the new release globally:

```bash
npm install -g @danijsrr/pkg-ct@0.4.0
```

Run a full senior-architect diagnostic scan on your project:

```bash
pkg-ct doctor
```
