# Security Policy

## Supported versions

Security fixes are accepted for the latest published minor release of
`@danijsrr/pkg-ct`.

| Version | Supported |
| --- | --- |
| 0.6.x | Yes |
| 0.5.x | Best effort |
| < 0.5 | No |

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability.

Use GitHub private vulnerability reporting if it is enabled for the repository,
or email the maintainer through the contact method listed on the npm package
profile.

Include:

- affected version;
- operating system and Node.js version;
- reproduction steps;
- whether the issue requires a malicious package, malicious project, or normal
  project input;
- any logs that do not contain secrets.

## Scope

In scope:

- unsafe file handling in the CLI;
- incorrect execution of package scripts;
- dependency metadata handling that can corrupt reports or leak private data;
- vulnerabilities in shipped runtime dependencies.

Out of scope:

- vulnerabilities in a project analyzed by pkg-ct;
- package-manager advisories that pkg-ct only reports;
- missing support for a private registry convention unless it creates a security
  boundary issue.

## Disclosure

The maintainer will acknowledge valid reports, investigate, publish a patched
release when needed, and document the fix in the changelog.
