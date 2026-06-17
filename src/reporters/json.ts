import type { AnalysisResult } from '../types/index.js';

export function renderJson(result: AnalysisResult): string {
  return JSON.stringify(
    {
      ...result,
      graph: {
        rootId: result.graph.rootId,
        nodes: [...result.graph.nodes.values()],
        edges: result.graph.edges
      },
      usage: {
        ...result.usage,
        usedPackages: [...result.usage.usedPackages]
      },
      lockfileAnalysis: {
        ...result.lockfileAnalysis,
        duplicatePackages: Object.fromEntries(result.lockfileAnalysis.duplicatePackages)
      }
    },
    null,
    2
  );
}
