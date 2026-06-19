import type { DependencyGraph } from '../types/index.js';

export interface BlastRadiusResult {
  packageName: string;
  directDependents: string[];
  transitiveDependents: string[];
  criticalDependents: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
}

export function calculateBlastRadius(graph: DependencyGraph, packageName: string): BlastRadiusResult {
  const ids = graph.byName.get(packageName) ?? [];
  const directSet = new Set<string>();
  const transitiveSet = new Set<string>();

  for (const id of ids) {
    const node = graph.nodes.get(id);
    if (!node) continue;

    for (const depId of node.dependents) {
      if (depId !== graph.rootId) {
        const depNode = graph.nodes.get(depId);
        if (depNode) directSet.add(depNode.name);
      }
    }

    const queue = [...node.dependents];
    const visited = new Set<string>([id]);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const currentNode = graph.nodes.get(currentId);
      if (currentNode && currentId !== graph.rootId) {
        transitiveSet.add(currentNode.name);
      }

      const parentNode = graph.nodes.get(currentId);
      if (parentNode) {
        queue.push(...parentNode.dependents);
      }
    }
  }

  const directDependents = [...directSet];
  const transitiveDependents = [...transitiveSet].filter((name) => !directSet.has(name));

  const criticalDependents = [...directSet, ...transitiveDependents].filter((name) => {
    return (
      ['react', 'react-dom', 'next', 'nuxt', 'astro', 'svelte', 'vue'].includes(name) ||
      graph.byName.get(name)?.some((id) => graph.nodes.get(id)?.depth === 1)
    );
  });

  const totalDependentsCount = directDependents.length + transitiveDependents.length;
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' = 'LOW';

  if (criticalDependents.length > 0 || totalDependentsCount > 10) {
    riskLevel = 'EXTREME';
  } else if (totalDependentsCount >= 5) {
    riskLevel = 'HIGH';
  } else if (totalDependentsCount >= 1) {
    riskLevel = 'MEDIUM';
  }

  return {
    packageName,
    directDependents,
    transitiveDependents,
    criticalDependents,
    riskLevel
  };
}
