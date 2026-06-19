import type { AnalysisResult } from '../types/index.js';
import { directDependencies } from './source-usage.js';

export interface ProductionClassification {
  packageName: string;
  version: string;
  classification: 'Production critical' | 'Build only' | 'Development only' | 'Unknown';
  role: string;
}

export function classifyProductionPackages(result: AnalysisResult): ProductionClassification[] {
  const classifications: ProductionClassification[] = [];

  for (const node of result.graph.nodes.values()) {
    if (node.id === result.graph.rootId) continue;

    let classification: 'Production critical' | 'Build only' | 'Development only' | 'Unknown' = 'Unknown';
    const usage = result.usage.packageUsage.get(node.name);
    const isDev = node.dev;

    if (isDev) {
      if (
        ['typescript', 'vite', 'webpack', 'rollup', 'esbuild', 'tsup', 'tsx', 'postcss', 'autoprefixer'].includes(node.name) ||
        node.name.includes('plugin') ||
        node.name.includes('loader') ||
        node.name.includes('preset') ||
        node.name.startsWith('@babel/') ||
        node.name.startsWith('@vitejs/plugin-') ||
        node.name.startsWith('@swc/')
      ) {
        classification = 'Build only';
      } else {
        classification = 'Development only';
      }
    } else {
      if (
        ['react', 'react-dom', 'next', 'nuxt', 'astro', 'svelte', 'vue', 'express', 'koa', 'fastify'].includes(node.name) ||
        (usage && usage.confidence >= 30) ||
        node.optional ||
        node.peer
      ) {
        classification = 'Production critical';
      } else {
        classification = 'Unknown';
      }
    }

    classifications.push({
      packageName: node.name,
      version: node.version,
      classification,
      role: usage?.role ?? 'UNKNOWN'
    });
  }

  return classifications;
}
