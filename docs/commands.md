# Commands

Every command reads evidence from the installed dependency graph, lockfile,
`package.json`, source files, configuration files, package scripts, and optional
online metadata. No command requires an AI provider to create facts.

## Command directory

| Command | Purpose | Details |
| --- | --- | --- |
| `scan` | Fast inventory | [scan](./scan.md) |
| `analyze` | Full review alias-style entry point | [analyze](./analyze.md) |
| `doctor` | Flagship report and release readiness | [doctor](./doctor.md) |
| `health` | Score and category breakdown | [health](./health.md) |
| `explain <pkg>` | Why installed, evidence, blast radius, removal risk | [explain](./explain.md) |
| `fix` | Generate or run supported maintenance fixes | This page |
| `roast` | Humorous summary from real findings | This page |
| `risk <spec>` | Predict install risk | [risk](./risk.md) |
| `blast <pkg>` | Reverse-dependency impact | [blast](./blast.md) |
| `production` | Production relevance and roles | [production](./production.md) |
| `aging` | Activity and technical lag | [aging](./aging.md) |
| `security` | Advisory triage and supply-chain context | [security](./security.md) |
| `missing` | Imports missing from manifest | This page |
| `upgrade <spec>` | Upgrade risk advisor | This page |
| `timeline` | Age and lag timeline | [aging](./aging.md) |
| `workspace` | Workspace range drift and health | [workspace](./workspace.md) |
| `ci` | Quality gates for automation | This page |

## Shared options

Command options vary by command, but reports may support terminal, JSON,
Markdown, or HTML output where implemented. Use `pkg-ct <command> --help` for
the current option list.

## `fix`

### Purpose

Generate or run safe dependency maintenance fixes.

### When to use

Use after `doctor` identifies a clear remediation such as deduplication.

### When not to use

Do not apply fixes blindly on release branches. Review lockfile changes.

### Example

```bash
pkg-ct fix
```

### Real output

```text
Suggested fix: npm dedupe
Reason: duplicate package families can be simplified by the package manager
```

### Common mistakes

- Expecting pkg-ct to override package-manager constraints.
- Applying fixes without tests.

### Performance

Fix planning is fast; applying package-manager changes depends on npm/pnpm/Yarn.

### Limitations

Only supported, evidence-backed maintenance actions are suggested.

### Related commands

- [Doctor](./doctor.md)
- [Scoring](./scoring.md)

## `roast`

### Purpose

Create a playful dependency summary from the same findings used by serious
reports.

### When to use

Use it for team visibility or a lighter maintenance prompt.

### When not to use

Do not use it as an audit artifact for compliance.

### Example

```bash
pkg-ct roast
```

### Real output

```text
Dependency Roast
Health score: 82/100
Duplicate families: 18
```

### Common mistakes

- Treating jokes as separate findings. They are presentation over real data.

### Performance

Similar to a normal report render after analysis.

### Limitations

Tone is intentionally informal.

### Related commands

- [Doctor](./doctor.md)
- [Health](./health.md)

## `missing`

### Purpose

Find packages imported in source but absent from `package.json`.

### When to use

Use when CI or production fails with module-resolution errors.

### When not to use

Do not use it to validate Node.js built-ins or aliases without matching
configuration.

### Example

```bash
pkg-ct missing
```

### Real output

```text
Missing dependency: lodash
Referenced by: src/utils/format.ts
```

### Common mistakes

- Forgetting that a stale `node_modules` can hide missing declarations locally.

### Performance

Scales with source file count.

### Limitations

Dynamic package names cannot always be resolved statically.

### Related commands

- [Scan](./scan.md)
- [Explain](./explain.md)

## `upgrade`

### Purpose

Predict upgrade risk before bumping a package.

### When to use

Use before a major or framework-adjacent upgrade.

### When not to use

Do not replace changelog review or application tests.

### Example

```bash
pkg-ct upgrade typescript@latest
```

### Real output

```text
Upgrade risk: MEDIUM
Evidence: major version distance, peer ranges, dependents
```

### Common mistakes

- Upgrading several major versions in one PR without staged validation.

### Performance

May query registry metadata for the target spec.

### Limitations

It predicts dependency compatibility, not application semantic correctness.

### Related commands

- [Risk](./risk.md)
- [Explain](./explain.md)

## `ci`

### Purpose

Run dependency quality gates in automation.

### When to use

Use in GitHub Actions, GitLab CI, Azure DevOps, Jenkins, or local release
scripts.

### When not to use

Do not set a strict threshold before establishing a baseline for the project.

### Example

```bash
pkg-ct ci
```

### Real output

```text
pkg-ct CI Quality Gates
Status: PASS
Score: 82/100
```

### Common mistakes

- Blocking all work on a legacy repository with a day-one score target.

### Performance

Similar to the doctor pipeline.

### Limitations

CI gates are only as useful as the configured thresholds.

### Related commands

- [Doctor](./doctor.md)
- [Scoring](./scoring.md)
