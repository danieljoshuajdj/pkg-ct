import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanSourceUsage } from '../src/scanner/source-usage.js';
import { testConfig } from './fixtures/simple-package.js';
import { explainPackage } from '../src/core/explain.js';
import type { ProjectContext } from '../src/types/index.js';
import { renderDoctor, renderScanInventory, renderTerminal } from '../src/reporters/terminal.js';

describe('pkg-ct integrated fixtures', () => {
  it('verifies react-dom, tailwindcss, and eslint-config-prettier are not flagged unused', async () => {
    // 1. Create a React + Vite fixture
    const root = await mkdtemp(join(process.cwd(), 'test', 'fixtures', 'tmp-vite-'));
    await mkdir(join(root, '.github', 'workflows'), { recursive: true });
    
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({
        name: 'fixture-vite',
        scripts: { build: 'vite build' },
        dependencies: {
          react: '^19.0.0',
          'react-dom': '^19.0.0',
          tailwindcss: '^4.0.0'
        },
        devDependencies: {
          'eslint-config-prettier': '^10.0.0',
          '@tanstack/router-plugin': '^1.0.0',
          '@cloudflare/vite-plugin': '^1.0.0'
        }
      })
    );
    await writeFile(join(root, 'src.tsx'), "import React from 'react';\n");
    await writeFile(
      join(root, 'vite.config.ts'),
      "import { defineConfig } from 'vite';\nimport cloudflare from '@cloudflare/vite-plugin';\nimport { TanStackRouterVite } from '@tanstack/router-plugin/vite';\n"
    );
    await writeFile(join(root, 'tailwind.config.ts'), 'export default {};');
    await writeFile(join(root, 'eslint.config.mjs'), "export default ['prettier'];");
    await writeFile(join(root, '.github', 'workflows', 'ci.yml'), 'run: npm run build');

    const context: ProjectContext = {
      root,
      packageManager: 'npm',
      lockfile: join(root, 'package-lock.json'),
      isMonorepo: false,
      workspaceGlobs: [],
      workspaces: [],
      rootProject: {
        name: 'fixture-vite',
        path: root,
        packageJsonPath: join(root, 'package.json'),
        dependencies: {
          react: '^19.0.0',
          'react-dom': '^19.0.0',
          tailwindcss: '^4.0.0'
        },
        devDependencies: {
          'eslint-config-prettier': '^10.0.0',
          '@tanstack/router-plugin': '^1.0.0',
          '@cloudflare/vite-plugin': '^1.0.0'
        },
        peerDependencies: {},
        optionalDependencies: {}
      },
      config: testConfig(root)
    };

    const usage = await scanSourceUsage(context);
    
    // Expect React DOM (framework), TailwindCSS (config), ESLint Config Prettier (config),
    // cloudflare plugin, tanstack plugin to be >= 30, hence not flagged as unused!
    expect(usage.packageUsage.get('react-dom')?.confidence).toBeGreaterThanOrEqual(30);
    expect(usage.packageUsage.get('tailwindcss')?.confidence).toBeGreaterThanOrEqual(30);
    expect(usage.packageUsage.get('eslint-config-prettier')?.confidence).toBeGreaterThanOrEqual(30);
    expect(usage.packageUsage.get('@cloudflare/vite-plugin')?.confidence).toBeGreaterThanOrEqual(45);
    expect(usage.packageUsage.get('@tanstack/router-plugin')?.confidence).toBeGreaterThanOrEqual(45);
  });

  it('verifies next.config.js matches next and react-dom correctly', async () => {
    // 2. Create Next.js fixture
    const root = await mkdtemp(join(process.cwd(), 'test', 'fixtures', 'tmp-next-'));
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({
        name: 'fixture-next',
        dependencies: {
          next: '^15.0.0',
          react: '^19.0.0',
          'react-dom': '^19.0.0'
        }
      })
    );
    await writeFile(join(root, 'next.config.js'), 'module.exports = {};');

    const context: ProjectContext = {
      root,
      packageManager: 'npm',
      lockfile: join(root, 'package-lock.json'),
      isMonorepo: false,
      workspaceGlobs: [],
      workspaces: [],
      rootProject: {
        name: 'fixture-next',
        path: root,
        packageJsonPath: join(root, 'package.json'),
        dependencies: {
          next: '^15.0.0',
          react: '^19.0.0',
          'react-dom': '^19.0.0'
        },
        devDependencies: {},
        peerDependencies: {},
        optionalDependencies: {}
      },
      config: testConfig(root)
    };

    const usage = await scanSourceUsage(context);
    expect(usage.packageUsage.get('next')?.confidence).toBeGreaterThanOrEqual(30);
    expect(usage.packageUsage.get('react-dom')?.confidence).toBeGreaterThanOrEqual(30);
  });

  it('verifies that doctor, analyze, and scan outputs differ', async () => {
    // 3. Setup mock analysis result to verify rendering output differences
    const mockResult = {
      context: {
        root: process.cwd(),
        packageManager: 'npm' as const,
        isMonorepo: false,
        workspaceGlobs: [],
        workspaces: [],
        rootProject: {
          name: 'test-proj',
          path: process.cwd(),
          packageJsonPath: 'package.json',
          dependencies: {},
          devDependencies: {},
          peerDependencies: {},
          optionalDependencies: {}
        },
        config: testConfig()
      },
      graph: {
        rootId: 'test-proj@0.0.0',
        nodes: new Map(),
        edges: [],
        byName: new Map()
      },
      findings: [
        {
          id: 'peer:test',
          title: 'Peer conflict',
          description: 'A mock peer conflict',
          category: 'compatibility' as const,
          severity: 'high' as const,
          packageName: 'test-pkg',
          evidence: [],
          recommendation: 'Fix peer range',
          confidence: 0.9
        }
      ],
      score: {
        overall: 80,
        grade: 'B' as const,
        breakdown: [
          {
            category: 'compatibility' as const,
            score: 80,
            weight: 1,
            deductions: 20,
            explanation: '1 issue'
          }
        ]
      },
      remediation: [
        {
          id: 'plan:upgrade',
          title: 'Upgrade packages',
          priority: 80,
          difficulty: 'easy' as const,
          impact: 'high' as const,
          actions: [],
          rationale: 'Fix peer'
        }
      ],
      usage: { usedPackages: new Set<string>(), packageUsage: new Map(), filesScanned: 0, importCount: 0 },
      lockfileAnalysis: {
        type: 'npm' as const,
        packageCount: 0,
        duplicatePackages: new Map(),
        missingDirectDependencies: [],
        staleDirectDependencies: [],
        evidence: []
      },
      audit: { vulnerabilities: [] },
      packageIntelligence: [],
      generatedAt: new Date().toISOString(),
      durationMs: 10,
      pipeline: 'ANALYZE_PIPELINE' as const
    };

    const scanOutput = renderScanInventory(mockResult);
    const analyzeOutput = renderTerminal(mockResult);
    const doctorOutput = renderDoctor(mockResult);

    expect(scanOutput).toContain('pkg-ct scan');
    expect(scanOutput).not.toContain('Remediation Plan');
    expect(scanOutput).not.toContain('Project Health Score');

    expect(analyzeOutput).toContain('pkg-ct');
    expect(analyzeOutput).toContain('Project Health Score: 80/100');
    expect(analyzeOutput).toContain('Remediation Plan');
    expect(analyzeOutput).not.toContain('INVENTORY');

    expect(doctorOutput).toContain('PKG-CT DEPENDENCY DOCTOR');
    expect(doctorOutput).toContain('INVENTORY');
    expect(doctorOutput).toContain('HEALTH BREAKDOWN');
    expect(doctorOutput).toContain('COMPATIBILITY');
    expect(doctorOutput).toContain('AI FIX PLAN');
  });

  it('verifies explainPackage never suggests uninstall for framework packages', async () => {
    const mockResult = {
      context: {
        root: process.cwd(),
        packageManager: 'npm' as const,
        isMonorepo: false,
        workspaceGlobs: [],
        workspaces: [],
        rootProject: {
          name: 'test-proj',
          path: process.cwd(),
          packageJsonPath: 'package.json',
          dependencies: { react: '^19.0.0' },
          devDependencies: {},
          peerDependencies: {},
          optionalDependencies: {}
        },
        config: testConfig()
      },
      graph: {
        rootId: 'test-proj@0.0.0',
        nodes: new Map([
          [
            'react@19.0.0',
            {
              id: 'react@19.0.0',
              name: 'react',
              version: '19.0.0',
              depth: 1,
              peerDependencies: {},
              dependencies: {},
              dependents: ['test-proj@0.0.0'],
              sizeBytes: 100,
              scripts: {}
            }
          ]
        ]),
        edges: [],
        byName: new Map([['react', ['react@19.0.0']]])
      },
      findings: [],
      score: { overall: 100, grade: 'A' as const, breakdown: [] },
      remediation: [],
      usage: { usedPackages: new Set<string>(), packageUsage: new Map(), filesScanned: 0, importCount: 0 },
      lockfileAnalysis: {
        type: 'npm' as const,
        packageCount: 1,
        duplicatePackages: new Map(),
        missingDirectDependencies: [],
        staleDirectDependencies: [],
        evidence: []
      },
      audit: { vulnerabilities: [] },
      packageIntelligence: [],
      generatedAt: new Date().toISOString(),
      durationMs: 1,
      pipeline: 'ANALYZE_PIPELINE' as const
    };

    const explanation = explainPackage(mockResult, 'react');
    expect(explanation.role).toBe('CORE_RUNTIME');
    expect(explanation.safeRemovalProbabilityPercent).toBe(2);
    expect(explanation.removalRisk).toBe('EXTREME');
    expect(explanation.safeRemovalProbability).toBe('LOW');
  });
});
