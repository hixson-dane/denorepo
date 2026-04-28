/**
 * Per-project config loader.
 *
 * Resolves and reads each workspace member's `deno.json` file, parses it as
 * JSONC, validates the structure against {@link ProjectConfig}, and returns a
 * per-member result array.  Individual member failures are captured as
 * diagnostics rather than thrown, so callers can inspect all outcomes — even
 * when some members are missing or malformed — without a single failure
 * aborting the whole load.
 *
 * @module
 */

import { parse as parseJsonc } from "jsr:@std/jsonc@^1";
import type { NamedInput, ProjectConfig, TargetConfig } from "./config.ts";
import { type ConfigDiagnostic, ConfigErrorCode } from "./errors.ts";
import { validateProjectConfig } from "./validate.ts";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/**
 * Result of loading a single workspace member's project config.
 *
 * - `ok: true`  — the member's `deno.json` was read, parsed, and validated;
 *   `config` holds the normalized {@link ProjectConfig}.
 * - `ok: false` — something went wrong (I/O error, parse error, or schema
 *   violation); `diagnostics` lists every problem found.
 *
 * The `member` field always identifies the relative member path (e.g.
 * `"packages/core"`) so callers can correlate results with workspace members.
 */
export type LoadMemberConfigResult =
  | { readonly ok: true; readonly member: string; readonly config: ProjectConfig }
  | {
    readonly ok: false;
    readonly member: string;
    readonly diagnostics: readonly [ConfigDiagnostic, ...ConfigDiagnostic[]];
  };

// ---------------------------------------------------------------------------
// Loader options
// ---------------------------------------------------------------------------

/**
 * Options for {@link loadProjectConfigs}.
 */
export interface LoadProjectConfigsOptions {
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
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns `true` when the value is a non-null plain object. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Loads and validates the `deno.json` for a single workspace member,
 * returning a {@link LoadMemberConfigResult}.
 */
async function loadOneMember(
  rootNorm: string,
  member: string,
  readFile: (path: string) => Promise<string>,
): Promise<LoadMemberConfigResult> {
  const configPath = `${rootNorm}/${member}/deno.json`;

  // ── Step 1: Read the file ──────────────────────────────────────────────────
  let text: string;
  try {
    text = await readFile(configPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      member,
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
      member,
      diagnostics: [{
        code: ConfigErrorCode.PARSE_ERROR,
        path: "",
        message: `Failed to parse deno.json: ${message}`,
        file: configPath,
      }],
    };
  }

  // ── Step 3: Top-level shape ────────────────────────────────────────────────
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      member,
      diagnostics: [{
        code: ConfigErrorCode.INVALID_TYPE,
        path: "",
        message: "deno.json must be a plain object",
        file: configPath,
      }],
    };
  }

  // ── Step 4: Validate using validateProjectConfig ───────────────────────────
  // Augment with `root` derived from the member path, since this field is not
  // stored in the project's own deno.json.
  const augmented: Record<string, unknown> = { ...raw, root: member };
  const validation = validateProjectConfig(augmented);
  if (!validation.ok) {
    // Annotate each validation diagnostic with the file path so callers have
    // full context even though the pure validator doesn't know about files.
    // The cast is safe: validation.ok === false guarantees a non-empty
    // diagnostics tuple per the ValidationResult type definition.
    const diagnostics = validation.diagnostics.map((d) => ({
      ...d,
      file: configPath,
    })) as [ConfigDiagnostic, ...ConfigDiagnostic[]];
    return { ok: false, member, diagnostics };
  }

  // ── Step 5: Normalize to ProjectConfig ────────────────────────────────────
  // Only pick the fields that belong to ProjectConfig; extra deno.json fields
  // (e.g. "exports", "tasks") are intentionally omitted.
  const config: ProjectConfig = {
    name: raw["name"] as string,
    root: member,
    ...(raw["version"] !== undefined && { version: raw["version"] as string }),
    ...(raw["tags"] !== undefined && { tags: raw["tags"] as readonly string[] }),
    ...(raw["targets"] !== undefined && {
      targets: raw["targets"] as Readonly<Record<string, TargetConfig>>,
    }),
    ...(raw["implicitDependencies"] !== undefined && {
      implicitDependencies: raw["implicitDependencies"] as readonly string[],
    }),
    ...(raw["namedInputs"] !== undefined && {
      namedInputs: raw["namedInputs"] as Readonly<Record<string, NamedInput>>,
    }),
  };

  return { ok: true, member, config };
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Loads and normalizes the project configuration for each workspace member.
 *
 * For each path in `members` the function:
 * 1. Constructs the path `{workspaceRoot}/{member}/deno.json`.
 * 2. Reads the file (using {@link LoadProjectConfigsOptions.readFile} if
 *    provided, otherwise {@link Deno.readTextFile}).
 * 3. Parses the content as JSONC (JSON with comments).
 * 4. Validates the parsed value against the {@link ProjectConfig} schema,
 *    injecting `root` from the member path automatically.
 * 5. Returns a normalized {@link ProjectConfig} or a list of diagnostics.
 *
 * Members are processed concurrently. A failure for one member does **not**
 * abort the others; every member gets an independent {@link LoadMemberConfigResult}.
 *
 * @param workspaceRoot - Absolute path string or `file:` URL pointing to the
 *   directory that contains the root `deno.json`.
 * @param members - Relative member paths as listed in the workspace
 *   `deno.json` (e.g. `["packages/core", "apps/remote-cache"]`).
 * @param options - Optional overrides (see {@link LoadProjectConfigsOptions}).
 * @returns An array of {@link LoadMemberConfigResult} values, one per member,
 *   in the same order as `members`.
 *
 * @example
 * ```ts
 * import { loadProjectConfigs } from "@denorepo/core";
 *
 * const results = await loadProjectConfigs(Deno.cwd(), ["packages/core"]);
 * for (const r of results) {
 *   if (r.ok) {
 *     console.log(r.member, "→", r.config.name);
 *   } else {
 *     console.error(r.member, "failed:", r.diagnostics);
 *   }
 * }
 * ```
 */
export async function loadProjectConfigs(
  workspaceRoot: string | URL,
  members: readonly string[],
  options?: LoadProjectConfigsOptions,
): Promise<readonly LoadMemberConfigResult[]> {
  const readFile = options?.readFile ?? Deno.readTextFile.bind(Deno);

  const root = workspaceRoot instanceof URL
    ? workspaceRoot.pathname
    : workspaceRoot;
  const rootNorm = root.replace(/\/+$/, "");

  return Promise.all(
    members.map((member) => loadOneMember(rootNorm, member, readFile)),
  );
}
