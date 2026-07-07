# Roadmap

## Purpose

This roadmap records planned direction without promising unsupported features.

## Near-term focus

- Improve framework role mappings with tests.
- Add more fixture coverage for pnpm and Yarn workspaces.
- Improve documentation examples with generated output fixtures.
- Measure large-monorepo performance before optimizing.

## Not planned without evidence

- New CLI commands.
- Claims about exploit maturity without upstream exploit evidence.
- Replacing package-manager security tools.

## Release policy

pkg-ct should only recommend a release after:

- `npm run typecheck`
- `npm run build`
- `npm test`
- `npm run lint`
- `npm pack`
- `npm run release-gate`

## Related documents

- [Architecture](./architecture.md)
- [Benchmarks](./benchmarks.md)
- [Contributing](./contributing.md)
