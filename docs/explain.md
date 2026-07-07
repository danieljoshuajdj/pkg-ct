# Explain and blast radius

`pkg-ct explain <package>` answers one question using only evidence present in
the analysis result.

## Output fields

The command shows:

- whether the root manifest declares the package;
- whether source files import or require it;
- source file count and names;
- direct package dependents;
- dependency chains from the project root;
- additive confidence evidence;
- reverse dependency blast radius;
- safe-removal estimate and its inputs;
- production role and its inputs;
- upgrade risk and its inputs;
- install footprint and registry metadata;
- active findings and their evidence.

Example:

```text
WHY INSTALLED
------------------------------------------------------------------------
Imported directly: NO
Evidence: absent from root package.json dependency fields.
Imported indirectly: YES
Evidence: 2 direct graph parent(s).
Who imports it: eslint, vite

EVIDENCE CONFIDENCE
------------------------------------------------------------------------
Source imports           +40
Configuration files      +20
Total confidence: 60%
```

## Dependency chains

Chains are derived from graph edges:

```text
application -> vite@7 -> esbuild@0.25
application -> eslint@9 -> espree@10
```

No chain is synthesized when the graph cannot resolve a parent.

## Blast radius

Blast radius performs a reverse breadth-first traversal starting at every
installed node for the target package. It counts unique parent nodes reachable
through `dependents`.

The label combines count and dependency role:

- none: no reverse dependent node;
- low: small, bounded impact;
- medium: multiple dependents;
- high/extreme: broad impact or foundational framework/runtime role.

The numeric count is always printed beside the label. It is the evidence users
should rely on when labels are close to a boundary.

## Upgrade risk

Upgrade risk is high when there are high/critical active findings, a broad
reverse dependency set, or at least three installed major lines. It is medium
when there are dependents, findings, or two major lines. Otherwise it is low.

This model does not read a changelog automatically. Before upgrading, review
the upstream release notes and run the project's tests.

## Usage scanner limits

The scanner recognizes literal static imports, literal dynamic imports, and
literal `require()` calls. Computed module names cannot be resolved safely:

```js
await import(packageNameFromUserInput);
```

Framework configuration, package scripts, CI files, workspace declarations,
peer requirements, and build-plugin references provide additional evidence.
Unknown evidence stays unknown; `explain` does not invent a caller.
