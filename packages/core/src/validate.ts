/**
 * Runtime schema validation for workspace and project configuration.
 *
 * Provides guard functions that validate {@link WorkspaceConfig} and
 * {@link ProjectConfig} objects at runtime, returning structured diagnostics
 * rather than throwing so callers can decide how to surface errors.
 *
 * @module
 */

import type {
  InputDefinition,
  NamedInput,
  ProjectConfig,
  TargetConfig,
  TargetDefaults,
  TargetDependency,
  WorkspaceConfig,
} from "./config.ts";

// ---------------------------------------------------------------------------
// Diagnostic types
// ---------------------------------------------------------------------------

/**
 * A single validation diagnostic describing one problem found in a config
 * object.
 *
 * The `path` field uses a dot-notation / bracket-notation convention similar
 * to JSON Pointer, making it easy to pinpoint the offending field in nested
 * structures (e.g. `"projects[0].name"`, `"targetDefaults.build.cache"`).
 */
export interface ConfigDiagnostic {
  /**
   * Dot/bracket-notation path to the offending field.
   *
   * @example "members"
   * @example "namedInputs.default[2]"
   */
  readonly path: string;

  /** Human-readable description of the problem. */
  readonly message: string;
}

/**
 * Result of validating a config object.
 *
 * - `ok: true`  — the config is valid; `diagnostics` is empty.
 * - `ok: false` — one or more problems were found; see `diagnostics`.
 *
 * Keeping the two cases in a discriminated union makes exhaustive handling
 * straightforward for callers:
 *
 * ```ts
 * const result = validateWorkspaceConfig(raw);
 * if (!result.ok) {
 *   for (const d of result.diagnostics) console.error(`${d.path}: ${d.message}`);
 * }
 * ```
 */
export type ValidationResult =
  | { readonly ok: true; readonly diagnostics: readonly [] }
  | {
    readonly ok: false;
    readonly diagnostics: readonly [
      ConfigDiagnostic,
      ...ConfigDiagnostic[],
    ];
  };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns `true` when the value is a non-null plain object. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Returns `true` when every element of `arr` satisfies `pred`. */
function isArrayOf<T>(
  arr: unknown,
  pred: (v: unknown) => v is T,
): arr is T[] {
  return Array.isArray(arr) && arr.every(pred);
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === "boolean";
}

/**
 * Validates a single {@link InputDefinition} value, pushing any diagnostics
 * found onto `diags`.
 */
function validateInputDefinition(
  value: unknown,
  path: string,
  diags: ConfigDiagnostic[],
): void {
  if (!isPlainObject(value)) {
    diags.push({ path, message: "must be a plain object" });
    return;
  }

  const keys = Object.keys(value);
  const hasInput = "input" in value;
  const hasFileset = "fileset" in value;
  const hasRuntime = "runtime" in value;
  const hasEnv = "env" in value;

  const variantCount = [hasInput, hasFileset, hasRuntime, hasEnv].filter(
    Boolean,
  ).length;

  if (variantCount === 0) {
    diags.push({
      path,
      message:
        'must have exactly one of "input", "fileset", "runtime", or "env"',
    });
    return;
  }

  if (variantCount > 1) {
    diags.push({
      path,
      message:
        '"input", "fileset", "runtime", and "env" are mutually exclusive',
    });
    return;
  }

  if (hasInput) {
    if (!isString(value["input"])) {
      diags.push({ path: `${path}.input`, message: "must be a string" });
    }
    if ("projects" in value) {
      const p = value["projects"];
      if (p !== "self" && p !== "dependencies") {
        diags.push({
          path: `${path}.projects`,
          message: 'must be "self" or "dependencies"',
        });
      }
    }
    const allowedKeys = new Set(["input", "projects"]);
    for (const k of keys) {
      if (!allowedKeys.has(k)) {
        diags.push({
          path: `${path}.${k}`,
          message: "unexpected property in input variant",
        });
      }
    }
  } else if (hasFileset) {
    if (!isString(value["fileset"])) {
      diags.push({ path: `${path}.fileset`, message: "must be a string" });
    }
  } else if (hasRuntime) {
    if (!isString(value["runtime"])) {
      diags.push({ path: `${path}.runtime`, message: "must be a string" });
    }
  } else if (hasEnv) {
    if (!isString(value["env"])) {
      diags.push({ path: `${path}.env`, message: "must be a string" });
    }
  }
}

/**
 * Validates a {@link NamedInput} array, pushing any diagnostics found onto
 * `diags`.
 */
