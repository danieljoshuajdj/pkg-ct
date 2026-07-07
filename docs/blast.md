# blast

## Purpose

`pkg-ct blast <packageName>` estimates how much of the installed graph depends
on one package.

## When to use

Use it before removing, replacing, or upgrading a package that appears widely
shared.

## When not to use

Do not use blast radius as the only migration signal. Source usage, peer
dependencies, and tests still matter.

## Example

```bash
pkg-ct blast chalk
```

## Real output

```text
Blast radius: MEDIUM
Reverse dependents: 12
```

## Common mistakes

- Confusing direct dependents with all reverse dependents.
- Assuming a transitive package can be removed directly from package.json.

## Performance

Blast radius is graph traversal over the installed tree.

## Limitations

It measures dependency graph impact, not runtime code coverage.

## Related commands

- [Explain](./explain.md)
- [Doctor](./doctor.md)
- [Architecture](./architecture.md)
