import type { ProjectConfig, WorkspaceConfig } from "./config.ts";
import type {
  ProjectDependencyEdge,
  ProjectDependencyEdgeType,
  ProjectGraph,
  ProjectNode,
} from "./graph.ts";

function byNodeId(a: ProjectNode, b: ProjectNode): number {
  return a.id.localeCompare(b.id);
}

function byEdge(a: ProjectDependencyEdge, b: ProjectDependencyEdge): number {
  if (a.source !== b.source) return a.source.localeCompare(b.source);
  if (a.target !== b.target) return a.target.localeCompare(b.target);
  return a.type.localeCompare(b.type);
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

  const uniqueEdges = new Map<string, ProjectDependencyEdge>();
  for (const edge of edges) {
    uniqueEdges.set(`${edge.source}\u0000${edge.target}\u0000${edge.type}`, edge);
  }

  return {
    nodes: [...nodes].sort(byNodeId),
    edges: [...uniqueEdges.values()].sort(byEdge),
  };
}
