# Scoring and confidence

This document describes the deterministic scoring and evidence heuristics used
by `@danijsrr/pkg-ct`.

## Health score

The overall health score is a weighted average of nine category scores:

| Category | Default weight |
| --- | ---: |
| security | 1.5 |
| compatibility | 1.3 |
| maintainability | 1.2 |
| hygiene | 1.0 |
| duplication | 1.0 |
| install performance | 1.0 |
| freshness | 0.9 |
| runtime impact | 0.8 |
| bundle impact | 0.8 |

Grades are A (90-100), B (75-89), C (60-74), D (40-59), and F
(5-39).

### Root-cause grouping

Before calculating a category deduction, findings are grouped by:

1. package family;
2. finding type;
3. severity.

Only the highest confidence in each group contributes to the raw signal. This
prevents repeated occurrences of one transitive problem from being scored as
many independent root causes.

### Formula

```text
raw signal = sum(severity points * highest group confidence)
deduction  = ln(1 + raw signal) * 6.5 * min(1, category weight)
score      = max(category floor, round(100 - deduction))
```

Severity points are:

| Severity | Points |
| --- | ---: |
| info | 1 |
| low | 3 |
| medium | 7 |
| high | 14 |
| critical | 24 |

The normal category floor is 15. It drops to 10 with at least two critical
findings and 5 with at least five critical findings. The overall score never
drops below 5.

This is a calibration model, not a probability model. Compare a repository to
its earlier runs and inspect its category evidence.

## Usage confidence

Usage confidence is the sum of distinct evidence-signal weights, capped at 100.
Repeated files increase the visible file count but do not repeatedly add the
same weight.

| Evidence signal | Contribution |
| --- | ---: |
| Static source import | +40 |
| Config file reference | +20 |
| Dynamic import | +15 |
| Runtime `require()` | +15 |
| Build plugin referenced by config | +15 |
| Package script | +10 |
| Framework metadata | +10 |
| Workspace declaration | +10 |
| Peer dependency usage | +10 |
| CI reference | +5 |
| Naming-only heuristic | +5 |
| No evidence | +0 |

Example:

```text
Source imports          +40
Config usage            +20
Dynamic imports         +15
Package scripts         +10
                         ---
Total                     85
```

The values are explicit heuristics. They measure the breadth of independently
observed evidence. They are not the measured probability that a package is
used.

A concrete low-weight signal still establishes use. For example, a package
seen only in a dynamic import is not reported as unused merely because its
confidence total is 15.

## Safe-removal heuristic

Safe-removal probability starts from the declaration type and is capped by the
strongest observed risk:

| Evidence | Maximum safe-removal estimate |
| --- | ---: |
| Core runtime/framework | 2% |
| Static source import | 8% |
| Peer requirement or reverse dependents | 10% |
| Dynamic import or runtime require | 12% |
| Config/build-plugin reference | 15% |
| Package script/workspace reference | 20% |
| CI reference | 30% |
| Naming-only heuristic | 55% |
| Development dependency, no evidence | 95% |

These values are conservative decision aids. Always validate removal through
the project's build and test suite.

## Duplicate severity

Duplicate severity follows version distance:

- patch-only: low;
- one major line with different minors: low;
- two major lines: medium;
- three or more major lines: high;
- unparseable/non-SemVer distance: low, because breakage cannot be proved.

The calibration follows [Semantic Versioning](https://semver.org/): patch and
minor changes are backward-compatible categories, while major changes may
break the public API. Major-zero packages remain less stable by specification,
so the result is still a heuristic and the introducer evidence should be
reviewed.

## Release readiness

Release readiness uses the same findings shown by doctor:

- critical finding count;
- required peer conflicts (optional peers do not block);
- high/critical security findings;
- scaled duplicate-family threshold;
- overall health score of at least 60.

Duplicate thresholds start at 10 for fewer than 200 packages, 20 for 200-499,
and 35 for 500 or more. Recognized frameworks add 5. Monorepos add 5-10 based
on workspace count. Every factor is printed in the report.