function validateNamedInput(
  value: unknown,
  path: string,
  diags: ConfigDiagnostic[],
): void {
  if (!Array.isArray(value)) {
    diags.push({ path, message: "must be an array" });
    return;
  }
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (!isString(item) && !isPlainObject(item)) {
      diags.push({
        path: `${path}[${i}]`,
        message: "must be a string or InputDefinition object",
      });
    } else if (isPlainObject(item)) {
      validateInputDefinition(item, `${path}[${i}]`, diags);
    }
  }
}

/**
 * Validates a named-inputs record, pushing any diagnostics found onto
 * `diags`.
 */
function validateNamedInputs(
  value: unknown,
  path: string,
  diags: ConfigDiagnostic[],
): void {
  if (!isPlainObject(value)) {
    diags.push({ path, message: "must be a plain object" });
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    validateNamedInput(entry, `${path}.${key}`, diags);
  }
}

/**
 * Validates a single {@link TargetDependency}, pushing any diagnostics found
 * onto `diags`.
 */
function validateTargetDependency(
  value: unknown,
  path: string,
  diags: ConfigDiagnostic[],
): void {
  if (isString(value)) return;

  if (!isPlainObject(value)) {
    diags.push({
      path,
      message: "must be a string or TargetDependency object",
    });
    return;
  }

  if (!("target" in value) || !isString(value["target"])) {
    diags.push({ path: `${path}.target`, message: "must be a string" });
  }
  if ("projects" in value) {
    const p = value["projects"];
    if (!isString(p)) {
      diags.push({
        path: `${path}.projects`,
        message: 'must be "self", "dependencies", or a project name string',
      });
    }
  }
}

/**
 * Validates a single {@link TargetConfig}, pushing any diagnostics found onto
 * `diags`.
 */
function validateTargetConfig(
  value: unknown,
  path: string,
  diags: ConfigDiagnostic[],
): void {
  if (!isPlainObject(value)) {
    diags.push({ path, message: "must be a plain object" });
    return;
  }

  if ("command" in value && !isString(value["command"])) {
    diags.push({ path: `${path}.command`, message: "must be a string" });
  }
  if ("executor" in value && !isString(value["executor"])) {
    diags.push({ path: `${path}.executor`, message: "must be a string" });
  }
  if ("cache" in value && !isBoolean(value["cache"])) {
    diags.push({ path: `${path}.cache`, message: "must be a boolean" });
  }
  if ("outputs" in value) {
    const outs = value["outputs"];
    if (!isArrayOf(outs, isString)) {
      diags.push({
        path: `${path}.outputs`,
        message: "must be an array of strings",
      });
    }
  }
  if ("inputs" in value) {
    const inputs = value["inputs"];
    if (!Array.isArray(inputs)) {
      diags.push({ path: `${path}.inputs`, message: "must be an array" });
    } else {
      for (let i = 0; i < inputs.length; i++) {
        const item = inputs[i];
        if (!isString(item) && !isPlainObject(item)) {
          diags.push({
            path: `${path}.inputs[${i}]`,
            message: "must be a string or InputDefinition object",
          });
        } else if (isPlainObject(item)) {
          validateInputDefinition(item, `${path}.inputs[${i}]`, diags);
        }
      }
    }
  }
  if ("dependsOn" in value) {
    const deps = value["dependsOn"];
    if (!Array.isArray(deps)) {
      diags.push({ path: `${path}.dependsOn`, message: "must be an array" });
    } else {
      for (let i = 0; i < deps.length; i++) {
        validateTargetDependency(deps[i], `${path}.dependsOn[${i}]`, diags);
      }
    }
  }
  if ("options" in value && !isPlainObject(value["options"])) {
    diags.push({ path: `${path}.options`, message: "must be a plain object" });
  }
}

/**
 * Validates a targets record (`Record<string, TargetConfig>`), pushing any
 * diagnostics found onto `diags`.
 */
function validateTargets(
  value: unknown,
  path: string,
  diags: ConfigDiagnostic[],
): void {
  if (!isPlainObject(value)) {
    diags.push({ path, message: "must be a plain object" });
    return;
  }
  for (const [key, target] of Object.entries(value)) {
    validateTargetConfig(target, `${path}.${key}`, diags);
  }
}

/**
 * Validates a targetDefaults record (`Record<string, TargetDefaults>`),
 * pushing any diagnostics found onto `diags`.
 *
 * {@link TargetDefaults} is a subset of {@link TargetConfig}, so we reuse the
 * same validator but only the shared fields are checked.
 */
function validateTargetDefaults(
  value: unknown,
  path: string,
  diags: ConfigDiagnostic[],
): void {
  if (!isPlainObject(value)) {
    diags.push({ path, message: "must be a plain object" });
    return;
  }
  for (const [key, defaults] of Object.entries(value)) {
    validateTargetConfig(defaults, `${path}.${key}`, diags);
  }
}

