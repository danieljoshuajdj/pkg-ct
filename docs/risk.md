# risk

## Purpose

`pkg-ct risk <packageSpec>` predicts install risk before adding a dependency.

## When to use

Use it before adding a new runtime package, build tool, or framework plugin.

## When not to use

Do not use it as a replacement for reading the package's changelog, license,
or security policy.

## Example

```bash
pkg-ct risk vite@latest
```

## Real output

```text
Install risk: MEDIUM
Evidence: peer dependencies, dependency count, existing graph overlap
```

## Common mistakes

- Treating a prediction as proof that an install is safe.
- Ignoring peer dependency warnings.

## Performance

Risk checks may query registry metadata for the requested package.

## Limitations

Private packages and private registry metadata may be incomplete.

## Related commands

- [Security](./security.md)
- [Explain](./explain.md)
- [Comparison](./comparison.md)
