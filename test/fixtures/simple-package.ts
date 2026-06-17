import type { DependencyGraph, ProjectContext, RequiredDoctorConfig, RuleInput } from '../../src/types/index.js';

export function testConfig(root = process.cwd()): RequiredDoctorConfig {
  return {
    root,
    offline: true,
    ai: { provider: 'none' },
    ignorePackages: [],
    rules: {},
    scoring: {
      hygiene: 1,
      security: 1.5,
      freshness: 0.9,
      duplication: 1,
      maintainability: 1.2,
      'install-performance': 1,
      'runtime-impact': 0.8,
      'bundle-impact': 0.8,
      compatibility: 1.3
    },
    ci: { failOn: 'high', minScore: 70 },
    plugins: []
  };
}

export function testContext(): ProjectContext {
  return {
    root: process.cwd(),
    packageManager: 'npm',
    lockfile: 'package-lock.json',
    isMonorepo: false,
    workspaceGlobs: [],
    workspaces: [],
    rootProject: {
      name: 'fixture',
      path: process.cwd(),
      packageJsonPath: 'package.json',
      dependencies: { a: '^1.0.0' },
      devDependencies: {},
      peerDependencies: {},
      optionalDependencies: {}
    },
    config: testConfig()
  };
}

export function duplicateGraph(): DependencyGraph {
  return {
    rootId: 'fixture@0.0.0',
    nodes: new Map([
      [
        'fixture@0.0.0',
        {
          id: 'fixture@0.0.0',
          name: 'fixture',
          version: '0.0.0',
          depth: 0,
          peerDependencies: {},
          dependencies: { lodash: '^4.0.0' },
          dependents: [],
          sizeBytes: 0,
          scripts: {}
        }
      ],
      [
        'lodash@4.17.20',
        {
          id: 'lodash@4.17.20',
          name: 'lodash',
          version: '4.17.20',
          depth: 1,
          peerDependencies: {},
          dependencies: {},
          dependents: ['fixture@0.0.0'],
          sizeBytes: 1000,
          scripts: {}
        }
      ],
      [
        'lodash@4.17.21',
        {
          id: 'lodash@4.17.21',
          name: 'lodash',
          version: '4.17.21',
          depth: 2,
          peerDependencies: {},
          dependencies: {},
          dependents: ['a@1.0.0'],
          sizeBytes: 1000,
          scripts: {}
        }
      ]
    ]),
    edges: [
      { from: 'fixture@0.0.0', to: 'lodash@4.17.20', type: 'prod', spec: '^4.0.0' },
      { from: 'fixture@0.0.0', to: 'lodash@4.17.21', type: 'transitive', spec: '^4.17.21' }
    ],
    byName: new Map([
      ['fixture', ['fixture@0.0.0']],
      ['lodash', ['lodash@4.17.20', 'lodash@4.17.21']]
    ])
  };
}

export function testRuleInput(overrides: Partial<RuleInput> = {}): RuleInput {
  return {
    context: testContext(),
    graph: duplicateGraph(),
    intelligence: new Map(),
    usage: { usedPackages: new Set(), filesScanned: 0, importCount: 0 },
    lockfileAnalysis: {
      type: 'npm',
      packageCount: 0,
      duplicatePackages: new Map(),
      missingDirectDependencies: [],
      staleDirectDependencies: [],
      evidence: []
    },
    audit: { vulnerabilities: [] },
    ...overrides
  };
}
