# aging

## Purpose

`pkg-ct aging` analyzes package activity, old releases, deprecations, and
technical lag.

## When to use

Use it during maintenance planning or before a dependency refresh.

## When not to use

Do not use age alone to judge quality. Some packages are intentionally stable.

## Example

```bash
pkg-ct aging
```

## Real output

```text
Activity: OLD_MAINTAINED
Technical lag: MEDIUM
```

## Common mistakes

- Inferring package age from SemVer.
- Treating missing metadata as abandonment.

## Performance

Registry and repository metadata can add network time.

## Limitations

Offline mode reports unknown activity when publish dates are unavailable.

## Related commands

- [Health](./health.md)
- [Scoring](./scoring.md)
- [Security](./security.md)
