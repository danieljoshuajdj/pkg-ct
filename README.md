# 📦 PKG-CT: The Dependency Observability CLI & Maintenance Layer

> **The AI-Powered Dependency Observability and Self-Healing Maintenance System for Modern Node.js Projects.**

---

## 🏛️ SECTION 1: What is pkg-ct? (The Story of the City Inspector)

Imagine your software project is not just a collection of text files, but a bustling, growing **city**.

* **The Buildings:** Every direct package you install is a building. The primary structures (like React, Express, or NestJS) are the skyscrapers and central town halls. Your utility libraries are the shops, schools, and offices.
* **The Infrastructure Grid:** Beneath the surface lies a massive network of pipes, power grids, subways, and telecommunication lines. These are your **transitive dependencies**—the packages installed by other packages. You did not install them directly, but without them, your city goes dark.
* **The Abandoned Structures:** Over time, some buildings are abandoned by their architects. These are **deprecated packages** or unmaintained libraries. They sit vacant, accumulating dust and structural weaknesses, waiting for a security vulnerability to start a fire.
* **The Ghost Buildings:** Some buildings were constructed but are completely empty and boarded up. Nobody works there; nobody visits. These are **unused dependencies**—declared in your registry but never imported in your code. They consume valuable space (increases your `node_modules` size) and make the city map confusing.
* **The Franchise Clones:** Sometimes, multiple versions of the same franchise (e.g., Starbucks or McDonald's) are constructed on the exact same block. This is **dependency duplication**. You might have `lodash@4.17.21` and `lodash@4.17.15` sitting right next to each other because different parts of your infrastructure did not coordinate their version plans.
* **The Incompatible Grid Links:** When you try to connect a building that runs on a 220V power grid to a local line that only outputs 110V, things break. This is a **peer dependency conflict**.
* **The Hazardous Zones:** Sometimes, a building contains a gas leak or chemical hazard. These are **security vulnerabilities** that expose your city's residents to external threats.
* **The Specialized Construction Sites:** Some buildings are made of steel that must be forged on-site using specialized heavy machinery (compilers). These are **native modules** that require `node-gyp` or C++ build chains, slowing down construction workers (causing long build and deployment times).
* **The Hidden Side Alleys:** Some contractors build secret passages where they run custom, uninspected activities. These are **package lifecycle scripts** (`preinstall`, `postinstall`) that execute arbitrary scripts when packages are fetched.

In this metaphor, **`pkg-ct` is the City Inspector.**

Equipped with blueprints (AST scanners), structural history (NPM registry metadata), and an advanced diagnostic engine, `pkg-ct` walks through your city. It doesn't just list the buildings; it checks the foundations, traces the wires, maps the pipes, calculates safety grades, runs risk simulations, and drafts a step-by-step remediation plan to keep your city healthy, secure, and ready for release.

---

## 🧸 SECTION 2: What is a Dependency? (The Child's Guide)

Before we start inspecting our codebase city, let's learn how its buildings are made.

### 1. The Package
A **package** is a box of pre-written code created by other programmers. Instead of writing your own math formulas or custom animations from scratch, you download a package that has already done it. It is like buying a pre-assembled LEGO block.

### 2. NPM (The Package Marketplace)
**npm** (Node Package Manager) is the world's largest toy store for code. Programmers from all over the world upload their packages to this store. When you need a package, you ask `npm` to fetch it for you.

### 3. package.json (The Shopping List)
Your project has a special file called `package.json`. It is your **shopping list**. It tells the computer exactly which packages your project needs to work.
Here is an example:
```json
{
  "name": "my-toy-app",
  "dependencies": {
    "react": "^19.0.0"
  }
}
```
This tells npm: *"Go fetch React version 19 so I can build my app!"*

### 4. node_modules (The Warehouse)
When npm downloads the packages from your shopping list, it puts them in a folder called `node_modules`. This folder is your **warehouse**. It contains all the downloaded code. Warning: it can grow very large and heavy!

### 5. The Lockfile (package-lock.json / pnpm-lock.yaml)
The **lockfile** is a detailed receipt. While `package.json` says *"I want React version 19,"* the lockfile writes down: *"I downloaded exactly React version 19.0.0 from server XYZ at 2:05 PM, and verified its safety signature."* It makes sure that every computer builds the exact same city.

### 6. Transitive Dependency (The Downstream Friend)
If you invite a friend (Direct Dependency) to your house, and they bring their three siblings (Transitive Dependencies) with them, your house now has four guests! 
In code, if you install a package like `express`, it will install dozens of other packages it needs to work. Those extra packages are transitive dependencies.

### 7. Peer Dependency (The Required Partnership)
A **peer dependency** is a package that says: *"I will work for you, but only if you already have my best friend installed."* For example, the package `react-dom` will work only if you also install `react`. If you don't install its partner, you get a peer dependency mismatch.

---

## ⚖️ SECTION 3: Why pkg-ct Exists (Observability vs. Checking)

In the Node.js ecosystem, we already have tools to inspect dependencies. Why did we build `pkg-ct`?

| Traditional Tools | The `pkg-ct` Observability Layer |
| :--- | :--- |
| **"What is installed?"** | **"Why is it installed, and what happens if I touch it?"** |
| Lists version numbers in a flat table. | Traces every dependency to its source imports, configurations, and scripts. |
| Suggests removing packages blindly. | Predicts safe removal probabilities and models the blast radius of removal. |
| Reports raw list of CVE vulnerabilities. | Triages vulnerabilities by production relevance, deprioritizing dev-only issues. |
| Hardcodes output reports. | Computes a multi-criteria Health Score with transparent grade breakdowns. |
| Offers manual command runs. | Connects a deterministic heuristic engine with evidence-driven AI fix plans. |

### The Business and Architecture Value

1. **For Engineering Managers:** 
   * **Reduce Bloat:** Keep bundle sizes low and build pipelines fast.
   * **Enforce Quality Standards:** Block deployments in CI if the project health drops below acceptable limits.
   * **Mitigate Legal Risks:** Track package licenses and identify inactive/deprecated projects before they become liabilities.
2. **For Senior Architects:**
   * **Blast Radius Analysis:** Instantly see which packages depend on a shared library before upgrading or removing it.
   * **Version Alignment:** Standardize dependency ranges across large monorepos to eliminate version drift.
   * **Explainable AI Advice:** AI recommendations are fully backed by graph evidence. No LLM hallucinations are allowed to compromise configuration safety.

---

## 📥 SECTION 4: Installation

To install `pkg-ct` globally on your system, open your terminal and run:

```bash
npm install -g @danijsrr/pkg-ct
```

Let's break down this command line-by-line:
1. **`npm`**: The package manager tool. It is the command that talks to the npm registry store.
2. **`install`** (or **`i`**): Tells npm to download packages.
3. **`-g`** (or **`--global`**): Tells npm to install this package globally on your operating system. This makes the `pkg-ct` command available anywhere on your machine, not just inside one folder.
4. **`@danijsrr/pkg-ct`**: The unique name of this package on the registry.

### Beginner Examples

* **Checking Installation:**
  After installing, verify it works by printing the version:
  ```bash
  pkg-ct --version
  ```
  *Expected Output:* `0.4.0`

* **Running without Global Install:**
  If you do not want to install it globally, you can run it on the fly using `npx` (Node Package Executor):
  ```bash
  npx @danijsrr/pkg-ct doctor
  ```

---

## 🗺️ SECTION 5: First Scan Tutorial

Let's walk through your very first inspection scan. Go to the directory of your Node project and run:

```bash
pkg-ct scan
```

### The Output Diagram

When you run `pkg-ct scan`, the CLI prints a structured inventory sheet that looks like this:

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PKG-CT Scan Output
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Packages: 245
Duplicate package families: 3
Deprecated packages: 1
Peer dependency issues: 2
Install script packages: 4
Native build risks: 0
Lockfile: npm (package-lock.json)
Scanned in 142ms
```

### Line-by-Line Explanation

1. **`Packages: 245`**
   * *Meaning:* The total number of packages installed in your `node_modules` tree, including direct and transitive dependencies.
2. **`Duplicate package families: 3`**
   * *Meaning:* You have 3 packages installed in multiple, conflicting versions. For example, you might have two versions of `safe-buffer` in the tree.
3. **`Deprecated packages: 1`**
   * *Meaning:* One package in your tree is officially deprecated by its author. It should be replaced.
4. **`Peer dependency issues: 2`**
   * *Meaning:* Two packages are missing their required partners or are receiving versions outside of their expected ranges.
5. **`Install script packages: 4`**
   * *Meaning:* Four installed packages execute custom lifecycle scripts during installation. These scripts should be reviewed to prevent security breaches.
6. **`Native build risks: 0`**
   * *Meaning:* No packages require C++ compiling on-site. This is excellent for build speeds.
7. **`Lockfile: npm (package-lock.json)`**
   * *Meaning:* `pkg-ct` successfully detected your package manager type (npm) and read its lockfile format.
8. **`Scanned in 142ms`**
   * *Meaning:* The time it took to parse the physical node tree and compute the inventory.

---

## 📖 SECTION 6: Complete Command Reference

This reference describes every command available in `pkg-ct`.

### 1. `scan`
* **What it does:** Provides a rapid inventory of your dependency tree.
* **When to use it:** As a pre-commit hook or quick developer healthcheck to see numbers of packages, duplicates, and warnings.
* **Sample Output:**
  ```text
  pkg-ct scan
  Packages: 110
  Duplicate package families: 0
  Deprecated packages: 0
  Peer dependency issues: 0
  Install script packages: 2
  Native build risks: 1
  Lockfile: npm
  Scanned in 88ms
  ```
* **How to understand the output:** Focus on duplicates and peer conflicts. If these numbers are above zero, run `pkg-ct doctor` for a detailed diagnostic.
* **Common Mistakes:** Running it without installing dependencies first. `pkg-ct` reads the actual installed tree, not just the `package.json` file.
* **Real-world Example:** Checking a pull request branch to ensure the developer did not introduce new duplicate package versions.

---

### 2. `health`
* **What it does:** Calculates your project's overall Health Score and prints a category breakdown.
* **When to use it:** In CI pipelines or dashboards to track dependency health grades.
* **Sample Output:**
  ```text
  pkg-ct health
  [B] Project Health Score: 85/100 (B)
  Analyzed 245 packages in 320ms

  Score Breakdown
  ██████████  hygiene              100/100  No unused or legacy dependencies detected.
  ██████████  security             100/100  No active vulnerabilities.
  ██████████  freshness            100/100  All direct dependencies are up to date.
  ████████░░  duplication           80/100  3 duplicate package families.
  ███████░░░  compatibility         70/100  2 peer dependency conflicts.
  ```
* **How to understand the output:** The breakdown bars show which metrics are lowering your overall score.
* **Common Mistakes:** Thinking a low score means your code is broken. It means your dependency hygiene needs maintenance.
* **Real-world Example:** Enforcing a quality gate where branches must score at least 80/100 to merge.

---

### 3. `analyze`
* **What it does:** Computes the full dependency intelligence graph and prints details on top findings, breakdowns, and plans.
* **When to use it:** When you want a complete, single-screen summary of all findings without monorepo or security-specific extensions.
* **Sample Output:**
  ```text
  pkg-ct analyze
  [B] Project Health Score: 78/100 (B)
  
  Top Findings
  MEDIUM   Multiple major versions of lodash installed
  HIGH     eslint-plugin-react expects peer eslint@^8 but found eslint@9.1.0
  
  Health Breakdown
  ...
  Remediation Plan
  -> Deduplicate lodash (impact:MEDIUM difficulty:easy)
     $ npm dedupe
  ```
* **How to understand the output:** Review the "Top Findings" section first. Resolving these items will yield the largest score improvements.
* **Common Mistakes:** Reviewing transitive warnings that have very low severity.
* **Real-world Example:** Doing a bi-weekly codebase audit.

---

### 4. `doctor`
* **What it does:** The flagship senior-architect report. Aggregates inventory, health breakdowns, prioritized actions, root causes, AI fix plans, and release readiness.
* **When to use it:** The primary command for auditing any codebase. Recommended before major releases.
* **Sample Output:**
  ```text
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    PKG-CT DEPENDENCY DOCTOR
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [B] Health Score: 79/100 Grade: B
  
  INVENTORY
  ──────────────────────────────────────────────────
    Packages:           481
    Duplicate families: 3
  
  🏆 TOP ACTIONS
  ──────────────────────────────────────────────────
    [1] Multiple major versions of chalk installed
        Impact: HIGH  Effort: MEDIUM
        → Align version ranges in package.json
  
  🛠 AI FIX PLAN
  ──────────────────────────────────────────────────
    Step 1: Deduplicate packages
      $ npm dedupe
      Expected gain: +12 pts  ████████░░ 80%
  ```
* **How to understand the output:** Follow the "AI FIX PLAN" steps in order. They represent the optimal path to a healthy repository.
* **Common Mistakes:** Ignoring the "Release Readiness" section. A project can have a B grade but still be blocked due to critical peer conflicts.
* **Real-world Example:** Preparing an enterprise app for a production release.

---

### 5. `roast`
* **What it does:** Generates a humorous, light-hearted but technically accurate roast of your dependencies.
* **When to use it:** Sharing with your team, posting on social media, or injecting some fun into code audits.
* **Sample Output:**
  ```text
  Dependency Roast
  Your node_modules folder is so heavy it has its own gravitational pull (481 packages).
  3 duplicate families. A classic case of version hoarding.
  1 deprecated package. Running vintage code, are we?
  Health score: 79/100. Average, like your tests.
  ```
* **How to understand the output:** Read the jokes, but notice the underlying numbers—they highlight actual issues in your repository.
* **Common Mistakes:** Getting offended. The roast is based on real findings!
* **Real-world Example:** Sharing a screenshot in Slack to nudge developers to deduplicate packages.

---

### 6. `missing`
* **What it does:** Scans your source files to find packages you import in code but forgot to declare in your `package.json`.
* **When to use it:** When your code runs fine locally but crashes in production or CI with "Cannot find module".
* **Sample Output:**
  ```text
  Missing Dependencies
  Scanned 84 source files
  
  [HIGH] lodash
    Referenced in:
      - src/utils/format.ts
      - src/components/Table.tsx
  ```
* **How to understand the output:** Any package listed here must be added to your `package.json`.
* **Common Mistakes:** Assuming because it works locally, nothing is missing. Your local environment might have it globally installed or left over in `node_modules` from an old branch.
* **Real-world Example:** Fixing build crashes on Vercel/Netlify.

---

### 7. `explain`
* **What it does:** Tells you why a package was installed, who brought it in, its AST usage footprint, and what happens if you delete it.
* **When to use it:** When you see a weird package in your tree and want to know: *"Why is this here?"*
* **Sample Output:**
  ```text
  lodash
  Role:                 TRANSITIVE
  Why it exists:
    Referenced by 3 dependents.
  Dependency chain:
    my-app → express → body-parser → lodash
  Safe removal prob.:   2%
  
  🧠 AI Summary
    lodash is a utility library imported by 2 internal files and required by express.
    Impact: Removing lodash will break request parsing and routing.
    Risk: EXTREME
  ```
* **How to understand the output:** Look at the "Dependency chain". It traces the exact line of ancestry from your root app to the package.
* **Common Mistakes:** Trying to delete a transitive package from `package.json` directly. You must fix the parent package that introduced it.
* **Real-world Example:** Auditing a large security vulnerability in a deep transitive dependency.

---

### 8. `blast`
* **What it does:** Calculates the blast radius of a package—meaning, how many files and other packages will break if this package is modified or removed.
* **When to use it:** Before refactoring, removing, or making major updates to a package.
* **Sample Output:**
  ```text
  Dependency Blast Radius: rimraf
  Risk Level: MEDIUM
  
  Direct dependents (2):
    - ts-node
    - rimraf-cli
  
  Transitive dependents (12):
    - @types/node
    ...
  ```
* **How to understand the output:** A high blast radius count means you must be extremely careful when upgrading this package.
* **Common Mistakes:** Assuming a small package always has a low blast radius. Simple helper utilities often have the largest blast radii.
* **Real-world Example:** Determining the risk of upgrading a helper like `tslib` or `uuid`.

---

### 9. `risk`
* **What it does:** Evaluates peer dependency, lockfile, and engine conflicts *before* you run `npm install`.
* **When to use it:** When checking if a package is safe to add to your project.
* **Sample Output:**
  ```text
  UPGRADE RISK: HIGH  →  vite@latest
  
  POTENTIAL CONFLICTS
    [CONFLICT] vite
      Reason:    Peer dependency mismatch
      Peer:      react@^18
      Current:   react@19.0.0
      Expected:  ^18
      Confidence: 87%
      Chain:     my-app → vite
  ```
* **How to understand the output:** Check the "POTENTIAL CONFLICTS" section to see if the new package fits into your existing ecosystem.
* **Common Mistakes:** Running the command with a package that has no version specified, when you specifically wanted to test a beta/next version.
* **Real-world Example:** Verifying if a new component library is compatible with your React 19 app before installing it.

---

### 10. `upgrade`
* **What it does:** Predicts compile and runtime breakages if you bump a package to a specific version.
* **When to use it:** When planning dependency update cycles.
* **Sample Output:**
  ```text
  Upgrade Risk Advisor
  Package:  typescript
  Current:  4.9.5
  Target:   5.4.2
  Risk:     MEDIUM
  
  Reasons:
    - 2 direct dependents use strict compilation rules
    - Potential type mismatches in src/types/index.ts
  ```
* **How to understand the output:** Pay attention to the "Reasons" and "Potentially affected" lists. They point to the files most likely to experience type compiler errors.
* **Common Mistakes:** Upgrading multiple major versions without checking intermediate release changelogs.
* **Real-world Example:** Planning a TypeScript version bump across a large engineering team.

---

### 11. `security`
* **What it does:** Performs a deep security audit, classifying vulnerabilities by production reachability and identifying inactive or abandoned maintainer packages.
* **When to use it:** For security reviews and compliance reporting.
* **Sample Output:**
  ```text
  PKG-CT SECURITY REPORT
  
  VULNERABILITIES
    [HIGH] target-package
      Prototype Pollution in sub-dep
      Production Relevance: Production Critical
      Priority: HIGH
  
  ABANDONMENT RISK
    [RISK] old-json-parser (no release in 6 years, 1 maintainer)
  ```
* **How to understand the output:** Focus on "Production Critical" vulnerabilities. You can defer fixing "Development Only" issues if they are blocked by complex upgrade constraints.
* **Common Mistakes:** Treating all vulnerabilities as equally dangerous. A prototype pollution in a test framework runner is far less dangerous than one in your production web server.
* **Real-world Example:** Performing security triage for a SOC2 audit compliance check.

---

### 12. `production`
* **What it does:** Classifies all installed packages into production critical, build-only, dev-only, and unknown roles.
* **When to use it:** When auditing your production bundle size and server deployment footprints.
* **Sample Output:**
  ```text
  Package Production Relevance
  
  Production critical (12):
    - express@4.18.2 (role: CORE_RUNTIME)
    - pg@8.11.3 (role: CORE_RUNTIME)
  
  Build only (4):
    - vite@5.1.4 (role: BUILD_TOOL)
  ```
* **How to understand the output:** Production critical packages are shipped to your users or run on your servers. Keep this list as small and clean as possible.
* **Common Mistakes:** Finding build tools in the production critical section due to incorrect placements in `package.json` dependencies vs devDependencies.
* **Real-world Example:** Auditing Docker container image footprints.

---

### 13. `timeline`
* **What it does:** Evaluates package age and technical lag over the lifespan of your project.
* **When to use it:** To assess technical debt and plan refactoring roadmaps.
* **Sample Output:**
  ```text
  Dependency Health Timeline
  Average dependency age: 840 days (2.3 years)
  Technical lag score:    140 (HIGH LAG)
  Major versions behind:  14
  ```
* **How to understand the output:** A high technical lag score means your codebase is drifting far behind the active open-source ecosystem.
* **Common Mistakes:** Trying to fix all lag in one PR. This will cause massive merge conflicts and bugs.
* **Real-world Example:** Justifying a tech debt budget allocation to management.

---

### 14. `workspace`
* **What it does:** Audits monorepo workspaces to detect version drift—when different packages in the same repository use different version ranges of the same dependency.
* **When to use it:** In pnpm, Yarn, or npm monorepos.
* **Sample Output:**
  ```text
  PKG-CT WORKSPACE INTELLIGENCE
  
  VERSION DRIFT  (2 packages)
    [MEDIUM] chalk
      ^4.1.2            →  apps/web, packages/ui
      ^5.0.0            →  apps/server
  ```
* **How to understand the output:** Aligns version ranges to prevent multiple versions of the same package from being bundled into your monorepo outputs.
* **Common Mistakes:** Manually changing ranges instead of using workspace configuration commands.
* **Real-world Example:** Tidying up a Turborepo codebase.

---

### 15. `ci`
* **What it does:** Evaluates quality gates and emits machine-readable logs and status reports.
* **When to use it:** In GitHub Actions, GitLab CI, or Jenkins.
* **Sample Output:**
  ```text
  pkg-ct CI Quality Gates
  Status:     FAIL
  Score:      55/100 (min: 70) FAIL
  Severity:   fail-on=high VIOLATIONS FOUND
  ```
* **How to understand the output:** Returns an exit code of `0` on success and non-zero on failure, causing the CI pipeline to pass or fail.
* **Common Mistakes:** Setting the `min-score` threshold too high on day one, which blocks developer workflows. Start low and raise it gradually.
* **Real-world Example:** Preventing insecure code from being merged into your `main` branch.

---

## 📊 SECTION 7: Understanding Scores

`pkg-ct` uses a grading system from **A (100-90)** to **F (below 40)**. Here is how your scores are calculated.

```text
  Health Score (Overall)
  ├── Duplication Score (Weight: 1.0)
  ├── Compatibility Score (Weight: 1.4)
  ├── Security Score (Weight: 1.8)
  ├── Freshness Score (Weight: 0.8)
  └── Maintainability Score (Weight: 1.2)
```

### The 7 Score Categories

#### 1. Overall Health Score
* **What it is:** The main index representing the overall robustness of your project.
* **How it is calculated:** Starts at `100`. Deductions are subtracted based on findings from each category multiplied by their category weight.
* **Impact of 0:** An F grade means your project is fragile, contains security risks, and will experience install failures on clean environments.

#### 2. Duplication Score
* **What it is:** Measures how clean your tree is from duplicate version families.
* **What affects it:** Every package family with multiple major/minor versions installed subtracts from this score.
* **Fixing it:** Run `npm dedupe` or align ranges in your `package.json`.

#### 3. Compatibility Score
* **What it is:** Measures how well peer dependencies and Node engine ranges are satisfied.
* **What affects it:** Peer dependency mismatches or dependencies that don't support your active Node version.
* **Fixing it:** Upgrade packages or use alignment resolutions.

#### 4. Security Score
* **What it is:** Evaluates active vulnerabilities in your dependency tree.
* **What affects it:** Known CVEs from `npm audit`. Critical and high vulnerabilities cause massive score drops.
* **Fixing it:** Run `npm audit fix` or upgrade the compromised dependencies.

#### 5. Freshness Score
* **What it is:** Measures how close your dependencies are to their latest published releases.
* **What affects it:** Packages that are months or years behind their latest versions.
* **Fixing it:** Set up tools like Dependabot or execute manual upgrades.

#### 6. Maintainability Score
* **What it is:** Evaluates maintainer activity and deprecation signals.
* **What affects it:** Deprecated packages or libraries with zero updates for several years.
* **Fixing it:** Replace inactive libraries with modern alternatives.

#### 7. Install Performance Score
* **What it is:** Estimates how fast your project installs from scratch.
* **What affects it:** The number of native C++ modules, large bundle weights, and deep transitive chains.
* **Fixing it:** Replace heavy modules (like `node-sass`) with pure JS alternatives (like `sass`).

---

## 🧠 SECTION 8: Understanding AI Features & Trust Framework

AI features in `pkg-ct` are designed around the **Explainable AI Heuristics Principle**. 

> [!IMPORTANT]
> **The AI does NOT guess.** Unlike generic chatbot systems, the AI layer in `pkg-ct` cannot hallucinate recommendations. It only summarizes, formats, and explains deterministic evidence collected by the core scanner engine.

```text
Determined Evidence (AST, Lockfile, Registry)
             │
             ▼
   Explainable AI Layer (Heuristic Mapper)
             │
             ▼
   Traceable Markdown CLI Outputs (No Hallucinations)
```

### AI Core Observabilities

* **AI Summary:** Provides context-aware summaries of package usage in `explain`. It translates complex graph paths into human sentences: *"Required by Next.js, imported by 12 files."*
* **AI Priority Queue:** Ranks issues by a mix of severity, production impact, and effort to create a prioritized todo list.
* **AI Root Cause Analysis:** Clusters multiple duplicate warnings into a single systemic problem: *"Triggered by packages X and Y; align range Z."*
* **AI Fix Plan:** Outlines sequential CLI commands with score projections.
* **AI Release Readiness:** Runs compliance checklists to determine if a codebase is ready for production.
* **AI Security Triage:** Cross-references vulnerability reports with production AST scans to prioritize critical server-side flaws.
* **AI Workspace Advice:** Identifies monorepo drift and recommends version alignments.

---

## 🏃 SECTION 9: Real Project Walkthroughs

### Walkthrough 1: Small React App

#### The Setup
A frontend app using React 19, TailwindCSS, and ESLint.

#### The Command
```bash
npx @danijsrr/pkg-ct doctor
```

#### The Output
```text
[A] Health Score: 98/100 Grade: A
    124 packages · 1 findings

INVENTORY
  Packages: 124
  Duplicate families: 0
  Peer conflicts: 0

UNUSED DEPENDENCIES
  [!] eslint-config-prettier
    usage confidence: 90%
    safe removal probability: 95%
    Recommendation: Keep; eslint-config-prettier is a passive config package.
```

#### Interpretation & Action
The score is excellent (98/100). The single finding is a passive ESLint config package. Since it is loaded by ESLint (configuration evidence), `pkg-ct` correctly flags it with a high confidence score and recommends keeping it. No action required!

---

### Walkthrough 2: Next.js App

#### The Setup
A production Next.js app with server components, Postgres drivers, and styling utilities.

#### The Command
```bash
npx @danijsrr/pkg-ct doctor --audit
```

#### The Output
```text
[C] Health Score: 68/100 Grade: C
    512 packages · 14 findings

🏆 TOP ACTIONS
  [1] Multiple major versions of semver installed (v6.3.1, v7.5.4)
      Impact: HIGH  Effort: LOW
      → Run npm dedupe
  [2] ip package has high-severity vulnerability
      Impact: CRITICAL  Effort: MEDIUM
      → Upgrade ip to >=2.0.1
```

#### Interpretation & Action
1. Run `npm dedupe` to align the `semver` utility.
2. Upgrade the `ip` package to patch the security vulnerability.
3. Run the doctor again to confirm the health score rises back to `A`.

---

### Walkthrough 3: Node API

#### The Setup
A backend server built using Express and Prisma.

#### The Command
```bash
npx @danijsrr/pkg-ct security
```

#### The Output
```text
VULNERABILITIES
  [CRITICAL] jsonwebtoken
    Production Relevance: Production Critical
    Priority: HIGH
  [LOW] mocha
    Production Relevance: Development Only
    Priority: LOW
```

#### Interpretation & Action
Prioritize patching `jsonwebtoken` immediately. You can defer fixing `mocha` since it is a testing utility that does not run on production API servers.

---

### Walkthrough 4: Monorepo

#### The Setup
A pnpm monorepo containing a web app, mobile app, and shared UI package.

#### The Command
```bash
npx @danijsrr/pkg-ct workspace
```

#### The Output
```text
VERSION DRIFT (1 package)
  [MEDIUM] axios
    ^1.6.0 → apps/web
    ^1.7.2 → apps/mobile
```

#### Interpretation & Action
Align `axios` to `^1.7.2` in `apps/web/package.json` to standardize network stack versions across the monorepo.

---

### Walkthrough 5: Enterprise Workspace

#### The Setup
A large enterprise workspace with hundreds of packages, run in an offline environment.

#### The Command
```bash
npx @danijsrr/pkg-ct doctor --offline
```

#### The Output
The tool skips fetching online NPM registry releases and completes the AST, graph, and security checks instantly using cached lockfile metadata, maintaining security in private corporate networks.

---

## 🛠️ SECTION 10: Customizing Heuristics with AI Learning Rules

You can customize `pkg-ct` heuristics by adding an `.ai-rules.json` file in the root of your project directory.

### The `.ai-rules.json` Schema

Here is a complete configuration example:

```json
{
  "alwaysUsed": [
    "tslib",
    "eslint-config-next"
  ],
  "neverSuggestRemoval": [
    "react",
    "react-dom"
  ],
  "preferredVersions": {
    "lodash": "^4.17.21"
  },
  "customRiskOverrides": {
    "vite": "low"
  },
  "ignorePackages": [
    "some-internal-utility"
  ]
}
```

### Parameter Explanations

1. **`alwaysUsed`**: Prevents packages from being flagged as unused, even if they have no static source imports. Useful for configuration engines or CLI plugins.
2. **`neverSuggestRemoval`**: Instructs the AI engine to never recommend uninstalling these packages.
3. **`preferredVersions`**: Standardizes preferred package versions to prevent version drift.
4. **`customRiskOverrides`**: Overrides risk predictions for specific packages.
5. **`ignorePackages`**: Completely excludes these packages from all scan assessments and score calculations.

---

## 🔍 SECTION 11: Troubleshooting & OS Compatibility

### OS Specific Advice

#### 1. Windows (CMD & Powershell)
* If you receive a script execution error on PowerShell, run:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```
* Ensure you use forward slashes in commands if running under git bash: `pkg-ct explain lodash`.

#### 2. Linux & macOS
* If global installation fails with permissions issues, avoid using `sudo`. Instead, configure a prefix directory for npm or use a node version manager like `nvm` or `fnm`.

### Package Manager Specific Advice

#### 1. npm
* Lockfile parsing works automatically. If you notice outdated registry details, clear your npm cache: `npm cache clean --force`.

#### 2. pnpm & Yarn
* Ensure `node_modules` is populated by running `pnpm install` or `yarn install` before running `pkg-ct`.

### Corporate Environments & Offline Mode
* **Proxy Networks:** Set your proxy variables in your shell environment:
  ```bash
  export HTTP_PROXY=http://proxy.company.com:8080
  ```
* **Offline Execution:** If your corporate build server has no internet access, run with `--offline` to bypass registry checks.

---

## 📋 SECTION 12: Feature Comparison Matrix

| Feature | `pkg-ct` | `depcheck` | `knip` | `npm audit` |
| :--- | :---: | :---: | :---: | :---: |
| **AST Source Scanning** | ✅ | ✅ | ✅ | ❌ |
| **Dependency Graph Tracing** | ✅ | ❌ | ✅ | ❌ |
| **Remediation Commands** | ✅ | ❌ | ❌ | ✅ |
| **Health Scoring (100-0)** | ✅ | ❌ | ❌ | ❌ |
| **AI Explainability Layer** | ✅ | ❌ | ❌ | ❌ |
| **Monorepo Version Drift** | ✅ | ❌ | ❌ | ❌ |
| **Blast Radius Modeling** | ✅ | ❌ | ❌ | ❌ |

---

## 🏗️ SECTION 13: Architectural Design

### System Processing Flow

```text
   CLI Command Call (pkg-ct doctor)
               │
               ▼
      Analyzer Orchestrator
       ├── Discover Project (workspace roots, package managers)
       ├── Parse Lockfile (npm, pnpm, yarn)
       └── Read Source Files (AST import parser)
               │
               ▼
        Evidence Engine
       ├── Map code usages to declared dependencies
       ├── Query NPM registry (package age, maintainers, releases)
       └── Execute security audit (CVE mappings)
               │
               ▼
        Scoring Engine
       ├── Deduct points based on severity weights
       └── Compile category breakdowns
               │
               ▼
      Explainable AI Layer
       ├── Cluster root causes
       ├── Draft fix sequences
       └── Generate readable summaries
               │
               ▼
        Terminal Reporter (Clean, formatted output screens)
```

### AST Parser & Arborist Integration
* `pkg-ct` uses `@npmcli/arborist` to build a real representation of the installed dependency node tree.
* It uses a fast AST parser to trace imports, `require()` calls, dynamic expressions, and config files to find evidence of package usage.

---

## ❓ SECTION 14: Frequently Asked Questions (FAQ)

#### 1. Can I trust the safe removal probability?
Yes. The probability is calculated using an evidence-based confidence formula. If a package is imported in code, its removal probability drops to `0%`. If it has config, script, or framework signatures, the probability stays low. It is only flagged as safe to remove when no evidence is found across any source files.

#### 2. Why does the AI say EXTREME risk?
An EXTREME risk rating means a package has a massive blast radius. Removing it will break core runtime components (like React, Express, or Next.js) or break hundreds of downstream packages.

#### 3. Why is React protected from removal?
`pkg-ct` includes built-in framework rules. React is recognized as a core framework package, so the scanner will never recommend removing it.

#### 4. What causes duplicate packages?
Duplication happens when different packages in your project require different, incompatible version ranges of the same dependency. For example, package A wants `semver@^6` and package B wants `semver@^7`. NPM is forced to install both.

#### 5. Why is my compatibility score low?
Your compatibility score drops when packages in your project have unsatisfied peer dependencies, or if they do not support your active Node.js version.

#### 6. Does pkg-ct upload my code to external AI servers?
No. By default, the AI summary engine runs offline using local heuristic rule templates. If you configure a third-party AI provider (like OpenAI or Anthropic), `pkg-ct` only sends structured package data and dependency names, never your proprietary source code files.

#### 7. How do I configure Ollama for local summaries?
Set the provider in `pkg-ct.config.ts` to `ollama`, and configure the API endpoint to point to your local port: `http://localhost:11434`.

#### 8. How does the scoring engine weight categories?
The weights are defined in the configuration. The default weights are: Security (`1.8`), Compatibility (`1.4`), Maintainability (`1.2`), Duplication (`1.0`), Hygiene (`1.0`), Freshness (`0.8`), and Install Performance (`0.6`).

#### 9. What is "technical lag"?
Technical lag measures the age difference and version distance between your installed packages and their latest available releases.

#### 10. Can I run pkg-ct on monorepos with nested package.json files?
Yes. `pkg-ct` automatically searches for monorepo roots and scans all workspace directories configured in `pnpm-workspace.yaml` or npm workspace configurations.

#### 11. How do I clear CLI spinner animations in CI logs?
Pass the `--ci` flag or configure options to write output directly to a file: `--output report.md`. This automatically disables spinner animations to keep your CI log files clean.

#### 12. Why does scan run so fast compared to doctor?
The `scan` command only parses the lockfile and node tree structure. It skips scanning your source code files with AST and bypasses fetching metadata from the online npm registry.

#### 13. Does this tool support Yarn Plug'n'Play (PnP)?
Currently, `pkg-ct` requires a physical `node_modules` tree to inspect directory structures, sizes, and file footprints.

#### 14. What are package lifecycle scripts?
These are hooks (like `preinstall`, `postinstall`, `prepublish`) that packages run during installation or publishing. They are common vectors for supply chain attacks.

#### 15. How do I ignore warnings for a deprecated package I cannot replace?
Add the package name to the `ignorePackages` array in your `pkg-ct.config.ts` file or `.ai-rules.json`.

#### 16. What does "Blast Radius Count" represent?
It represents the total number of packages in your tree that depend on that specific package, either directly or transitively.

#### 17. How is safe removal probability calculated?
It is calculated by checking the presence and strength of import statements, config references, package scripts, workflow actions, and workspace links.

#### 18. Does this tool support TypeScript codebases?
Yes, it parses `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, and `.cjs` files.

#### 19. Why does my score change when running offline vs online?
Online scans query the npm registry to detect deprecations, maintenance inactivity, and publish history. In offline mode, the freshness and maintainability scores are calculated using local lockfile estimates.

#### 20. What is "transitive bloat"?
Transitive bloat occurs when a package brings in a massive cascade of nested dependencies, increasing your `node_modules` size and slowing down your builds.

#### 21. How do I automate fixes in a script?
Run `pkg-ct fix --run` to execute safe fixes automatically.

#### 22. What makes a fix "safe"?
Safe fixes are actions (like `npm dedupe` or removing unused direct dependencies) that do not break dependency version ranges.

#### 23. Can I write custom analysis rules?
Yes. You can write custom rules using the programmatic API and include them via plugins.

#### 24. How do I report a bug?
Please open an issue in the GitHub repository: `https://github.com/danieljoshuajdj/pkg-ct`.

#### 25. How do I check if a package manager is supported?
`pkg-ct` supports npm, pnpm, and Yarn workspaces.

#### 26. What does "Production Reachable" mean?
It means the package is imported in code that runs in production, or is listed in the production dependency tree, even if it is not directly imported in your server entry point.

#### 27. Why does my build time increase with native modules?
Native modules require compilation on installation. If your CI runner doesn't cache `node_modules`, it compiles the C++ assets on every single build, slowing down deployments.

#### 28. What is "Workspace Drift"?
Workspace drift happens in monorepos when different packages depend on different version ranges of the same dependency, leading to multiple versions being installed.

#### 29. Can I customize the scoring categories?
Yes, you can edit the category weights in `pkg-ct.config.ts`.

#### 30. How do I contribution code?
Review our Contributing Guide in `CONTRIBUTING.md` and read the reference sections in this README.

---

## 🤝 SECTION 15: Contributing & Extension Guide

We welcome community contributions! Follow these steps to set up the project locally:

### Development Environment Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/danieljoshuajdj/pkg-ct.git
   cd pkg-ct
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Compile in watch mode:**
   ```bash
   npm run dev
   ```

### Writing a Custom Analysis Rule

To create a new rule, implement the `Rule` interface:

```typescript
import type { Rule, RuleInput, Finding } from './src/types/index.ts';

export const myCustomRule: Rule = {
  id: 'my-custom-rule',
  title: 'Detect custom issues',
  async run(input: RuleInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    // Access dependency graph, source code usage, or audit results
    if (input.graph.nodes.has('insecure-package')) {
      findings.push({
        id: 'custom:insecure',
        title: 'Found insecure package',
        description: 'Detail explaining the issue',
        category: 'security',
        severity: 'high',
        evidence: ['Found insecure-package in dependency graph'],
        recommendation: 'Replace with secure-package',
        confidence: 1.0
      });
    }
    return findings;
  }
};
```

Include your new rule in the orchestrator or plug it in via `pkg-ct.config.ts`.

### Running Tests

Execute the Vitest test suite locally:

```bash
npm test
```
