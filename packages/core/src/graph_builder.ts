import type { ProjectConfig, WorkspaceConfig } from "./config.ts";
import type {
  ProjectDependencyEdge,
  ProjectDependencyEdgeType,
  ProjectGraph,
  ProjectNode,
} from "./graph.ts";

function compareText(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function byNodeId(a: ProjectNode, b: ProjectNode): number {
  return compareText(a.id, b.id);
}

function byEdge(a: ProjectDependencyEdge, b: ProjectDependencyEdge): number {
  if (a.source !== b.source) return compareText(a.source, b.source);
  if (a.target !== b.target) return compareText(a.target, b.target);
  return compareText(a.type, b.type);
}

function addProjectEdges(
  edges: ProjectDependencyEdge[],
  source: string,
  deps: readonly string[] | undefined,
  type: ProjectDependencyEdgeType,
): void {
  if (!deps || deps.length === 0) return;
  for (const target of deps) {
    edges.push({ source, target, type });
  }
}

/**
 * Builds a workspace project graph from loaded project/workspace config.
 */
export function buildProjectGraph(
  projects: readonly ProjectConfig[],
  workspaceConfig?: Pick<WorkspaceConfig, "dependencyEdges">,
): ProjectGraph {
  const nodes: ProjectNode[] = projects.map((project) => ({
    id: project.name,
    root: project.root,
    ...(project.tags !== undefined && { tags: project.tags }),
  }));

  const edges: ProjectDependencyEdge[] = [];
  for (const project of projects) {
    addProjectEdges(edges, project.name, project.implicitDependencies, "implicit");
    addProjectEdges(edges, project.name, project.explicitDependencies, "explicit");
  }
  for (const edge of workspaceConfig?.dependencyEdges ?? []) {
    edges.push({ source: edge.source, target: edge.target, type: "explicit" });
  }

  const uniqueEdges = new Map<string, Map<string, Map<ProjectDependencyEdgeType, ProjectDependencyEdge>>>();
  for (const edge of edges) {
    if (!uniqueEdges.has(edge.source)) {
      uniqueEdges.set(edge.source, new Map());
    }
    const bySource = uniqueEdges.get(edge.source)!;
    if (!bySource.has(edge.target)) {
      bySource.set(edge.target, new Map());
    }
    bySource.get(edge.target)!.set(edge.type, edge);
  }

  const dedupedEdges: ProjectDependencyEdge[] = [];
  for (const bySource of uniqueEdges.values()) {
    for (const byTarget of bySource.values()) {
      dedupedEdges.push(...byTarget.values());
    }
  }

  return {
    nodes: [...nodes].sort(byNodeId),
    edges: dedupedEdges.sort(byEdge),
  };
}
