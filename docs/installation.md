# Installation

## Purpose

Install `@danijsrr/pkg-ct`, a TypeScript CLI for dependency analysis,
dependency diagnostics, dependency health, and package health reporting.

## When to use

Use this guide when you want to run pkg-ct locally, in CI, or from a one-off
`npx` command.

## When not to use

Do not install globally if your team needs every developer and CI job to use
the exact same version. In that case, install it as a dev dependency.

## Examples

Run without a permanent install:

```bash
npx @danijsrr/pkg-ct doctor
```

Install in one project:

```bash
npm install --save-dev @danijsrr/pkg-ct
npx pkg-ct doctor
```

Install globally:

```bash
npm install --global @danijsrr/pkg-ct
pkg-ct doctor
```

## Real output

```text
PKG-CT DEPENDENCY DOCTOR
Health Score: 82/100
Ready: YES
```

Output depends on the analyzed project, lockfile, and optional online metadata.

## Common mistakes

- Running in a folder without a `package.json`.
- Comparing two runs after changing lockfiles.
- Treating unknown online metadata as proof that a package is safe or unsafe.

## Performance

Local graph, lockfile, and source scans are deterministic. Online metadata can
add network time.

## Limitations

Private registry and private repository metadata may be unavailable.

## Related commands

- [Quick start](./quick-start.md)
- [Commands](./commands.md)
- [Doctor](./doctor.md)
