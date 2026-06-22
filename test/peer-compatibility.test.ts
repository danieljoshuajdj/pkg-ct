import { describe, expect, it } from 'vitest';
import { builtinRules } from '../src/rules/builtin.js';
import { testRuleInput } from './fixtures/simple-package.js';

describe('peer-conflicts rule', () => {
  const rule = builtinRules.find(r => r.id === 'peer-conflicts')!;

  it('allows valid peer version ranges without conflicts', async () => {
    const input = testRuleInput({
      graph: {
        rootId: 'app@0.0.0',
        nodes: new Map([
          [
            'app@0.0.0',
            {
              id: 'app@0.0.0',
              name: 'app',
              version: '0.0.0',
              depth: 0,
              peerDependencies: {},
              dependencies: { 'peer-pkg': '^1.0.0', 'react': '19.2.6' },
              dependents: [],
              sizeBytes: 0,
              scripts: {}
            }
          ],
          [
            'peer-pkg@1.0.0',
            {
              id: 'peer-pkg@1.0.0',
              name: 'peer-pkg',
              version: '1.0.0',
              depth: 1,
              peerDependencies: { 'react': '>=18 || >=19' }, // React satisfies
              dependencies: {},
              dependents: ['app@0.0.0'],
              sizeBytes: 10,
              scripts: {}
            }
          ],
          [
            'react@19.2.6',
            {
              id: 'react@19.2.6',
              name: 'react',
              version: '19.2.6',
              depth: 1,
              peerDependencies: {},
              dependencies: {},
              dependents: ['app@0.0.0', 'peer-pkg@1.0.0'],
              sizeBytes: 100,
              scripts: {}
            }
          ]
        ]),
        edges: [],
        byName: new Map([
          ['app', ['app@0.0.0']],
          ['peer-pkg', ['peer-pkg@1.0.0']],
          ['react', ['react@19.2.6']]
        ])
      }
    });

    const findings = await rule.run(input);
    expect(findings.length).toBe(0);
  });

  it('flags unsatisfied peer version ranges', async () => {
    const input = testRuleInput({
      graph: {
        rootId: 'app@0.0.0',
        nodes: new Map([
          [
            'app@0.0.0',
            {
              id: 'app@0.0.0',
              name: 'app',
              version: '0.0.0',
              depth: 0,
              peerDependencies: {},
              dependencies: { 'peer-pkg': '^1.0.0', 'react': '17.0.0' },
              dependents: [],
              sizeBytes: 0,
              scripts: {}
            }
          ],
          [
            'peer-pkg@1.0.0',
            {
              id: 'peer-pkg@1.0.0',
              name: 'peer-pkg',
              version: '1.0.0',
              depth: 1,
              peerDependencies: { 'react': '^18.0.0 || ^19.0.0' }, // unsatisfied by React 17
              dependencies: {},
              dependents: ['app@0.0.0'],
              sizeBytes: 10,
              scripts: {}
            }
          ],
          [
            'react@17.0.0',
            {
              id: 'react@17.0.0',
              name: 'react',
              version: '17.0.0',
              depth: 1,
              peerDependencies: {},
              dependencies: {},
              dependents: ['app@0.0.0'],
              sizeBytes: 100,
              scripts: {}
            }
          ]
        ]),
        edges: [],
        byName: new Map([
          ['app', ['app@0.0.0']],
          ['peer-pkg', ['peer-pkg@1.0.0']],
          ['react', ['react@17.0.0']]
        ])
      }
    });

    const findings = await rule.run(input);
    expect(findings.length).toBe(1);
    expect(findings[0]!.id).toBe('peer:peer-pkg@1.0.0:react');
  });
});
