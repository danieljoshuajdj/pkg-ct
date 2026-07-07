# Changelog

All notable changes to `@danijsrr/pkg-ct` are documented here.

## 0.6.0 - 2026-07-08

### Highlights

- Production polish sprint for repository trust, npm presentation, GitHub
  community readiness, documentation architecture, and discoverability.
- README rewritten as a professional landing page for dependency analysis,
  dependency intelligence, dependency health, and package diagnostics.
- Documentation split into focused command and concept pages.

### Improvements

- Optimized `package.json` metadata: description, keywords, homepage,
  repository, bugs, author, funding, published files, and repository URL.
- Added community health files: security policy, support guide, code of conduct,
  issue forms, pull request template, discussion template, funding metadata, and
  MIT license file.
- Added docs for installation, quick start, scan, analyze, health, risk, blast,
  production, aging, workspace, roadmap, and contributor guidance.
- Cleaned command documentation to match the current CLI and avoid unsupported
  claims.

### Bug fixes

- Removed stale documentation wording that implied unsupported AST-level
  behavior.
- Replaced garbled terminal glyph examples with plain text examples that render
  reliably on GitHub, npm, and CI logs.

### Documentation

- Added cross-links between README, command docs, concept docs, support,
  security, contributing, roadmap, and benchmarks.
- Added official-source references in the production audit.
- Added release notes for v0.5.0, v0.5.1, and v0.6.0.

### Internal changes

- No new CLI commands.
- No architecture redesign.
- No intentional breaking API changes.

### Upgrade notes

- Package metadata now advertises the canonical repository:
  `https://github.com/danieljoshuajdj/danijsrr-pkg-ct`.
- The minimum Node.js engine remains `>=20.11.0`.

## 0.5.1 - 2026-07-08

### Highlights

- Accuracy, trust, and stability sprint focused on dependency intelligence
  correctness.
- Duplicate detection became SemVer-distance aware.
- Confidence, explain, security, aging, production classification, and release
  readiness were recalibrated around explicit evidence.

### Improvements

- Duplicate findings distinguish patch/minor drift from major-line splits.
- Release readiness uses a scalable, risk-adjusted duplicate threshold.
- Explain output includes direct declaration, source evidence, upgrade risk
  evidence, safe-removal evidence, and production evidence.
- Source-usage confidence now combines independent evidence types such as
  static imports, dynamic imports, runtime requires, config references, scripts,
  workspace declarations, peers, and build plugins.
- Security triage separates advisory severity, reachability, production
  relevance, priority, and unknown exploitability.
- Aging analysis no longer infers age from SemVer and distinguishes old
  maintained, old inactive, long-term stable, deprecated, archived, old
  unverified, and unknown states.
- Production classification gained additional roles for parsers, AST helpers,
  URL libraries, file filters, terminal UI packages, HMR runtimes, and build
  tools.

### Bug fixes

- Direct manifest ownership is no longer treated as transitive dependency
  impact when calculating safe-removal probability.
- Dependency bloat findings include introducer and transitive-reference
  evidence.
- Root-cause clustering reduces repeated symptoms in doctor output.

### Documentation

- Updated scoring, explain, and security documentation to match actual
  behavior.
- Added tests covering confidence, duplicate severity, explain output, security
  prioritization, root-cause clustering, install impact, and aging realism.

### Upgrade notes

- Output is more conservative where evidence is unavailable. Unknown is now
  preferred over guessed classification.

## 0.5.0 - 2026-06-22

### Highlights

- Expanded dependency intelligence across scan, analyze, doctor, explain,
  roast, blast, production, aging, security, health, risk, and workspace
  workflows.
- Added release-gate validation for typecheck, build, tests, lint, and package
  creation.

### Improvements

- Improved health scoring calibration.
- Added richer terminal reports and release-readiness sections.
- Added workspace intelligence and CI-oriented checks.
- Added missing dependency and upgrade advisory workflows.

### Bug fixes

- Fixed TypeScript safety issues in aging analysis.
- Restored missing terminal reporter helper functions.

### Documentation

- Added early scoring, API, plugin, examples, benchmark, comparison, and command
  documentation.

### Upgrade notes

- Prefer `pkg-ct doctor` as the main human-readable audit command.
