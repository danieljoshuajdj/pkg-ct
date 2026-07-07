# Contributing

Thanks for improving `@danijsrr/pkg-ct`.

The project values deterministic, evidence-first dependency intelligence. A
change is ready when a reviewer can see what changed, why it is correct, and
which test or fixture proves it.

## Development setup

```bash
npm install
npm run typecheck
npm run build
npm test
npm run lint
```

Before a release, run:

```bash
npm run release-gate
```

## Contribution rules

- Do not add a new CLI command unless there is a clear maintainer decision.
- Keep rules deterministic and explainable in offline mode.
- AI providers may summarize findings, but they must not invent new facts.
- Mark heuristics as heuristics in code comments, tests, or documentation.
- Prefer small pull requests with one behavior change and one regression test.
- Preserve backwards-compatible output unless a genuine bug requires a change.

## Testing expectations

Use the smallest test that proves the behavior:

- unit tests for scoring, SemVer, roles, and report rendering;
- fixture tests for framework/config/source evidence;
- CLI snapshots only when the user-facing shape is the feature.

If a change touches documentation examples, run the command locally and paste
current output rather than writing a guessed transcript.

## Documentation expectations

Update the matching document in `docs/` when behavior changes. Every major
concept should explain:

- what it means;
- how pkg-ct calculates it;
- what evidence is used;
- limitations and false-positive boundaries;
- related commands.

## Changesets

Every published user-facing change should include a changeset:

```bash
npx changeset
```

## Security

Do not open public issues for suspected vulnerabilities. Follow
[SECURITY.md](./SECURITY.md).
