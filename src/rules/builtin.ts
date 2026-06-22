import semver from 'semver';
const { gt, satisfies, validRange } = semver;
import type { DependencyNode, Finding, Rule, Severity } from '../types/index.js';
import { formatBytes } from '../utils/bytes.js';
import { satisfiesPeerRequirement } from '../utils/semver.js';

export const builtinRules: Rule[] = [
  {
    id: 'unused-direct-dependencies',
    title: 'Unused direct dependencies',
    run: ({ context, usage }) => {
      if (usage.filesScanned === 0) return [];
      const direct = new Set(Object.keys({
        ...context.rootProject.dependencies,
        ...context.rootProject.devDependencies,
        ...context.rootProject.optionalDependencies,
        ...context.rootProject.peerDependencies
      }));
      const ignored = new Set(context.config.ignorePackages);
      return [...direct]
        .filter((name) => !ignored.has(name))
        .map((name) => usage.packageUsage.get(name))
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .filter((item) => item.confidence < 30)
        .map((item) => {
          const finding: Finding = {
            id: `unused:${item.name}`,
            title: `${item.name} has low usage confidence`,
            description:
              'No strong source, config, script, CI, or framework evidence was found for this direct dependency.',
            category: 'hygiene',
            severity: 'medium' as Severity,
            packageName: item.name,
            evidence: [
              `usage confidence: ${item.confidence}%`,
              `safe removal probability: ${item.safeRemovalProbability}%`,
              ...item.evidence.map((evidence) =>
                evidence.file ? `${evidence.source}: ${evidence.file} - ${evidence.detail}` : `${evidence.source}: ${evidence.detail}`
              )
            ],
            recommendation:
              item.safeRemovalProbability > 90
                ? `Review ${item.name}; evidence suggests it may be safe to remove.`
                : `Manually review ${item.name}; pkg-ct will not suggest uninstalling it without higher confidence.`,
            confidence: Math.max(0.3, (100 - item.confidence) / 100)
          };
          if (item.safeRemovalProbability > 90) {
            finding.fix = {
              type: 'remove',
              title: `Remove low-confidence dependency ${item.name}`,
              commands: [`npm uninstall ${item.name}`],
              safe: false,
              requiresInstall: true
            };
          }
          return finding;
        });
    }
  },
  {
    id: 'duplicates',
    title: 'Duplicate dependency versions',
    run: ({ graph }) => {
      const findings: Finding[] = [];
      for (const [name, ids] of graph.byName) {
        const versions = new Set(ids.map((id) => graph.nodes.get(id)?.version).filter(Boolean));
        if (versions.size <= 1) continue;
        findings.push({
          id: `duplicates:${name}`,
          title: `${name} is installed in ${versions.size} versions`,
          description: 'Multiple versions increase install time, disk use, and runtime/bundle drift.',
          category: 'duplication',
          severity: versions.size > 3 ? 'high' : 'medium',
          packageName: name,
          evidence: [...versions].map((version) => `${name}@${version}`),
          recommendation: `Run your package manager dedupe command and align direct ranges for ${name}.`,
          fix: {
            type: 'dedupe',
            title: `Deduplicate ${name}`,
            commands: ['npm dedupe', 'pnpm dedupe', 'yarn dedupe'],
            safe: true,
            requiresInstall: true
          },
          confidence: 0.95
        });
      }
      return findings;
    }
  },
  {
    id: 'deprecated',
    title: 'Deprecated packages',
    run: ({ graph }) =>
      [...graph.nodes.values()]
        .filter((node) => Boolean(node.deprecated))
        .map((node) => ({
          id: `deprecated:${node.id}`,
          title: `${node.name}@${node.version} is deprecated`,
          description: node.deprecated ?? 'The package has been marked deprecated by its maintainer.',
          category: 'freshness',
          severity: 'high' as Severity,
          packageName: node.name,
          packageVersion: node.version,
          evidence: [node.deprecated ?? 'deprecated metadata present'],
          recommendation: `Upgrade, replace, or remove ${node.name}; inspect the dependency chain before changing transitive dependencies.`,
          fix: {
            type: 'upgrade',
            title: `Replace deprecated ${node.name}`,
            commands: [`npm info ${node.name} deprecated`, `npm why ${node.name}`],
            safe: false,
            requiresInstall: false
          },
          confidence: 0.99
        })),
  },
  {
    id: 'native-modules',
    title: 'Native module install risk',
    run: ({ graph }) =>
      [...graph.nodes.values()]
        .filter(hasNativeRisk)
        .map((node) => ({
          id: `native:${node.id}`,
          title: `${node.name} may compile native code during install`,
          description:
            'Native modules can fail in CI, containers, Alpine Linux, or unsupported Node versions.',
          category: 'install-performance',
          severity: 'medium' as Severity,
          packageName: node.name,
          packageVersion: node.version,
          evidence: nativeEvidence(node),
          recommendation:
            'Prefer prebuild-friendly versions, pin supported Node versions, and verify CI images include build tooling.',
          confidence: 0.86
        })),
  },
  {
    id: 'peer-conflicts',
    title: 'Peer dependency compatibility',
    run: ({ graph }) => {
      const installed = new Map<string, string[]>();
      for (const node of graph.nodes.values()) {
        const list = installed.get(node.name) ?? [];
        list.push(node.version);
        installed.set(node.name, list);
      }

      const findings: Finding[] = [];
      for (const node of graph.nodes.values()) {
        for (const [peerName, range] of Object.entries(node.peerDependencies)) {
          const versions = installed.get(peerName) ?? [];
          const cleanRange = range.replace(/(workspace|link|file):/g, '').trim();
          const hasValidRange = cleanRange === '*' || cleanRange === 'latest' || Boolean(semver.validRange(cleanRange));
          
          let satisfied = false;
          if (versions.length > 0) {
            satisfied = versions.some((version) => satisfiesPeerRequirement(version, range));
          }

          if (versions.length > 0 && satisfied) continue;
          findings.push({
            id: `peer:${node.id}:${peerName}`,
            title: `${node.name} expects peer ${peerName}@${range}`,
            description: versions.length
              ? `Installed versions (${versions.join(', ')}) do not satisfy this peer range.`
              : 'The required peer dependency is not installed in the realized tree.',
            category: 'compatibility',
            severity: versions.length ? 'high' : 'medium',
            packageName: node.name,
            packageVersion: node.version,
            evidence: [`required: ${peerName}@${range}`, `installed: ${versions.join(', ') || 'none'}`],
            recommendation: `Install a compatible ${peerName} version or upgrade ${node.name} to a compatible release.`,
            confidence: hasValidRange ? 0.9 : 0.65
          });
        }
      }
      return findings;
    }
  },
  {
    id: 'lockfile-consistency',
    title: 'Lockfile consistency',
    run: ({ context, lockfileAnalysis }) => {
      const findings: Finding[] = [];
      if (!context.lockfile) {
        findings.push({
          id: 'lockfile:missing',
          title: 'No lockfile detected',
          description: 'Projects without lockfiles have less reproducible installs and weaker CI predictability.',
          category: 'compatibility',
          severity: 'medium',
          evidence: lockfileAnalysis.evidence,
          recommendation: 'Commit a package manager lockfile for deterministic installs.',
          confidence: 0.95
        });
      }
      for (const name of lockfileAnalysis.missingDirectDependencies) {
        findings.push({
          id: `lockfile:missing-direct:${name}`,
          title: `${name} is declared but missing from the lockfile root`,
          description: 'The manifest and lockfile appear out of sync.',
          category: 'compatibility',
          severity: 'high',
          packageName: name,
          evidence: [`package manager: ${lockfileAnalysis.type}`],
          recommendation: 'Run your package manager install command and commit the updated lockfile.',
          fix: {
            type: 'lockfile-repair',
            title: 'Repair lockfile',
            commands: [`${context.packageManager === 'unknown' ? 'npm' : context.packageManager} install`],
            safe: true,
            requiresInstall: true
          },
          confidence: 0.9
        });
      }
      for (const name of lockfileAnalysis.staleDirectDependencies) {
        findings.push({
          id: `lockfile:stale-direct:${name}`,
          title: `${name} exists in lockfile root but not package.json`,
          description: 'The lockfile may contain stale direct dependency metadata.',
          category: 'hygiene',
          severity: 'medium',
          packageName: name,
          evidence: [`package manager: ${lockfileAnalysis.type}`],
          recommendation: 'Refresh the lockfile with your package manager.',
          confidence: 0.82
        });
      }
      return findings;
    }
  },
  {
    id: 'npm-audit',
    title: 'npm audit vulnerabilities',
    run: ({ audit }) =>
      audit.vulnerabilities.map((vulnerability) => {
        const finding: Finding = {
          id: `audit:${vulnerability.name}:${vulnerability.title}`,
          title: `${vulnerability.name}: ${vulnerability.title}`,
          description: `npm audit reported a ${vulnerability.severity} vulnerability.`,
          category: 'security',
          severity: vulnerability.severity,
          packageName: vulnerability.name,
          evidence: [
            vulnerability.range ? `range: ${vulnerability.range}` : undefined,
            vulnerability.url,
            ...vulnerability.via.slice(0, 4)
          ].filter((item): item is string => Boolean(item)),
          recommendation: vulnerability.fixAvailable
            ? 'Run npm audit fix after reviewing the dependency chain and changelog impact.'
            : 'No automatic audit fix is advertised; upgrade or replace the affected chain manually.',
          confidence: 0.96
        };
        if (vulnerability.fixAvailable) {
          finding.fix = {
            type: 'upgrade',
            title: `Fix audit issue in ${vulnerability.name}`,
            commands: ['npm audit fix'],
            safe: false,
            requiresInstall: true
          };
        }
        return finding;
      })
  },
  {
    id: 'package-health-metadata',
    title: 'Package health metadata',
    run: ({ graph, intelligence }) => {
      const findings: Finding[] = [];
      for (const [name, info] of intelligence) {
        const direct = graph.byName.get(name)?.some((id) => graph.nodes.get(id)?.depth === 1);
        if (!direct) continue;
        const installed = graph.byName.get(name)?.map((id) => graph.nodes.get(id)?.version).filter(Boolean) ?? [];
        if (info.latest && installed.some((version) => gt(info.latest as string, version as string))) {
          findings.push({
            id: `outdated:${name}`,
            title: `${name} is behind latest ${info.latest}`,
            description: 'Direct dependencies that lag the ecosystem increase maintenance and compatibility risk.',
            category: 'freshness',
            severity: 'low',
            packageName: name,
            evidence: [`installed: ${installed.join(', ')}`, `latest: ${info.latest}`],
            recommendation: `Review the changelog and upgrade ${name} when safe.`,
            confidence: 0.8
          });
        }
        if (info.ageDays && info.ageDays > 730) {
          findings.push({
            id: `stale:${name}`,
            title: `${name} has not published a release in over two years`,
            description: 'Stale packages may still be stable, but they deserve review for ecosystem compatibility.',
            category: 'freshness',
            severity: 'medium',
            packageName: name,
            evidence: [`latest publish age: ${info.ageDays} days`],
            recommendation: `Check whether ${name} is intentionally stable, abandoned, or replaceable.`,
            confidence: 0.72
          });
        }
        if (info.maintainers !== undefined && info.maintainers <= 1) {
          findings.push({
            id: `maintainers:${name}`,
            title: `${name} has a small maintainer surface`,
            description: 'Single-maintainer packages can be healthy, but they increase continuity and supply-chain risk.',
            category: 'maintainability',
            severity: 'low',
            packageName: name,
            evidence: [`maintainers: ${info.maintainers}`],
            recommendation: 'Consider project criticality, lockfile pinning, and maintained alternatives.',
            confidence: 0.65
          });
        }
      }
      return findings;
    }
  },
  {
    id: 'node-engines',
    title: 'Node engine compatibility',
    run: ({ graph }) => {
      const current = process.versions.node;
      return [...graph.nodes.values()]
        .filter((node) => node.engines?.node && validRange(node.engines.node))
        .filter((node) => !satisfies(current, node.engines?.node ?? '*'))
        .map((node) => ({
          id: `engine:${node.id}`,
          title: `${node.name}@${node.version} does not advertise support for Node ${current}`,
          description: `Package engine range is ${node.engines?.node}.`,
          category: 'compatibility',
          severity: 'high' as Severity,
          packageName: node.name,
          packageVersion: node.version,
          evidence: [`current Node: ${current}`, `required: ${node.engines?.node}`],
          recommendation: 'Use a compatible package version or align the project Node runtime.',
          confidence: 0.92
        }));
    }
  },
  {
    id: 'dependency-bloat',
    title: 'Oversized dependency chains',
    run: ({ graph }) =>
      [...graph.nodes.values()]
        .filter((node) => node.depth > 0 && (node.sizeBytes > 4 * 1024 * 1024 || node.depth >= 7))
        .map((node) => ({
          id: `bloat:${node.id}`,
          title: `${node.name} has high install impact`,
          description:
            node.sizeBytes > 0
              ? `${node.name} contributes roughly ${formatBytes(node.sizeBytes)} on disk.`
              : `${node.name} is deep in the transitive tree at depth ${node.depth}.`,
          category: node.sizeBytes > 4 * 1024 * 1024 ? 'install-performance' : 'maintainability',
          severity: node.sizeBytes > 12 * 1024 * 1024 || node.depth >= 10 ? 'high' : 'medium',
          packageName: node.name,
          packageVersion: node.version,
          evidence: [`depth: ${node.depth}`, `estimated size: ${formatBytes(node.sizeBytes)}`],
          recommendation: 'Inspect the introducer chain and consider lighter alternatives or version alignment.',
          confidence: node.sizeBytes > 0 ? 0.8 : 0.68
        }))
  },
  {
    id: 'install-scripts',
    title: 'Install lifecycle scripts',
    run: ({ graph }) =>
      [...graph.nodes.values()]
        .filter((node) => ['preinstall', 'install', 'postinstall'].some((script) => node.scripts[script]))
        .map((node) => ({
          id: `lifecycle:${node.id}`,
          title: `${node.name} runs install lifecycle scripts`,
          description: 'Install scripts are legitimate but increase supply-chain and CI failure risk.',
          category: 'security',
          severity: 'medium' as Severity,
          packageName: node.name,
          packageVersion: node.version,
          evidence: Object.entries(node.scripts)
            .filter(([name]) => ['preinstall', 'install', 'postinstall'].includes(name))
            .map(([name, command]) => `${name}: ${command}`),
          recommendation: 'Audit why the script is needed and pin trusted versions in sensitive environments.',
          confidence: 0.88
        }))
  },
  {
    id: 'workspace-drift',
    title: 'Workspace dependency drift',
    run: ({ context }) => {
      if (!context.isMonorepo) return [];
      const ranges = new Map<string, Map<string, string[]>>();
      for (const workspace of context.workspaces) {
        for (const [name, spec] of Object.entries({
          ...workspace.dependencies,
          ...workspace.devDependencies
        })) {
          const byRange = ranges.get(name) ?? new Map<string, string[]>();
          const owners = byRange.get(spec) ?? [];
          owners.push(workspace.name);
          byRange.set(spec, owners);
          ranges.set(name, byRange);
        }
      }
      return [...ranges.entries()]
        .filter(([, byRange]) => byRange.size > 1)
        .map(([name, byRange]) => ({
          id: `workspace-drift:${name}`,
          title: `${name} has inconsistent workspace ranges`,
          description: 'Dependency drift causes duplicate installs and surprising package behavior across apps.',
          category: 'hygiene',
          severity: 'medium' as Severity,
          packageName: name,
          evidence: [...byRange.entries()].map(([range, owners]) => `${range}: ${owners.join(', ')}`),
          recommendation: `Align ${name} ranges across workspaces or intentionally document the divergence.`,
          confidence: 0.93
        }));
    }
  },
  {
    id: 'npm-engines',
    title: 'NPM engine compatibility',
    run: ({ graph }) => {
      const currentNpm = '10.0.0';
      return [...graph.nodes.values()]
        .filter((node) => node.engines?.npm && validRange(node.engines.npm))
        .filter((node) => !satisfies(currentNpm, node.engines?.npm ?? '*'))
        .map((node) => ({
          id: `engine-npm:${node.id}`,
          title: `${node.name}@${node.version} does not advertise support for npm ${currentNpm}`,
          description: `Package engine range is ${node.engines?.npm}.`,
          category: 'compatibility',
          severity: 'low',
          packageName: node.name,
          packageVersion: node.version,
          evidence: [`current npm: ${currentNpm}`, `required: ${node.engines?.npm}`],
          recommendation: 'Use a compatible package version or align the npm cli version.',
          confidence: 0.8
        }));
    }
  },
  {
    id: 'duplicate-major-versions',
    title: 'Duplicate major versions installed',
    run: ({ graph }) => {
      const findings: Finding[] = [];
      for (const [name, ids] of graph.byName) {
        const majors = new Set(
          ids
            .map((id) => {
              const version = graph.nodes.get(id)?.version;
              if (!version) return null;
              const match = version.match(/^v?(\d+)\./);
              return match ? match[1] : null;
            })
            .filter(Boolean)
        );
        if (majors.size > 1) {
          findings.push({
            id: `compatibility:major-duplicates:${name}`,
            title: `Multiple major versions of ${name} installed`,
            description: `Installing multiple major versions (${[...majors].join(', ')}) of the same package causes type conflicts, runtime bugs, and duplicate bundle bloat.`,
            category: 'compatibility',
            severity: 'high',
            packageName: name,
            evidence: ids.map((id) => `${name}@${graph.nodes.get(id)?.version}`),
            recommendation: `Align version ranges for ${name} to use a single major version if possible.`,
            confidence: 0.95
          });
        }
      }
      return findings;
    }
  },
  {
    id: 'framework-compatibility',
    title: 'Framework version mismatch',
    run: ({ graph }) => {
      const findings: Finding[] = [];
      const reactNodes = graph.byName.get('react') ?? [];
      const reactDomNodes = graph.byName.get('react-dom') ?? [];
      if (reactNodes.length > 0 && reactDomNodes.length > 0) {
        const reactVersions = reactNodes.map(id => graph.nodes.get(id)?.version).filter((v): v is string => Boolean(v));
        const reactDomVersions = reactDomNodes.map(id => graph.nodes.get(id)?.version).filter((v): v is string => Boolean(v));
        for (const rVer of reactVersions) {
          const rMajor = rVer.split('.')[0];
          if (rMajor === undefined) continue;
          for (const rdVer of reactDomVersions) {
            const rdMajor = rdVer.split('.')[0];
            if (rdMajor === undefined) continue;
            if (rMajor !== rdMajor) {
              findings.push({
                id: `compatibility:framework-mismatch:react`,
                title: 'Mismatched React and React DOM versions',
                description: `React@${rVer} is installed alongside React DOM@${rdVer}. Their major versions must align.`,
                category: 'compatibility',
                severity: 'critical',
                packageName: 'react-dom',
                evidence: [`react: ${rVer}`, `react-dom: ${rdVer}`],
                recommendation: 'Align react and react-dom to the same version.',
                confidence: 1.0
              });
            }
          }
        }
      }
      return findings;
    }
  }
];

function hasNativeRisk(node: DependencyNode): boolean {
  const scripts = Object.values(node.scripts).join(' ');
  return /node-gyp|prebuild|cmake-js|node-pre-gyp|make\b|g\+\+/.test(scripts);
}

function nativeEvidence(node: DependencyNode): string[] {
  return Object.entries(node.scripts)
    .filter(([, command]) => /node-gyp|prebuild|cmake-js|node-pre-gyp|make\b|g\+\+/.test(command))
    .map(([script, command]) => `${script}: ${command}`);
}
