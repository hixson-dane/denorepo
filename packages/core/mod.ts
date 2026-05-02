/**
 * @module @denorepo/core
 *
 * Workspace configuration engine for Deno monorepos.
 *
 * Provides loaders, validators, and types for reading and verifying the
 * workspace root `deno.json` and each member project's `deno.json`.
 *
 * ## Quick start
 *
 * ```ts
 * import { loadWorkspaceConfig, loadProjectConfigs } from "@denorepo/core";
 *
 * // 1. Load the root workspace config
 * const wsResult = await loadWorkspaceConfig(Deno.cwd());
 * if (!wsResult.ok) {
 *   for (const d of wsResult.diagnostics) {
 *     console.error(`[${d.code}] ${d.path}: ${d.message}`);
 *   }
 *   Deno.exit(1);
 * }
 *
 * // 2. Load every member project config
 * const results = await loadProjectConfigs(Deno.cwd(), wsResult.config.members);
 * for (const r of results) {
 *   if (r.ok) {
 *     console.log(r.config.name, "→", r.config.root);
 *   } else {
 *     console.error(r.member, "failed:", r.diagnostics);
 *   }
 * }
 * ```
 *
 * ## API overview
 *
 * ### Config types
 * - {@link WorkspaceConfig} — top-level workspace configuration (members, constraints, defaults)
 * - {@link ProjectConfig} — per-project configuration for a single workspace member
 * - {@link TargetConfig} — configuration for a named target (task) within a project
 * - {@link TargetDefaults} — workspace-wide default settings applied to named targets
 * - {@link DepConstraint} — tag-based architecture dependency constraint rule
 * - {@link InputDefinition} — structured cache-key input (glob, env var, runtime command, etc.)
 * - {@link NamedInput} — ordered list of input definitions, referenced by name
 * - {@link TargetDependency} — dependency on another target, optionally cross-project
 * - {@link ProjectNode} — one project node in the workspace graph
 * - {@link ProjectDependencyEdge} — directed dependency edge between projects
 * - {@link ProjectGraph} — graph container with project nodes and edges
 *
 * ### Loaders
 * - {@link loadWorkspaceConfig} — read, parse, and validate the root `deno.json`
 * - {@link loadProjectConfigs} — load and validate all workspace member `deno.json` files
 *
 * ### Validation
 * - {@link validateWorkspaceConfig} — validate a parsed {@link WorkspaceConfig} object
 * - {@link validateProjectConfig} — validate a parsed {@link ProjectConfig} object
 * - {@link validateArchitectureDependencies} — enforce tag-based dependency boundary rules
 *
 * ### Diagnostics and errors
 * - {@link ConfigDiagnostic} — one structured problem found during loading or validation
 * - {@link ValidationResult} — discriminated union result returned by validate functions
 * - {@link ConfigErrorCode} — machine-readable error code constants
 * - {@link ConfigError} — throwable error wrapping one or more {@link ConfigDiagnostic} entries
 * - {@link ValidationError} — {@link ConfigError} subclass for schema-validation failures
 */

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

/**
 * Core configuration types describing workspace and project shapes.
 *
 * Import these when building tools, plugins, or processors that consume
 * loaded config results from {@link loadWorkspaceConfig} or
 * {@link loadProjectConfigs}.
 */
export type {
  DepConstraint,
  InputDefinition,
  NamedInput,
  ProjectConfig,
  TargetConfig,
  TargetDefaults,
  TargetDependency,
  WorkspaceConfig,
} from "./src/config.ts";

/**
 * Domain types for representing project graph nodes and dependency edges.
 */
export type {
  ProjectDependencyEdge,
  ProjectGraph,
  ProjectNode,
  ProjectNodeId,
} from "./src/graph.ts";

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

/**
 * Result type and options for {@link loadWorkspaceConfig}.
 *
 * - {@link LoadWorkspaceConfigResult} — discriminated union: `ok: true` with
 *   a {@link WorkspaceConfig}, or `ok: false` with a non-empty diagnostics array.
 * - {@link LoadWorkspaceConfigOptions} — injectable `readFile` override for
 *   hermetic testing without real file-system access.
 */
export type {
  LoadWorkspaceConfigOptions,
  LoadWorkspaceConfigResult,
} from "./src/load.ts";

/**
 * Loads and normalizes the root workspace configuration from the `deno.json`
 * file located in `workspaceRoot`.
 *
 * All errors (I/O, parse, schema violations) are captured as
 * {@link ConfigDiagnostic} entries rather than thrown, so callers can decide
 * how to surface them.
 *
 * @example
 * ```ts
 * import { loadWorkspaceConfig } from "@denorepo/core";
 *
 * const result = await loadWorkspaceConfig(Deno.cwd());
 * if (result.ok) {
 *   console.log("Members:", result.config.members);
 * }
 * ```
 */
export { loadWorkspaceConfig } from "./src/load.ts";

/**
 * Result type and options for {@link loadProjectConfigs}.
 *
 * - {@link LoadMemberConfigResult} — per-member discriminated union: `ok: true`
 *   with a {@link ProjectConfig}, or `ok: false` with diagnostics.  The
 *   `member` field always identifies the relative path (e.g. `"packages/core"`).
 * - {@link LoadProjectConfigsOptions} — injectable `readFile` override for
 *   hermetic testing without real file-system access.
 */
export type {
  LoadMemberConfigResult,
  LoadProjectConfigsOptions,
} from "./src/load_project.ts";

/**
 * Loads and validates the `deno.json` for each workspace member path.
 *
 * Individual member failures are captured as diagnostics rather than thrown,
 * allowing callers to inspect all outcomes even when some members are missing
 * or malformed.
 *
 * @example
 * ```ts
 * import { loadProjectConfigs } from "@denorepo/core";
 *
 * const results = await loadProjectConfigs(Deno.cwd(), ["packages/core"]);
 * for (const r of results) {
 *   if (r.ok) console.log(r.config.name);
 * }
 * ```
 */
export { loadProjectConfigs } from "./src/load_project.ts";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Diagnostics and result types used by the validation functions.
 *
 * - {@link ConfigDiagnostic} — one structured problem (code, path, message,
 *   optional file reference).
 * - {@link ValidationResult} — discriminated union returned by validate
 *   functions: `ok: true` with an empty diagnostics tuple, or `ok: false`
 *   with a non-empty one.
 */
export type { ConfigDiagnostic, ValidationResult } from "./src/validate.ts";

/**
 * Runtime schema validators for workspace and project configuration objects.
 *
 * These operate on already-parsed data (no I/O) and return a
 * {@link ValidationResult} rather than throwing.
 *
 * - {@link validateWorkspaceConfig} — checks a {@link WorkspaceConfig} object.
 * - {@link validateProjectConfig} — checks a {@link ProjectConfig} object.
 * - {@link validateArchitectureDependencies} — enforces {@link DepConstraint}
 *   rules across the full set of loaded project configs.
 */
export {
  validateArchitectureDependencies,
  validateProjectConfig,
  validateWorkspaceConfig,
} from "./src/validate.ts";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Structured error and diagnostic types for config loading and validation.
 *
 * - {@link ConfigErrorCode} — stable, machine-readable string constants for
 *   every known failure category.
 * - {@link ConfigError} — throwable `Error` subclass that wraps one or more
 *   {@link ConfigDiagnostic} entries.
 * - {@link ValidationError} — {@link ConfigError} subclass specifically for
 *   schema-validation failures.
 */
export {
  ConfigError,
  ConfigErrorCode,
  ValidationError,
} from "./src/errors.ts";
