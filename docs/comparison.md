# Comparison

pkg-ct complements package-manager tools. It does not replace them.

## Purpose

Show what pkg-ct adds beside common dependency tools without exaggerating
unsupported features.

## When to use

Use this page when choosing which command to run for dependency analysis,
dependency health, security triage, or package diagnostics.

## When not to use

Do not use this as a benchmark. Performance notes live in
[benchmarks](./benchmarks.md).

## Comparison table

| Tool | Best at | What pkg-ct adds |
| --- | --- | --- |
| `npm audit` | Known advisories and remediations from npm audit metadata | Production relevance, reachability context, priority reason, and package role |
| `pnpm audit` | Known advisories in pnpm-managed projects | Same advisory context when pkg-ct analyzes the installed project graph |
| `npm outdated` | Installed, wanted, and latest version comparison | Upgrade risk context, freshness scoring, and activity classification |
| `npm ls` | Printing the installed dependency tree | Health score, root causes, duplicate severity, and explain narratives |
| `depcheck` | Finding likely unused declarations | Config/script/framework/peer/workspace evidence and safe-removal probability |

## Example

```bash
npm audit
pkg-ct security
pkg-ct explain vulnerable-package
```

## Real output

```text
Priority: HIGH
Production Relevance: Production Critical
Exploitability: UNKNOWN
```

## Common mistakes

- Treating pkg-ct as an advisory database.
- Treating package-manager output as enough context for production priority.
- Assuming an unknown classification is safe.

## Performance

Use package-manager tools for single-purpose checks. Use pkg-ct when the extra
graph, source, role, and scoring context is worth the additional analysis.

## Limitations

pkg-ct cannot prove exploit maturity unless upstream data includes it. It also
cannot prove framework-specific runtime behavior without supported evidence.

## Related commands

- [Security](./security.md)
- [Risk](./risk.md)
- [Doctor](./doctor.md)
- [Benchmarks](./benchmarks.md)
