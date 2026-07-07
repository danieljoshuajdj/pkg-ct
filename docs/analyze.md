# analyze

## Purpose

`pkg-ct analyze` runs the full dependency intelligence review. In the current
CLI it is an alias-style entry point for the doctor pipeline.

## When to use

Use it when existing scripts already call `analyze` or when you prefer that
word for automated reports.

## When not to use

Use [`doctor`](./doctor.md) in new documentation because it is the flagship
human-readable command.

## Example

```bash
pkg-ct analyze
```

## Real output

```text
PKG-CT DEPENDENCY DOCTOR
Health Score: 82/100
```

## Common mistakes

- Expecting `analyze` and `doctor` to use unrelated algorithms.

## Performance

Similar to `doctor`.

## Limitations

It does not add unique checks beyond the doctor pipeline.

## Related commands

- [Doctor](./doctor.md)
- [Commands](./commands.md)
