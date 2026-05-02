/**
 * Domain types for representing a workspace project graph.
 *
 * These types model graph data only — no graph construction, validation, or
 * rendering logic belongs here.
 *
 * @module
 */

/**
 * Canonical identifier for a project graph node.
 *
 * This value matches {@link ProjectConfig.name}.
 */
export type ProjectNodeId = string;

/**
 * A project node in the workspace graph.
 */
export interface ProjectNode {
  /**
   * Canonical project identifier (for example: `"@denorepo/core"`).
   */
  readonly id: ProjectNodeId;

  /**
   * Path to the project root directory, relative to workspace root.
   */
  readonly root: string;

  /**
   * Classification tags attached to the project, if any.
   */
  readonly tags?: readonly string[];
}

/**
 * A directed dependency edge between two project nodes.
 *
 * `source` depends on `target`.
 */
export interface ProjectDependencyEdge {
  /**
   * Dependent project node ID.
   */
  readonly source: ProjectNodeId;

  /**
   * Dependency project node ID.
   */
  readonly target: ProjectNodeId;
}

/**
 * Workspace project graph composed of nodes and directed dependency edges.
 */
export interface ProjectGraph {
  /**
   * All project nodes in the graph.
   */
  readonly nodes: readonly ProjectNode[];

  /**
   * Directed dependency edges between project nodes.
   */
  readonly edges: readonly ProjectDependencyEdge[];
}
