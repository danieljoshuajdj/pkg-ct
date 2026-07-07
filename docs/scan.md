# scan

## Purpose

`pkg-ct scan` creates a fast inventory of the installed dependency graph,
lockfile, and package metadata.

## When to use

Use it when you want a quick picture before running the deeper doctor report.

## When not to use

Do not use `scan` as the final release gate. Use [`doctor`](./doctor.md) or
[`ci`](./commands.md#ci) for release decisions.

## Example

```bash
pkg-ct scan
```

## Real output

```text
SCAN INVENTORY
Packages: 481
Findings: 235
```

## Common mistakes

- Comparing package counts across different package managers.
- Running before installing dependencies.

## Performance

`scan` is the lightest general-purpose command because it avoids the full
doctor narrative.

## Limitations

It is an inventory, not a full remediation plan.

## Related commands

- [Doctor](./doctor.md)
- [Health](./health.md)
- [Workspace](./workspace.md)
