# production

## Purpose

`pkg-ct production` classifies packages by production relevance.

## When to use

Use it when deciding whether a finding affects deployed code, build-time code,
or development-only tooling.

## When not to use

Do not treat unknown as harmless. Unknown means the available evidence does not
prove a role.

## Example

```bash
pkg-ct production
```

## Real output

```text
react            Production critical
vite             Build-time
eslint           Development only
```

## Common mistakes

- Assuming every devDependency is irrelevant to production.
- Assuming every transitive package is runtime critical.

## Performance

Production classification uses graph flags, package roles, and source/config
evidence.

## Limitations

Framework conventions that are not mapped may remain unknown.

## Related commands

- [Security](./security.md)
- [Explain](./explain.md)
- [Scoring](./scoring.md)
