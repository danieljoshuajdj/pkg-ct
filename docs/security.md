# Security prioritization and package activity

`pkg-ct security` enriches npm audit findings with local reachability and
production-role evidence. It does not replace the advisory source.

## Vulnerability fields

Every vulnerability includes:

| Field | Source |
| --- | --- |
| Severity | npm audit |
| Reachability | source/runtime references plus installed graph |
| Exploitability | `UNKNOWN` unless upstream metadata proves it |
| Production relevance | manifest declaration and installed `dev` flags |
| Reason | plain-language summary of the evidence |
| Priority | severity, reachability, and production relevance |

Example:

```text
[HIGH] shell-quote
  Severity: HIGH
  Reachability: LOW
  Exploitability: UNKNOWN
  Production relevance: Development only
  Reason: Installed nodes are development-only, so the advisory is not
          reachable in the production tree.
  Priority: LOW
```

Development-only findings are not hidden. They are deprioritized so reachable
production findings are addressed first.

Exploitability and reachability are intentionally separate. A package can be
reachable without a known working exploit, and an advisory can describe an
exploit that is not reachable through this project.

See the official [npm audit documentation](https://docs.npmjs.com/cli/commands/npm-audit/)
for advisory submission, remediation, and exit-code behavior.

## Package activity

An old publish date is not itself a security issue. Activity classification
combines:

- latest npm publish age;
- npm deprecation metadata;
- whether the installed release is current;
- weekly downloads;
- maintainer count;
- public GitHub repository `archived` and `pushed_at` metadata when available.

States are:

| State | Evidence |
| --- | --- |
| Recently updated | Latest npm release within one year |
| Old maintained | Old release and repository push within one year |
| Old inactive | Old release plus old repository activity, or no maintainers |
| Long-term stable | Heuristic: current old release, substantial downloads, no conflicting repository inactivity |
| Deprecated | npm deprecation metadata |
| Archived | repository host reports `archived=true` |
| Old unverified | Old release without enough repository evidence |
| Unknown | Publish date missing or invalid |

The long-term-stable state is a documented heuristic, not an upstream status.
It prevents popularity and a quiet release cadence from being mislabeled as
abandonment, while keeping the supporting evidence visible.

Offline mode does not estimate age from a major or minor version number.

GitHub activity fields come from the official
[Get a repository API](https://docs.github.com/en/rest/repos/repos#get-a-repository).
Private or rate-limited repositories can leave activity unknown.

## Install scripts and native builds

Install lifecycle scripts and native compilation remain supply-chain and CI
signals. They are not automatically malicious. The report lists the exact
script/package evidence so teams can review trust and reproducibility.
