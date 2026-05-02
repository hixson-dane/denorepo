/**
 * Root workspace config loader.
 *
 * Resolves and reads the root `deno.json` file from a given workspace root
 * directory, parses its `"workspace"` member array, validates the structure,
 * and returns a normalized {@link WorkspaceConfig}.
 *
 * All errors — file-not-found, parse failures, and structural problems — are
 * captured as {@link ConfigDiagnostic} entries rather than thrown, so callers
 * can decide how to surface them.
 *
 * @module
 */

import { parse as parseJsonc } from "jsr:@std/jsonc@^1";
import type { DependencyEdgeConfig, WorkspaceConfig } from "./config.ts";
import { type ConfigDiagnostic, ConfigErrorCode } from "./errors.ts";
import { validateWorkspaceConfig } from "./validate.ts";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

/**
 * Result of loading the root workspace config.
 *
 * - `ok: true`  — the file was read, parsed, and is structurally valid;
 *   `config` holds the normalized {@link WorkspaceConfig}.
 * - `ok: false` — something went wrong (I/O error, parse error, or schema
 *   violation); see `diagnostics` for a list of problems.
 *
 * @example
 * ```ts
 * const result = await loadWorkspaceConfig("/path/to/workspace");
 * if (!result.ok) {
 *   for (const d of result.diagnostics) {
 *     console.error(`[${d.path}] ${d.message}`);
 *   }
 * }
 * ```
 */
export type LoadWorkspaceConfigResult =
  | { readonly ok: true; readonly config: WorkspaceConfig }
  | {
    readonly ok: false;
    readonly diagnostics: readonly [ConfigDiagnostic, ...ConfigDiagnostic[]];
  };

// ---------------------------------------------------------------------------
// Loader options
// ---------------------------------------------------------------------------

/**
 * Options for {@link loadWorkspaceConfig}.
 */
export interface LoadWorkspaceConfigOptions {
  /**
   * Override the file-reading implementation.
   *
   * Defaults to {@link Deno.readTextFile}. Inject a custom function in tests
   * to avoid real file-system access.
   *
   * @param path - Absolute path to the file to read.
   * @returns The file contents as a UTF-8 string.
   */
  readFile?: (path: string) => Promise<string>;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Loads and normalizes the root workspace configuration from a `deno.json`
 * file located in `workspaceRoot`.
 *
 * The function:
 * 1. Constructs the path `{workspaceRoot}/deno.json`.
 * 2. Reads the file (using {@link LoadWorkspaceConfigOptions.readFile} if
 *    provided, otherwise {@link Deno.readTextFile}).
 * 3. Parses the content as JSONC (JSON with comments).
 * 4. Validates that the root value is a plain object containing a `"workspace"`
 *    array of strings; collects any structural violations as diagnostics.
 * 5. Returns a normalized {@link WorkspaceConfig} whose `members` field
 *    corresponds to the `"workspace"` array in `deno.json`.
 *
 * @param workspaceRoot - Absolute path string or `file:` URL pointing to the
 *   directory that contains the root `deno.json`.
 * @param options - Optional overrides (see {@link LoadWorkspaceConfigOptions}).
 * @returns A {@link LoadWorkspaceConfigResult} indicating success or failure.
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
export async function loadWorkspaceConfig(
  workspaceRoot: string | URL,
  options?: LoadWorkspaceConfigOptions,
): Promise<LoadWorkspaceConfigResult> {
  const readFile = options?.readFile ?? Deno.readTextFile.bind(Deno);

  // Resolve the path to deno.json, stripping any trailing slashes.
  const root = workspaceRoot instanceof URL
    ? workspaceRoot.pathname
    : workspaceRoot;
  const configPath = `${root.replace(/\/+$/, "")}/deno.json`;

  // ── Step 1: Read the file ──────────────────────────────────────────────────
  let text: string;
  try {
    text = await readFile(configPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      diagnostics: [{
        code: ConfigErrorCode.READ_ERROR,
        path: "",
        message: `Failed to read deno.json: ${message}`,
        file: configPath,
      }],
    };
  }

  // ── Step 2: Parse JSONC ────────────────────────────────────────────────────
  let raw: unknown;
  try {
    raw = parseJsonc(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      diagnostics: [{
        code: ConfigErrorCode.PARSE_ERROR,
        path: "",
        message: `Failed to parse deno.json: ${message}`,
        file: configPath,
      }],
    };
  }

  // ── Step 3: Top-level shape ────────────────────────────────────────────────
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {
      ok: false,
      diagnostics: [{
        code: ConfigErrorCode.INVALID_TYPE,
        path: "",
        message: "deno.json must be a plain object",
        file: configPath,
      }],
    };
  }

  const obj = raw as Record<string, unknown>;

  // ── Step 4: Validate the "workspace" field ─────────────────────────────────
  if (!("workspace" in obj)) {
    return {
      ok: false,
      diagnostics: [{
        code: ConfigErrorCode.MISSING_FIELD,
        path: "workspace",
        message: 'required field "workspace" is missing',
        file: configPath,
      }],
    };
  }

  const workspace = obj["workspace"];

  if (!Array.isArray(workspace)) {
    return {
      ok: false,
      diagnostics: [{
        code: ConfigErrorCode.INVALID_TYPE,
        path: "workspace",
        message: "must be an array",
        file: configPath,
      }],
    };
  }

  const diags: ConfigDiagnostic[] = [];
  for (let i = 0; i < workspace.length; i++) {
    if (typeof workspace[i] !== "string") {
      diags.push({
        code: ConfigErrorCode.INVALID_TYPE,
        path: `workspace[${i}]`,
        message: "must be a string",
        file: configPath,
      });
    }
  }

  if (diags.length > 0) {
    return {
      ok: false,
      diagnostics: diags as [ConfigDiagnostic, ...ConfigDiagnostic[]],
    };
  }

  // ── Step 5: Normalize to WorkspaceConfig ───────────────────────────────────
  const config: WorkspaceConfig = {
    members: workspace as string[],
    ...(obj["dependencyEdges"] !== undefined && {
      dependencyEdges: obj["dependencyEdges"] as readonly DependencyEdgeConfig[],
    }),
  };

  const validation = validateWorkspaceConfig(config);
  if (!validation.ok) {
    const diagnostics = validation.diagnostics.map((d) => ({
      ...d,
      file: configPath,
    })) as [ConfigDiagnostic, ...ConfigDiagnostic[]];
    return { ok: false, diagnostics };
  }

  return { ok: true, config };
}
