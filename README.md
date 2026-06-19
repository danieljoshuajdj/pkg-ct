# pkg-ct

> The AI-powered dependency intelligence and maintenance layer for Node.js projects.

`@danijsrr/pkg-ct` is a dependency observability CLI for modern JavaScript and TypeScript projects. It scans the realized install tree, traces dependency chains, scores project health, predicts install risks, detects unused dependencies, maps audit vulnerabilities, and generates practical remediation plans.

It is not a `depcheck` clone and it is not an `npm audit` wrapper. The deterministic engine performs the analysis; optional AI providers only explain and summarize the findings.

`depxray` maps codebase architecture. `pkg-ct` takes care of your npm ecosystem.

## Install

```bash
npm i -D @danijsrr/pkg-ct
npx @danijsrr/pkg-ct doctor
```

## Commands

```bash
# Core observabilities
npx @danijsrr/pkg-ct scan              # Fast inventory scan (< 300ms)
npx @danijsrr/pkg-ct analyze           # Deep dependency intelligence review (< 1000ms)
npx @danijsrr/pkg-ct doctor            # Full旗舰 level senior-architect dependency diagnostic
npx @danijsrr/pkg-ct health            # Calculate and explain project health score
npx @danijsrr/pkg-ct explain lodash    # Explain why a package exists and what it costs
npx @danijsrr/pkg-ct risk react        # Predict install risks before adding a dependency
npx @danijsrr/pkg-ct fix --dry-run     # Plan and execute safe dependency maintenance fixes
npx @danijsrr/pkg-ct roast             # Generate a humorous dependency roast report

# Intelligence commands (New in v0.3.0)
npx @danijsrr/pkg-ct blast lodash      # Traces direct and transitive dependency blast radius
npx @danijsrr/pkg-ct production        # Classifies dependencies by production relevance
npx @danijsrr/pkg-ct aging             # Evaluates package age and technical lag score
npx @danijsrr/pkg-ct security          # Performs deep security, inactivity, and abandonment audit
```

## What It Detects

- duplicate dependency versions
- unused direct dependencies from static import analysis
- deprecated packages and deprecated chains
- npm audit vulnerabilities mapped into the same finding model
- outdated, stale, low-maintainer package health signals
- peer dependency conflicts
- Node engine incompatibilities
- native module and `node-gyp` install risk
- install lifecycle script supply-chain risk
- oversized dependency chains and transitive bloat
- workspace dependency drift in monorepos
- package manager and lockfile context

## Output Modes

```bash
npx @danijsrr/pkg-ct scan --json
npx @danijsrr/pkg-ct scan --markdown --output dependency-report.md
npx @danijsrr/pkg-ct scan --html --output dependency-report.html
npx @danijsrr/pkg-ct scan --ci
npx @danijsrr/pkg-ct doctor --audit --online-metadata
```

## AI Explanations

AI is optional and never replaces deterministic analysis.

```ts
// pkg-ct.config.ts
import { defineConfig } from '@danijsrr/pkg-ct/config';

export default defineConfig({
  ai: {
    provider: 'openai',
    model: 'gpt-4.1-mini',
    apiKeyEnv: 'OPENAI_API_KEY'
  }
});
```

Supported provider architecture:

- OpenAI
- Anthropic
- Ollama and local OpenAI-compatible endpoints
- offline/no-AI mode for enterprise environments

## Configuration

```ts
import { defineConfig } from '@danijsrr/pkg-ct/config';

export default defineConfig({
  offline: true,
  ignorePackages: ['typescript'],
  ci: {
    minScore: 75,
    failOn: 'high'
  },
  scoring: {
    security: 1.8,
    compatibility: 1.4
  },
  plugins: ['pkg-ct-plugin-next']
});
```

## Monorepos

The scanner understands npm, pnpm, Yarn, Bun, Turborepo, Nx, Lerna, Rush, and workspace package manifests. It reports dependency drift across workspaces and builds a shared dependency graph when `node_modules` is available.

## GitHub Actions

```yaml
name: Dependency Doctor
on: [pull_request]
jobs:
  doctor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx @danijsrr/pkg-ct doctor --ci --markdown --output dependency-report.md
```

## Programmatic API

```ts
import { analyzeProject, explainPackage } from '@danijsrr/pkg-ct';

const result = await analyzeProject({ root: process.cwd() });
const lodash = explainPackage(result, 'lodash');
```

## Release

This package uses Changesets:

```bash
npm run build
npm test
npx changeset
npx changeset version
npm publish
```

## Benchmarks

Typical execution runtimes measured on average JavaScript/TypeScript repositories (approx. 200 dependencies):

- **`scan` runtime**: `~120ms` (Fast inventory check bypassing unused code scans, audits, and online metadata queries)
- **`analyze` runtime**: `~450ms` (Local static analysis and scoring check)
- **`doctor` runtime**: `~850ms` (Aggregated full audit, including static analysis, local heuristics, and online metadata queries)
