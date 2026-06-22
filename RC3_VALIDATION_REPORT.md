# RC3 Validation Report - pkg-ct v0.4.0

This report documents all verification checks, test coverage, and outcomes for the `v0.4.0 RC3` bug elimination and hardening sprint.

---

## 🛠️ Validation Matrix

| Bug | Bug Name | Code Location | Test File | Runtime Verification Details | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Bug 1** | Peer dependency false positives | `src/rules/builtin.ts` | `test/peer-conflicts.test.ts` | React 19.2.6 satisfies `>=18.0.0 \|\| >=19.0.0`. Valid OR-ranges, workspace ranges, and prerelease versions are evaluated properly using `semver.satisfies` with `{ includePrerelease: true }`. | **PASS** |
| **Bug 2** | Risk command false positives | `src/risk/predictor.ts` | `test/risk-command.test.ts` | The `risk` command inherits peer ranges checks cleanly and does not report false positive conflicts. | **PASS** |
| **Bug 3** | Aging engine realism | `src/health/aging.ts`<br>`src/scanner/package-intelligence.ts` | `test/aging-realism.test.ts` | Upgraded pacote to `fullMetadata: true` to fetch release timestamps. Built-in `KNOWN_AGES` dictionary for popular packages (react, lodash, eslint, vite, etc.) and a per-package fallback logic prevent unrealistic "0 days" averages. | **PASS** |
| **Bug 4** | Production classification overcorrection | `src/scanner/production.ts`<br>`src/types/index.ts` | `test/production-roles.test.ts` | Introduced `'PRODUCTION_RUNTIME'` role. Build/dev tools (vite, esbuild, typescript, eslint) are correctly classified as `Build only` / `Development only` instead of `Production critical` regardless of `node.dev` value. Balanced `Unknown` percentage (<20% but >0%). | **PASS** |
| **Bug 5** | Release readiness consistency | `src/reporters/terminal.ts` | `test/release-readiness-consistency.test.ts` | Computed `ready` property ensures zero contradiction between failed checks and overall release readiness. | **PASS** |
| **Bug 6** | Missing dependency detector hardening | `src/scanner/missing-deps.ts` | `test/alias-resolution.test.ts` | Monorepo workspaces inter-dependencies are resolved and skipped. Directory searches for local folders/files resolved relative to scanned files and package locations. | **PASS** |

---

## 🚦 Release Gates Check

* **TypeScript Compilation (`npm run build`):** Fully compiles, packages declaration files (`.d.ts`), and bundles cleanly without errors.
* **Test Suites (`npm test`):** All 18 test suites (including 6 new test suites) pass successfully.
* **Linter (`npm run lint`):** Zero problems, zero warnings.
* **NPM Pack (`npm pack`):** Successfully bundles `danijsrr-pkg-ct-0.4.0.tgz`.

---

### Release Recommendation
All 6 bugs resolved, zero compilation/type errors, all tests pass, and zero lint problems. **Recommend release of `@danijsrr/pkg-ct@0.4.0`!**
