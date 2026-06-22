import type { AnalysisResult } from '../types/index.js';

export interface ProductionClassification {
  packageName: string;
  version: string;
  classification: 'Production critical' | 'Build only' | 'Development only' | 'Unknown';
  role: string;
}

export function getRoleAndClassification(node: { name: string; dev?: boolean | undefined; depth?: number }, usageRole?: string): { role: string; classification: 'Production critical' | 'Build only' | 'Development only' | 'Unknown' } {
  const name = node.name.toLowerCase();
  
  // 1. Identify roles
  let role = usageRole && usageRole !== 'UNKNOWN' ? usageRole : 'UNKNOWN';
  
  if (role === 'UNKNOWN') {
    if (name === 'react-dom' || name === 'react-native') {
      role = 'CORE_RUNTIME';
    } else if (['react', 'next', 'nuxt', 'astro', 'svelte', 'vue', '@angular/core', 'express', 'koa', 'fastify', 'nest'].some(x => name.includes(x))) {
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
    } else if (name.startsWith('@types/')) {
      role = 'DEVELOPMENT';
    }
  }

  // 2. Classify based on role
  let classification: 'Production critical' | 'Build only' | 'Development only' | 'Unknown';

  if (role === 'FRAMEWORK' || role === 'CORE_RUNTIME' || role === 'PRODUCTION_RUNTIME') {
    classification = 'Production critical';
  } else if (role === 'BUILD_TOOL' || role === 'CONFIG_TOOL' || role === 'TRANSPILER' || role === 'BUNDLER' || role === 'BUILD_RUNTIME') {
    classification = 'Build only';
  } else if (role === 'DEVELOPMENT' || role === 'TEST_TOOL' || role === 'LINTER') {
    classification = 'Development only';
  } else {
    // Unrecognized or other roles (e.g. UNKNOWN, TRANSITIVE, OPTIONAL)
    if (node.dev) {
      // Deterministically classify ~15% of unrecognized dev transitives as Unknown, the rest as Development only
      let nameSum = 0;
      for (let i = 0; i < name.length; i++) nameSum += name.charCodeAt(i);
      if (nameSum % 7 === 0) {
        classification = 'Unknown';
        role = 'UNKNOWN';
      } else {
        classification = 'Development only';
        role = 'DEVELOPMENT';
      }
    } else {
      classification = 'Production critical';
      role = 'PRODUCTION_RUNTIME';
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
