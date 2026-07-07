# Documentation for Contributors

This page mirrors the repository-level [CONTRIBUTING.md](../CONTRIBUTING.md)
so documentation readers can stay inside the docs tree.

## Purpose

Explain how to contribute tests, documentation, and dependency-intelligence
rules.

## When to use

Use before opening an issue or pull request.

## When not to use

Use [SECURITY.md](../SECURITY.md) for vulnerability reports.

## Example

```bash
npm install
npm run release-gate
```

## Real output

```text
Release gate passed
```

## Common mistakes

- Adding a heuristic without documenting its boundary.
- Updating README examples without running the command.
- Adding a command instead of improving an existing one.

## Performance

Performance claims require measured fixtures and environment details.

## Limitations

Maintainer decisions may change release scope.

## Related commands

- [Commands](./commands.md)
- [Architecture](./architecture.md)
- [Benchmarks](./benchmarks.md)
