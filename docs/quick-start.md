# Quick Start

## Purpose

Get a useful dependency report in under a minute.

## When to use

Use this when you are new to pkg-ct or reviewing a pull request before release.

## When not to use

Do not start here if you only need one package explanation. Use
[`explain`](./explain.md) instead.

## Example

```bash
npx @danijsrr/pkg-ct scan
npx @danijsrr/pkg-ct doctor
npx @danijsrr/pkg-ct explain react
```

## Real output

```text
SCAN INVENTORY
Packages: 481

RELEASE READINESS
Ready: YES
```

Your numbers will differ.

## Common mistakes

- Reading the health score without reading the blockers.
- Assuming duplicate families are always bad. Patch-only drift can be normal.
- Assuming every old package is abandoned.

## Performance

Start with `scan` for a quick inventory. Use `doctor` when you want the full
prioritized report.

## Limitations

pkg-ct explains dependency evidence; it does not run your application tests.

## Related commands

- [Scan](./scan.md)
- [Doctor](./doctor.md)
- [Explain](./explain.md)
