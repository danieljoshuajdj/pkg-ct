# API

## `analyzeProject(options)`

Runs the full deterministic analysis engine and returns `AnalysisResult`.

Useful options:

- `audit`: run npm audit and normalize vulnerabilities into findings
- `unused`: enable static import analysis for unused direct dependencies
- `onlineMetadata`: fetch npm registry metadata such as latest version, maintainers, publish age, and downloads

The result includes:

- `usage`: static source import usage summary
- `lockfileAnalysis`: lockfile package counts, duplicate package families, and manifest drift
- `audit`: normalized audit vulnerabilities
- `packageIntelligence`: package freshness and metadata signals

## `explainPackage(result, packageName)`

Traces why a package exists, its dependency chains, duplicate versions, install footprint, package health metadata, risks, and removal probability.

## `predictInstallRisk(packageSpec, context, graph, findings)`

Predicts likely conflicts before adding a new dependency.

## `runFixes(result, options)`

Builds or executes a fix plan. Use `dryRun: true` for CI and PR checks.
