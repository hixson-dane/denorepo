/**
 * Domain types for workspace and project configuration.
 *
 * These types describe the logical configuration model used by the workspace
 * engine. They are implementation-agnostic: no parsing, validation, or I/O
 * code lives here — only the shapes of the data.
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------

/**
 * A structured input definition used when computing task cache keys.
 *
 * - `{ input }` — references a named input set, optionally scoped to the
 *   current project (`"self"`) or its transitive dependencies
 *   (`"dependencies"`).
 * - `{ fileset }` — a glob pattern selecting source files relative to the
 *   project root.
 * - `{ runtime }` — a shell command whose stdout is included in the hash.
 * - `{ env }` — an environment variable name whose value is included in the
 *   hash.
 */
export type InputDefinition =
  | { readonly input: string; readonly projects?: "self" | "dependencies" }
  | { readonly fileset: string }
  | { readonly runtime: string }
  | { readonly env: string };

/**
 * A named input set: an ordered list of glob strings or structured
 * {@link InputDefinition} values. Named inputs are defined once and
 * referenced by name in target configurations to keep cache-key rules DRY.
 */
export type NamedInput = ReadonlyArray<string | InputDefinition>;

/**
 * A target dependency declaration.
 *
 * - Plain string — the name of another target in the **same** project that
 *   must complete before this one (e.g. `"build"`).
 * - Object form — allows cross-project or scoped dependencies:
 *   - `target`: the target name to depend on.
 *   - `projects`: `"self"` (same project), `"dependencies"` (all transitive
 *     dependency projects), or an explicit project name string.
 */
export type TargetDependency =
  | string
  | { readonly target: string; readonly projects?: "self" | "dependencies" | string };

// ---------------------------------------------------------------------------
// TargetConfig
// ---------------------------------------------------------------------------

/**
 * Configuration for a single named target (task) within a project.
 *
 * Either `command` or `executor` must be provided; they are mutually
 * exclusive in practice, though both are optional here to allow incremental
 * definition and workspace-level defaulting.
 */
export interface TargetConfig {
  /**
   * Shell command to run when this target is invoked.
   * Mutually exclusive with {@link executor}.
   */
  readonly command?: string;

  /**
   * Executor plugin identifier (e.g. `"@denorepo/plugin-deno:build"`).
   * Mutually exclusive with {@link command}.
   */
  readonly executor?: string;

  /**
   * Input definitions used to compute the cache key for this target.
   * Each entry is either a named input reference string or a structured
   * {@link InputDefinition}.
   */
  readonly inputs?: ReadonlyArray<string | InputDefinition>;

  /**
   * Output paths (relative to the project root) that should be cached and
   * restored on a cache hit.
   */
  readonly outputs?: readonly string[];

  /**
   * Targets that must complete before this target executes.
   * Each entry is either a plain target name (within the same project) or a
   * {@link TargetDependency} object for cross-project or scoped dependencies.
   */
  readonly dependsOn?: ReadonlyArray<TargetDependency>;

  /**
   * Whether this target's outputs are eligible for caching.
   * Defaults to `true` when inputs/outputs are defined.
   */
  readonly cache?: boolean;

  /** Executor-specific options passed through to the executor or command. */
  readonly options?: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// TargetDefaults
// ---------------------------------------------------------------------------

/**
 * Workspace-level default values for a target.
 *
 * Applied to every project target whose name matches the key in
 * {@link WorkspaceConfig.targetDefaults}. Per-project values override these
 * defaults.
 */
export type TargetDefaults = Pick<
  TargetConfig,
  "inputs" | "outputs" | "dependsOn" | "cache" | "options"
>;

// ---------------------------------------------------------------------------
// ProjectConfig
// ---------------------------------------------------------------------------

/**
 * Per-project configuration describing a single workspace member.
 */
export interface ProjectConfig {
  /**
   * Scoped package identifier following the `@scope/name` convention.
   * Used as the canonical identifier throughout the workspace graph.
   *
   * @example "@denorepo/core"
   */
  readonly name: string;

  /**
   * Path to the project root directory, relative to the workspace root.
   *
   * @example "packages/core"
   */
  readonly root: string;

  /**
   * Package version string (semver).
   * All workspace members share `"0.0.0"` during the MVP phase.
   */
  readonly version?: string;

  /**
   * Classification tags used for grouping, filtering, and enforcing
   * dependency boundary rules.
   *
   * @example ["scope:core", "type:library"]
   */
  readonly tags?: readonly string[];

  /**
   * Named targets (tasks) provided by this project, keyed by target name.
   *
   * @example { "build": { command: "deno compile …" }, "test": { command: "deno test" } }
   */
  readonly targets?: Readonly<Record<string, TargetConfig>>;

