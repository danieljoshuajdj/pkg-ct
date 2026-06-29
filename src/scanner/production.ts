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
    } else if (name === 'react-refresh' || name.includes('hmr') || name.includes('hot-reload')) {
      role = 'HMR_RUNTIME';
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
    } else if (name === 'espree' || name.includes('parser') || name === 'acorn' || name.startsWith('@babel/parser')) {
      role = 'PARSER';
    } else if (name === 'uri-js') {
      role = 'URL_LIBRARY';
    } else if (name === 'ignore' || name === 'picomatch' || name === 'minimatch' || name === 'micromatch') {
      role = 'FILE_FILTER';
    } else if (['glob', 'globby', 'fast-glob', 'tiny-glob'].includes(name)) {
      role = 'FILE_FILTER';
    } else if (name === 'estraverse') {
      role = 'AST';
    } else if (name === 'esutils') {
      role = 'AST_UTIL';
    } else if (['ansi-styles', 'kleur', 'chalk', 'picocolors', 'colorette'].includes(name)) {
      role = 'TERMINAL_UI';
    } else if (['strip-ansi', 'wrap-ansi', 'string-width', 'has-flag', 'supports-color', 'color-convert', 'color-name', 'ansi-regex'].includes(name)) {
      role = 'TERMINAL_UI';
    } else if (name === 'eslint-scope' || name === 'eslint-visitor-keys' || name.includes('linter') || name.startsWith('@eslint/')) {
      role = 'LINTER_SUPPORT';
    } else if (name === 'cacache' || name === 'lru-cache' || name.includes('cache')) {
      role = 'CACHE';
    } else if (name === 'tslib' || name.includes('babel/runtime') || name.includes('babel/helpers') || name.includes('babel/compat-data')) {
      role = 'COMPILER_SUPPORT';
    } else if (name === '@babel/code-frame' || name === '@babel/highlight') {
      role = 'COMPILER_SUPPORT';
    } else if (['commander', 'yargs', 'meow', 'cac', 'citty', 'clipanion', 'inquirer', 'prompts'].includes(name)) {
      role = 'CLI_FRAMEWORK';
    } else if (['debug', 'pino', 'winston', 'consola', 'log4js', 'bunyan'].includes(name)) {
      role = 'LOGGING';
    } else if (['signal-exit', 'cross-spawn', 'execa', 'which', 'path-key', 'npm-run-path', 'human-signals'].includes(name)) {
      role = 'PROCESS_UTIL';
    } else if (['json5', 'yaml', 'js-yaml', 'toml', 'ini', 'dotenv'].includes(name)) {
      role = 'CONFIG_PARSER';
    } else if (['resolve', 'resolve-from', 'enhanced-resolve', 'import-meta-resolve', 'pkg-types'].includes(name)) {
      role = 'MODULE_RESOLVER';
    } else if (['semver', 'ms', 'pretty-ms', 'deepmerge', 'merge-descriptors', 'bytes', 'pretty-bytes', 'type-fest', 'p-limit', 'p-queue'].includes(name)) {
      role = 'UTILITY';
    }
  }

  // Override role if it is a devDependency
  const isToolRole = [
    'BUILD_TOOL', 'BUILD_RUNTIME', 'CONFIG_TOOL', 'TEST_TOOL', 'LINTER', 'TRANSPILER', 'BUNDLER',
    'PARSER', 'AST', 'AST_UTIL', 'URL_LIBRARY', 'FILE_FILTER', 'TERMINAL_UI',
    'LINTER_SUPPORT', 'CACHE', 'HMR_RUNTIME', 'COMPILER_SUPPORT',
    'CLI_FRAMEWORK', 'LOGGING', 'UTILITY', 'PROCESS_UTIL', 'CONFIG_PARSER', 'MODULE_RESOLVER'
  ].includes(role);
  if (node.dev) {
    if (!isToolRole) {
      role = 'DEVELOPMENT';
    }
  } else {
    // Non-dev dependency
    if (role === 'UNKNOWN') {
      role = 'PRODUCTION_RUNTIME';
    }
  }

  // 2. Classify based on role
  let classification: 'Production critical' | 'Build only' | 'Development only' | 'Unknown';

  if (role === 'FRAMEWORK' || role === 'CORE_RUNTIME' || role === 'PRODUCTION_RUNTIME') {
    classification = 'Production critical';
  } else if (
    role === 'BUILD_TOOL' ||
    role === 'CONFIG_TOOL' ||
    role === 'TRANSPILER' ||
    role === 'BUNDLER' ||
    role === 'BUILD_RUNTIME' ||
    role === 'PARSER' ||
    role === 'AST' ||
    role === 'AST_UTIL' ||
    role === 'FILE_FILTER' ||
    role === 'CACHE' ||
    role === 'COMPILER_SUPPORT' ||
    role === 'CONFIG_PARSER' ||
    role === 'MODULE_RESOLVER'
  ) {
    classification = 'Build only';
  } else if (
    role === 'DEVELOPMENT' ||
    role === 'TEST_TOOL' ||
    role === 'LINTER' ||
    role === 'LINTER_SUPPORT' ||
    role === 'HMR_RUNTIME'
  ) {
    classification = 'Development only';
  } else if (role === 'URL_LIBRARY' || role === 'TERMINAL_UI' || role === 'CLI_FRAMEWORK' ||
    role === 'LOGGING' || role === 'UTILITY' || role === 'PROCESS_UTIL') {
    classification = node.dev ? 'Development only' : 'Production critical';
  } else {
    classification = 'Unknown';
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
