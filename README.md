# pkg-ct

> Dependency intelligence, dependency health, and package diagnostics for
> Node.js, React, and TypeScript projects.

Evidence-first dependency diagnostics for Node.js projects.

[![npm version](https://img.shields.io/npm/v/@danijsrr/pkg-ct.svg)](https://www.npmjs.com/package/@danijsrr/pkg-ct)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/license/mit)

`pkg-ct` explains the dependency tree you actually installed. It connects
`package.json`, the lockfile, `node_modules`, source imports, configuration
files, package scripts, workspaces, npm audit data, and registry metadata into
one report.

Use it when the real question is not merely "is anything outdated?" but:

- Why is this package installed?
- Is this duplicate normal patch drift or a breaking major split?
- Does this advisory affect production?
- Which package introduced this install cost?
- Is a dependency truly unused, or loaded through config or a script?
- Is an old package inactive, maintained, deprecated, archived, or simply
  stable?

The analysis is deterministic. Optional online metadata improves activity and
security context, but no chat model is required to explain a result.

## Features

- Dependency analysis from the installed tree, lockfile, source files, config,
  scripts, workspace manifests, npm audit data, and optional registry metadata.
- Health score with category breakdowns and root-cause clustering.
- SemVer-aware duplicate detection so patch drift is not treated like a major
  version split.
- Confidence engine for unused dependency findings.
- Production classification for runtime, build-time, and development-only
  packages.
- Security triage that separates severity, reachability, exploitability,
  production relevance, and priority.
- Explain reports for one package at a time.
- Workspace drift checks for monorepos.
- Terminal, JSON, Markdown, HTML, and CI-oriented reporting where supported.

## Installation

Run without installing globally:

```bash
npx @danijsrr/pkg-ct doctor
```

Or install the CLI:

```bash
npm install --global @danijsrr/pkg-ct
pkg-ct doctor
```

Start with these three commands:

```bash
pkg-ct scan
pkg-ct doctor
pkg-ct explain chalk
```

- `scan` gives a fast inventory.
- `doctor` ranks findings, clusters root causes, and evaluates release
  readiness.
- `explain <package>` traces one package from source usage to dependency chains
  and removal risk.

## Real examples

Use `doctor` before merging a dependency-heavy pull request:

```bash
pkg-ct doctor
```

Use `explain` before removing a package:

```bash
pkg-ct explain eslint
```

Use `security` when npm audit reports a vulnerability and you need priority
context:

```bash
pkg-ct security
```

## Screenshots

The repository stores text-first terminal examples so they render in GitHub,
npm, CI logs, and AI summaries without image-only context.

| Command | Screenshot/reference |
| --- | --- |
| `doctor` | See [Reading a doctor report](#reading-a-doctor-report) and [docs/doctor.md](./docs/doctor.md) |
| `scan` | See [docs/scan.md](./docs/scan.md) |
| `analyze` | See [docs/analyze.md](./docs/analyze.md) |
| `security` | See [docs/security.md](./docs/security.md) |
| `risk` | See [docs/risk.md](./docs/risk.md) |
| `health` | See [docs/health.md](./docs/health.md) |
| `explain` | See [docs/explain.md](./docs/explain.md) |
| `roast` | See [docs/commands.md#roast](./docs/commands.md#roast) |

## Supported frameworks and project types

pkg-ct is package-manager and framework aware rather than framework locked.
Current documentation and fixtures cover:

- React;
- Vite;
- Next.js;
- Expo-style React projects, when their package graph is installed locally;
- Express and NestJS-style Node.js services;
- Cloudflare Workers projects;
- TanStack Start-style Vite/React applications;
- npm, pnpm, and Yarn workspaces.

Framework support means pkg-ct can inspect the dependency graph and common
configuration patterns. It does not mean every framework-specific convention is
perfectly classified. Unknown evidence remains unknown until a fixture proves a
mapping.

## What problem does it solve?

A modern application can install hundreds of packages from a small manifest.
Individual tools each answer one useful question, but the answers are usually
separate:

```text
package.json + lockfile + node_modules
                  |
                  v
          realized dependency graph
            /       |        \
           v        v         v
      source use  security  package activity
            \       |        /
             v      v       v
           evidence-backed findings
                    |
                    v
       root causes + release readiness
```

`pkg-ct` joins those signals. A duplicate warning includes the versions and the
packages that require each version. A vulnerability includes severity,
reachability, production relevance, the reason for its priority, and an honest
`UNKNOWN` when exploit maturity is not present in npm audit metadata.

## How it differs from other tools

These tools complement one another:

| Tool | Best at | What `pkg-ct` adds |
| --- | --- | --- |
| `npm audit` | Known advisories and available remediations | Production reachability, role, priority reason, and dependency context |
| `npm outdated` | Installed, wanted, and latest versions | Upgrade/blast-radius context and activity classification |
| `depcheck` | Finding likely unused declarations | Config, script, dynamic import, framework, peer, and workspace evidence |
| `npm dedupe` | Simplifying the installed tree | SemVer-aware severity and the introducer for every duplicate version |
| `pkg-ct` | Joining tree, usage, risk, and maintenance evidence | One prioritized explanation and release decision |

`pkg-ct` does not replace `npm audit`, the package manager, a test suite, or a
human changelog review. It makes their evidence easier to act on.

## Why developers can trust it

pkg-ct prefers a smaller honest answer to a confident invented one.

- Unknown metadata is shown as unknown.
- Heuristics are documented as heuristics.
- Security exploitability remains `UNKNOWN` unless upstream data supports a
  stronger claim.
- Duplicate severity follows SemVer distance.
- Release readiness prints the threshold and the evidence behind it.
- Tests cover confidence, duplicate severity, production roles, aging realism,
  security priority, root-cause clustering, install impact, and explain output.

## Reading a doctor report

The report uses progressive disclosure:

1. Health and inventory summary.
2. Top actions.
3. Root causes.
4. Category details.
5. Confidence evidence.
6. Fix plan and bounded score projection.
7. Release-readiness checks.

Example terminal snapshot:

```text
========================================================================
PKG-CT DEPENDENCY DOCTOR
========================================================================
[B] Health Score: 82/100  Grade: B
468 packages | 19 findings | 912ms

TOP ACTIONS
------------------------------------------------------------------------
1. react is installed in 2 versions [MEDIUM]
   Inspect introducer chains and align direct ranges.

ROOT CAUSES
------------------------------------------------------------------------
Root Cause 1: Duplicate ecosystem
  Symptoms: 8
  Triggered by: chalk, esbuild, picomatch, ansi-styles

RELEASE READINESS
------------------------------------------------------------------------
OK  Peer deps satisfied          3 optional peers available
OK  Duplication under control    18 families; threshold 25

Ready: YES
```

Colors are additive; the text and symbols remain readable in plain logs and CI.
Output is kept near 72 columns, with long recommendation text shortened in
summary sections.

## Core concepts

### Health score

The health score is a weighted summary, not a count of warnings. Findings are
grouped by package family, finding type, and severity before deductions are
applied. Twelve occurrences of the same `esbuild` root cause do not count as
twelve unrelated maintenance problems.

Scores help compare runs of the same project. Read the category breakdown and
blocking reasons before comparing unrelated repositories.

| Grade | Score | Meaning |
| --- | ---: | --- |
| A | 90-100 | No material or only small, bounded findings |
| B | 75-89 | Healthy with manageable maintenance work |
| C | 60-74 | Review important compatibility or security findings |
| D | 40-59 | Multiple material root causes |
| F | 5-39 | Critical or broad dependency risk |

See [Scoring and calibration](./docs/scoring.md).

### Confidence

Confidence is computed from independent signals. It is not a fixed label.

```text
Source imports          +40
Configuration files     +20
Dynamic imports         +15
Package scripts         +10
                         ---
Total confidence          85%
```

The engine counts each signal type once, even if a package appears in many
files. File counts remain visible as evidence. A dynamic import with a score
below 30 is still real usage and is not treated as unused.

The weights are documented heuristics. They rank the breadth of evidence; they
are not statistical probabilities.

### Risk and blast radius

Risk describes the likely effect of changing or removing a package. Blast
radius counts reverse-reachable dependency nodes in the installed graph.

```text
application
    |
    +-- vite
         |
         +-- esbuild
              |
              +-- target package

Removing target package walks upward:
target package -> esbuild -> vite -> application
```

`explain` displays direct dependents, total reverse dependents, active findings,
installed major lines, and source files. Upgrade risk is derived from those
facts; it is not guessed from package popularity.

### Production role

Packages are assigned roles such as `FRAMEWORK`, `BUNDLER`, `PARSER`,
`HMR_RUNTIME`, `URL_LIBRARY`, `FILE_FILTER`, `AST`, `AST_UTIL`, and
`TERMINAL_UI`. The role and the installed node's development flag determine
whether a package is production critical, build-only, or development-only.

Unknown classification is retained only when available evidence cannot support
a role. It is not generated randomly to satisfy a target percentage.

### Security priority

Security output separates:

- advisory severity from npm;
- reachability from source and graph evidence;
- exploitability, which remains `UNKNOWN` unless the upstream data supplies
  exploit evidence;
- production relevance;
- a plain-language reason;
- final priority.

A high-severity development-only advisory can therefore be low priority without
being hidden. A source-referenced production advisory stays high priority.

See [Security model](./docs/security.md).

### Package activity

Age alone is not a defect. The activity engine combines the latest npm publish
date, deprecation metadata, whether the installed version is current, download
volume, and—when available—repository `archived` and `pushed_at` metadata.

Possible states include:

- recently updated;
- old but maintained;
- old and inactive;
- long-term stable;
- deprecated;
- archived;
- old but unverified;
- unknown.

The "long-term stable" label is explicitly a heuristic: an older current
release with substantial downloads and no conflicting repository inactivity
evidence may be intentionally stable. Offline mode does not invent a package's
age from its version number.

## Duplicate severity and release readiness

Duplicate families are classified by version distance:

| Installed versions | Severity | Reason |
| --- | --- | --- |
| `1.2.1`, `1.2.3` | Low | Patch-only variation |
| `1.2.0`, `1.4.0` | Low | One major line; normally compatible variation |
| `17.0.0`, `18.0.0` | Medium | Two potentially incompatible major APIs |
| `16`, `17`, `18` | High | Three migration boundaries |

Non-SemVer values remain low severity because their breaking distance cannot be
proved.

The duplicate release threshold starts at 10 families for fewer than 200
packages, 20 for 200-499, and 35 for 500 or more. Framework projects receive a
small allowance. Monorepos receive a workspace allowance based on their shape.
The exact factors are printed beside the check.

## Command guide

| Command | Purpose |
| --- | --- |
| `scan` | Fast installed-tree and lockfile inventory |
| `doctor` | Full prioritized report and release readiness |
| `analyze` | Full analysis alias suitable for reports |
| `health` | Score and category breakdown |
| `explain <pkg>` | Why installed, source use, chain, blast radius, removal and upgrade risk |
| `risk <spec>` | Predict risk before installing a package |
| `upgrade <spec>` | Review upgrade compatibility before a version bump |
| `security` | Advisory priority, activity, and supply-chain signals |
| `production` | Package roles and production relevance |
| `aging` / `timeline` | Release and repository activity view |
| `workspace` | Workspace drift and dependency health |
| `missing` | Imports that are absent from the manifest |
| `fix` | Review or apply supported maintenance actions |
| `ci` | Apply score/severity gates in automation |
| `blast <pkg>` | Focused reverse-dependency impact analysis |
| `roast` | A lighter summary built from the same findings |

See the [complete command reference](./docs/commands.md) for options and output
formats.

## Which command should I run?

```text
Need a quick inventory?
  -> pkg-ct scan

Preparing a release or pull request?
  -> pkg-ct doctor

Wondering why one package exists?
  -> pkg-ct explain <package>

Evaluating a new install or upgrade?
  -> pkg-ct risk <package@version>
  -> pkg-ct upgrade <package@version>

Investigating an advisory?
  -> pkg-ct security
  -> pkg-ct explain <affected-package>

Using a monorepo?
  -> pkg-ct workspace
  -> pkg-ct doctor
```

## Advanced usage

### CI

Use the machine-oriented command and configure minimum score and failure
severity in the project configuration:

```bash
pkg-ct ci
```

JSON, Markdown, HTML, and terminal reporters are available through command
options. See [CI and commands](./docs/commands.md) and the reusable
[GitHub Action definition](./action.yml).

### Workspaces

npm, pnpm, and Yarn workspace manifests are inspected for dependency-range
drift. Release readiness uses both total package count and workspace shape, so
a healthy monorepo is not judged by the same duplicate-family budget as a
small single-package service.

### Offline and online metadata

The installed graph, lockfile, manifest, source usage, and local package
metadata are deterministic local inputs. Registry publish dates, weekly
downloads, deprecations, advisories, and public GitHub repository activity need
network access. Missing online data is reported as unknown; it is not replaced
with a fabricated estimate.

### Plugins

Plugins can add rules and reporters through the existing plugin API. They do
not bypass the core evidence model. Start with [Plugin development](./docs/plugins.md)
and [Public API](./docs/api.md).

## Troubleshooting

### A package is reported as unused but a framework loads it

Run:

```bash
pkg-ct explain <package>
```

Check config, script, workspace, peer, and build-plugin signals. If the
framework uses an unsupported convention, add the package to project ignore
rules and open a reproducible issue with the relevant config file.

### Duplicate counts differ from another package manager

`pkg-ct` reports the realized installed graph. Reinstall with the intended
package manager, commit its lockfile, and run `scan` again. A duplicate family
can be valid even when it cannot be deduped because parent ranges do not
overlap.

### Security priority says exploitability is unknown

That is deliberate. npm audit metadata supplies advisory and remediation data
but does not consistently provide exploit maturity. `pkg-ct` does not convert
reachability into an exploitability claim.

### Package activity is unknown

Run with online metadata enabled and verify the package has a valid repository
URL. Private registries and private repositories may not expose the metadata.
Unknown is preferred to an invented age.

More answers are in the [FAQ](./docs/faq.md).

## Documentation

- [Getting started](./docs/getting-started.md)
- [Installation](./docs/installation.md)
- [Quick start](./docs/quick-start.md)
- [Command reference](./docs/commands.md)
- [Scan](./docs/scan.md)
- [Analyze](./docs/analyze.md)
- [Doctor report](./docs/doctor.md)
- [Health](./docs/health.md)
- [Scoring and confidence](./docs/scoring.md)
- [Explain and blast radius](./docs/explain.md)
- [Risk](./docs/risk.md)
- [Security model](./docs/security.md)
- [Production classification](./docs/production.md)
- [Aging and technical lag](./docs/aging.md)
- [Workspace health](./docs/workspace.md)
- [Examples](./docs/examples.md)
- [Comparison](./docs/comparison.md)
- [FAQ and troubleshooting](./docs/faq.md)
- [Architecture](./docs/architecture.md)
- [Roadmap](./docs/roadmap.md)
- [Plugin system](./docs/plugins.md)
- [API](./docs/api.md)
- [Benchmarks and comparisons](./docs/benchmarks.md)
- [Contributing](./CONTRIBUTING.md)
- [Changelog](./CHANGELOG.md)

## Architecture at a glance

```text
workspace discovery
       |
       +--> installed graph (Arborist/local fallback)
       +--> lockfile analysis
       +--> source and configuration evidence
       +--> npm audit and optional registry metadata
                         |
                         v
                    built-in rules
                         |
              +----------+----------+
              v                     v
       health scoring         remediation plan
              \                     /
               +---------+---------+
                         v
                 terminal/JSON/MD/HTML
```

For module boundaries and extension points, read
[Architecture](./docs/architecture.md).

## Contributing and release workflow

Install dependencies and run the complete local gate:

```bash
npm install
npm run release-gate
```

The release gate runs typecheck, build, tests, lint, and package creation.
Contributions should include a regression test that proves the old behavior,
the corrected behavior, and any heuristic boundary. See
[CONTRIBUTING.md](./CONTRIBUTING.md).

Benchmark methodology and current comparison scenarios live in
[docs/benchmarks.md](./docs/benchmarks.md). Benchmarks should be interpreted
with their fixture, package-manager version, Node version, and online/offline
mode; an unlabeled headline number is not evidence.

## FAQ

### Is pkg-ct an npm audit replacement?

No. It reads npm audit evidence and adds context such as production relevance,
reachability, and priority. Keep using npm audit or your package manager's
security workflow.

### Does pkg-ct use AI?

The project can integrate AI providers for summaries, but the dependency facts
come from deterministic local and registry evidence. AI is not required for the
core reports.

### Why does a package show as unknown?

Because pkg-ct did not have enough evidence to classify it honestly. Unknown is
better than pretending.

### Can I use this in a monorepo?

Yes. Start with `pkg-ct workspace`, then run `pkg-ct doctor` from the repo root.

## Release notes

- [CHANGELOG.md](./CHANGELOG.md) includes v0.5.0, v0.5.1, and v0.6.0 notes.
- [V0_6_0_PRODUCTION_AUDIT.md](./V0_6_0_PRODUCTION_AUDIT.md) explains the
  production polish audit for this sprint.

## License

MIT. See [LICENSE](./LICENSE).
