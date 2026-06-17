# Architecture

`pkgdoctor` is split into small engines:

- `scanner`: project, workspace, package manager, lockfile, and metadata discovery
- `scanner/source-usage`: static import usage analysis for unused direct dependencies
- `scanner/lockfile`: package-lock, pnpm, Yarn, and Bun lockfile signals
- `scanner/audit`: npm audit normalization into dependency findings
- `graph`: realized dependency graph construction and traversal
- `rules`: deterministic findings
- `health`: weighted scoring
- `risk`: install failure prediction
- `fixers`: safe remediation planning and command execution
- `reporters`: terminal, JSON, markdown, HTML, and CI output
- `ai`: explanation providers that summarize deterministic findings
- `plugins`: rule and reporter extension host

The core API is intentionally UI-agnostic so a future VS Code extension, SaaS dashboard, or GitHub app can consume the same analysis result.

## Analysis Flow

1. Load and validate config.
2. Discover package manager and workspaces.
3. Build the dependency graph with Arborist, falling back to manifest analysis.
4. Collect optional npm registry intelligence through `pacote`.
5. Run deterministic rules.
6. Calculate weighted health score.
7. Build remediation plans.
8. Render through a reporter.

## Enterprise Mode

Set `offline: true` and `ai.provider: 'none'` to avoid external calls. Network-backed metadata and AI summaries are opt-in.