// ---------------------------------------------------------------------------
// Public validators
// ---------------------------------------------------------------------------

/**
 * Validates a {@link WorkspaceConfig} object at runtime.
 *
 * Checks all required fields, validates types for optional fields, and
 * recurses into nested structures. Returns a {@link ValidationResult} that
 * callers can inspect without any exceptions being thrown.
 *
 * @param raw - The value to validate (typically a parsed JSON object).
 * @returns A {@link ValidationResult} indicating whether `raw` is a valid
 *   `WorkspaceConfig`.
 *
 * @example
 * ```ts
 * const result = validateWorkspaceConfig(parsedJson);
 * if (!result.ok) {
 *   for (const d of result.diagnostics) {
 *     console.error(`[${d.path}] ${d.message}`);
 *   }
 * }
 * ```
 */
export function validateWorkspaceConfig(raw: unknown): ValidationResult {
  const diags: ConfigDiagnostic[] = [];

  if (!isPlainObject(raw)) {
    return {
      ok: false,
      diagnostics: [{ path: "", message: "must be a plain object" }],
    };
  }

  // Required: members
  if (!("members" in raw)) {
    diags.push({ path: "members", message: 'required field "members" is missing' });
  } else if (!isArrayOf(raw["members"], isString)) {
    diags.push({ path: "members", message: "must be an array of strings" });
  }

  // Optional: namedInputs
  if ("namedInputs" in raw && raw["namedInputs"] !== undefined) {
    validateNamedInputs(raw["namedInputs"], "namedInputs", diags);
  }

  // Optional: targetDefaults
  if ("targetDefaults" in raw && raw["targetDefaults"] !== undefined) {
    validateTargetDefaults(raw["targetDefaults"], "targetDefaults", diags);
  }

  if (diags.length === 0) {
    return { ok: true, diagnostics: [] };
  }
  return {
    ok: false,
    diagnostics: diags as [ConfigDiagnostic, ...ConfigDiagnostic[]],
  };
}

/**
 * Validates a {@link ProjectConfig} object at runtime.
 *
 * Checks all required fields, validates types for optional fields, and
 * recurses into nested structures. Returns a {@link ValidationResult} that
 * callers can inspect without any exceptions being thrown.
 *
 * @param raw - The value to validate (typically a parsed JSON object).
 * @returns A {@link ValidationResult} indicating whether `raw` is a valid
 *   `ProjectConfig`.
 *
 * @example
 * ```ts
 * const result = validateProjectConfig(parsedJson);
 * if (!result.ok) {
 *   for (const d of result.diagnostics) {
 *     console.error(`[${d.path}] ${d.message}`);
 *   }
 * }
 * ```
 */
export function validateProjectConfig(raw: unknown): ValidationResult {
  const diags: ConfigDiagnostic[] = [];

  if (!isPlainObject(raw)) {
    return {
      ok: false,
      diagnostics: [{ path: "", message: "must be a plain object" }],
    };
  }

  // Required: name
  if (!("name" in raw)) {
    diags.push({ path: "name", message: 'required field "name" is missing' });
  } else if (!isString(raw["name"])) {
    diags.push({ path: "name", message: "must be a string" });
  }

  // Required: root
  if (!("root" in raw)) {
    diags.push({ path: "root", message: 'required field "root" is missing' });
  } else if (!isString(raw["root"])) {
    diags.push({ path: "root", message: "must be a string" });
  }

  // Optional: version
  if ("version" in raw && raw["version"] !== undefined) {
    if (!isString(raw["version"])) {
      diags.push({ path: "version", message: "must be a string" });
    }
  }

  // Optional: tags
  if ("tags" in raw && raw["tags"] !== undefined) {
    if (!isArrayOf(raw["tags"], isString)) {
      diags.push({ path: "tags", message: "must be an array of strings" });
    }
  }

  // Optional: targets
  if ("targets" in raw && raw["targets"] !== undefined) {
    validateTargets(raw["targets"], "targets", diags);
  }

  // Optional: implicitDependencies
  if ("implicitDependencies" in raw && raw["implicitDependencies"] !== undefined) {
    if (!isArrayOf(raw["implicitDependencies"], isString)) {
      diags.push({
        path: "implicitDependencies",
        message: "must be an array of strings",
      });
    }
  }

  // Optional: namedInputs
  if ("namedInputs" in raw && raw["namedInputs"] !== undefined) {
    validateNamedInputs(raw["namedInputs"], "namedInputs", diags);
  }

  if (diags.length === 0) {
    return { ok: true, diagnostics: [] };
  }
  return {
    ok: false,
    diagnostics: diags as [ConfigDiagnostic, ...ConfigDiagnostic[]],
  };
}
