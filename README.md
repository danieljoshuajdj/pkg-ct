# depdoctor

> The AI-powered dependency intelligence and maintenance layer for Node.js projects.

`depdoctor` is a dependency observability CLI for modern JavaScript and TypeScript projects. It scans the realized install tree, traces dependency chains, scores project health, predicts install risks, and generates practical remediation plans.

It is not a `depcheck` clone and it is not an `npm audit` wrapper. The deterministic engine performs the analysis; optional AI providers only explain and summarize the findings.

## Install

```bash
npm i -D depdoctor
npx depdoctor doctor
```

## Commands

```bash
npx depdoctor scan
npx depdoctor doctor
npx depdoctor health
npx depdoctor explain lodash
npx depdoctor risk react@latest
npx depdoctor fix --dry-run
npx depdoctor roast
```

## What It Detects

- duplicate dependency versions
- deprecated packages and deprecated chains
- peer dependency conflicts
- Node engine incompatibilities
- native module and `node-gyp` install risk
- install lifecycle script supply-chain risk
- oversized dependency chains and transitive bloat
- workspace dependency drift in monorepos
- package manager and lockfile context

## Output Modes

```bash
npx depdoctor scan --json
npx depdoctor scan --markdown --output dependency-report.md
npx depdoctor scan --html --output dependency-report.html
npx depdoctor scan --ci
```

## AI Explanations

AI is optional and never replaces deterministic analysis.

```ts
// depdoctor.config.ts
import { defineConfig } from 'depdoctor/config';

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
import { defineConfig } from 'depdoctor/config';

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
  plugins: ['depdoctor-plugin-next']
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
      - run: npx depdoctor doctor --ci --markdown --output dependency-report.md
```

## Programmatic API

```ts
import { analyzeProject, explainPackage } from 'depdoctor';

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