  /**
   * Implicit dependencies on other projects expressed as project
   * {@link ProjectConfig.name} strings. Used when a dependency exists at
   * the workspace level but is not reflected in source imports.
   */
  readonly implicitDependencies?: readonly string[];

  /**
   * Explicit project dependencies declared directly in project config.
   *
   * These are modeled as directed graph edges where the current project is the
   * source and each listed project is a target.
   */
  readonly explicitDependencies?: readonly string[];

  /**
   * Project-level named input overrides. These are merged with (and take
   * precedence over) the workspace-level {@link WorkspaceConfig.namedInputs}.
   */
  readonly namedInputs?: Readonly<Record<string, NamedInput>>;
}

/**
 * Workspace-level dependency edge declaration.
 *
 * `source` depends on `target`.
 */
export interface DependencyEdgeConfig {
  /** Dependent project name. */
  readonly source: string;

  /** Dependency project name. */
  readonly target: string;
}

// ---------------------------------------------------------------------------
// DepConstraint
// ---------------------------------------------------------------------------

/**
 * A single tag-based dependency constraint.
 *
 * When a project carries {@link sourceTag}, the constraint further restricts
 * which projects it is allowed to declare as dependencies (via
 * {@link ProjectConfig.implicitDependencies}):
 *
 * - {@link notDependOnLibsWithTags} — the source project must **not** depend
 *   on any project that has any of the listed tags.
 * - {@link onlyDependOnLibsWithTags} — the source project may **only** depend
 *   on projects that carry at least one of the listed tags.
 *
 * At least one of the two optional arrays must be provided for the constraint
 * to have any effect.
 *
 * @example
 * ```ts
 * // core must not depend on cli
 * const constraint: DepConstraint = {
 *   sourceTag: "scope:core",
 *   notDependOnLibsWithTags: ["scope:cli"],
 * };
 * ```
 */
export interface DepConstraint {
  /**
   * The tag that must be present on the source project for this constraint to
   * apply. The value must match one of the project's {@link ProjectConfig.tags}
   * entries exactly.
   */
  readonly sourceTag: string;

  /**
   * Tags that dependency projects are **forbidden** from having.
   *
   * If the dependency project carries any of these tags, a
   * {@link ConfigErrorCode.FORBIDDEN_DEPENDENCY} diagnostic is emitted.
   */
  readonly notDependOnLibsWithTags?: readonly string[];

  /**
   * Tags of which dependency projects must have **at least one**.
   *
   * If the dependency project carries none of the listed tags, a
   * {@link ConfigErrorCode.FORBIDDEN_DEPENDENCY} diagnostic is emitted.
   */
  readonly onlyDependOnLibsWithTags?: readonly string[];
}

// ---------------------------------------------------------------------------
// WorkspaceConfig
// ---------------------------------------------------------------------------

/**
 * Top-level workspace configuration describing the overall monorepo.
 */
export interface WorkspaceConfig {
  /**
   * Relative paths to workspace member directories.
   * Each entry must correspond to a directory containing a `deno.json` manifest.
   *
   * @example ["packages/core", "packages/cli", "apps/remote-cache"]
   */
  readonly members: readonly string[];

  /**
   * Named input sets shared across all projects.
   * Projects may reference these by name in their target `inputs` arrays.
   */
  readonly namedInputs?: Readonly<Record<string, NamedInput>>;

  /**
   * Workspace-wide default settings for named targets.
   * Applied to every matching target across all projects; per-project values
   * take precedence.
   */
  readonly targetDefaults?: Readonly<Record<string, TargetDefaults>>;

  /**
   * Workspace-level explicit dependency edges between projects.
   */
  readonly dependencyEdges?: readonly DependencyEdgeConfig[];

  /**
   * Tag-based architecture dependency constraints applied to all projects in
   * this workspace.
   *
   * Each entry specifies rules for projects that carry a particular
   * {@link DepConstraint.sourceTag}. When {@link validateArchitectureDependencies}
   * is called with the loaded project configs, any
   * {@link ProjectConfig.implicitDependencies} that violate these rules are
   * reported as {@link ConfigErrorCode.FORBIDDEN_DEPENDENCY} diagnostics.
   *
   * @example
   * ```ts
   * constraints: [
   *   { sourceTag: "scope:core", notDependOnLibsWithTags: ["scope:cli"] },
   *   { sourceTag: "scope:remote-cache", notDependOnLibsWithTags: ["scope:cli"] },
   * ]
   * ```
   */
  readonly constraints?: readonly DepConstraint[];
}
