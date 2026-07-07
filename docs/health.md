# health

## Purpose

`pkg-ct health` prints the health score and scoring explanation.

## When to use

Use it when you want score movement, category breakdowns, and high-level
quality gates without the full doctor report.

## When not to use

Do not treat the score alone as a release decision. Read the blockers and
critical findings.

## Example

```bash
pkg-ct health
```

## Real output

```text
Health Score: 82/100
Grade: B
```

## Common mistakes

- Comparing unrelated repositories by score only.
- Counting repeated symptoms as separate root causes.

## Performance

Health scoring runs after graph and rule analysis.

## Limitations

The score is a calibrated heuristic, not a statistical guarantee.

## Related commands

- [Scoring](./scoring.md)
- [Doctor](./doctor.md)
- [Risk](./risk.md)
