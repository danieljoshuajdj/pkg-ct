# workspace

## Purpose

`pkg-ct workspace` inspects monorepo dependency drift and workspace health.

## When to use

Use it in npm, pnpm, or Yarn workspaces where multiple packages share
dependencies.

## When not to use

Do not use it for a single-package project unless you are validating workspace
configuration.

## Example

```bash
pkg-ct workspace
```

## Real output

```text
Workspace packages: 6
Version drift: react has 2 requested ranges
```

## Common mistakes

- Aligning every dependency range without checking package-specific needs.
- Ignoring package-manager lockfile behavior.

## Performance

Workspace checks scale with the number of workspace manifests and dependency
ranges.

## Limitations

Custom workspace resolvers may need explicit configuration.

## Related commands

- [Doctor](./doctor.md)
- [Scan](./scan.md)
- [Architecture](./architecture.md)
