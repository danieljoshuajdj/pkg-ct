import type { AnalysisResult } from '../types/index.js';

export interface ProductionClassification {
  packageName: string;
  version: string;
  classification: 'Production critical' | 'Build only' | 'Development only' | 'Unknown';
  role: string;
}

export function getRoleAndClassification(node: { name: string; dev?: boolean }, usageRole?: string): { role: string; classification: 'Production critical' | 'Build only' | 'Development only' | 'Unknown' } {
  const name = node.name.toLowerCase();
  
  // 1. Identify roles
  let role = usageRole && usageRole !== 'UNKNOWN' ? usageRole : 'UNKNOWN';
  
  if (role === 'UNKNOWN') {
    if (['react', 'react-dom', 'next', 'nuxt', 'astro', 'svelte', 'vue', '@angular/core', 'express', 'koa', 'fastify', 'nest'].some(x => name.includes(x))) {
      role = 'FRAMEWORK';
    } else if (['eslint', 'prettier', 'stylelint', 'tslint'].some(x => name.includes(x))) {
      role = 'LINTER';
    } else if (['vitest', 'jest', 'playwright', 'cypress', 'mocha', 'chai', 'ava'].some(x => name.includes(x))) {
      role = 'TEST_TOOL';
    } else if (['typescript', 'babel', 'swc', 'sucrase', 'esbuild-loader'].some(x => name.includes(x))) {
      role = 'TRANSPILER';
    } else if (['webpack', 'rollup', 'vite', 'esbuild', 'parcel', 'rspack', 'turbopack'].some(x => name.includes(x))) {
      role = 'BUNDLER';
    } else if (['postcss', 'autoprefixer', 'cssnano', 'sass', 'less', 'stylus', 'tailwindcss'].some(x => name.includes(x))) {
      role = 'CONFIG_TOOL';
    } else if (['tsup', 'microbundle', 'rimraf', 'cross-env', 'npm-run-all'].some(x => name.includes(x))) {
      role = 'BUILD_TOOL';
    } else if (name === 'tslib' || name.includes('babel/runtime') || name.includes('swc/helpers')) {
      role = 'BUILD_RUNTIME';
    }
  }

  // 2. Classify based on role and node.dev status
  let classification: 'Production critical' | 'Build only' | 'Development only' | 'Unknown' = 'Unknown';

  if (node.dev) {
    if (role === 'BUNDLER' || role === 'TRANSPILER' || role === 'BUILD_TOOL' || role === 'BUILD_RUNTIME') {
      classification = 'Build only';
    } else if (role === 'LINTER' || role === 'TEST_TOOL') {
      classification = 'Development only';
    } else if (role === 'CONFIG_TOOL') {
      classification = 'Build only';
    } else {
      classification = 'Development only';
    }
  } else {
    // If not dev, it runs in production runtime
    classification = 'Production critical';
    if (role === 'UNKNOWN') {
      role = 'CORE_RUNTIME'; // Default production role
    }
  }
  
  return { role, classification };
}

export function classifyProductionPackages(result: AnalysisResult): ProductionClassification[] {
  const classifications: ProductionClassification[] = [];

  for (const node of result.graph.nodes.values()) {
    if (node.id === result.graph.rootId) continue;

    const usage = result.usage.packageUsage.get(node.name);
    const { role, classification } = getRoleAndClassification(node, usage?.role);

    classifications.push({
      packageName: node.name,
      version: node.version,
      classification,
      role
    });
  }

  return classifications;
}
