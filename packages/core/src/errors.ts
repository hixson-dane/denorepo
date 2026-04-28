/**
 * Structured error and diagnostic types for config loading and validation.
 *
 * Provides machine-readable error codes, human-readable messages, and
 * file/path/field references for each diagnostic. Designed for consumption
 * by CLI tools and automated processes that need to surface structured errors.
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

/**
 * Machine-readable error codes for config loading and validation failures.
 *
 * These codes are stable identifiers suitable for programmatic handling,
 * display filtering, and future CLI tool consumption.
 */
export const ConfigErrorCode = {
  /** File could not be read (I/O error, file not found, permission denied, etc.). */
  READ_ERROR: "CONFIG_READ_ERROR",
  /** File contents could not be parsed as JSONC. */
  PARSE_ERROR: "CONFIG_PARSE_ERROR",
  /** A required field is absent from the config object. */
  MISSING_FIELD: "CONFIG_MISSING_FIELD",
  /** A field has the wrong JavaScript/JSON type. */
  INVALID_TYPE: "CONFIG_INVALID_TYPE",
  /** A field has a value outside the allowed set of values. */
  INVALID_VALUE: "CONFIG_INVALID_VALUE",
  /** Two or more mutually-exclusive fields are present simultaneously. */
  MUTUALLY_EXCLUSIVE: "CONFIG_MUTUALLY_EXCLUSIVE",
  /** An unrecognized field was found where none is permitted. */
  UNEXPECTED_FIELD: "CONFIG_UNEXPECTED_FIELD",
} as const;

/** Union of all known {@link ConfigErrorCode} string values. */
export type ConfigErrorCode = typeof ConfigErrorCode[keyof typeof ConfigErrorCode];

// ---------------------------------------------------------------------------
// Diagnostic type
// ---------------------------------------------------------------------------

/**
 * A single structured diagnostic describing one problem found during config
 * loading or validation.
 *
 * The `path` field uses dot/bracket notation to pinpoint the offending field
 * within a config object (e.g. `"projects[0].name"`,
 * `"targetDefaults.build.cache"`). Use an empty string (`""`) when the error
 * applies to the entire file or has no specific field association.
 *
 * @example
 * ```ts
 * const diag: ConfigDiagnostic = {
 *   code: ConfigErrorCode.MISSING_FIELD,
 *   path: "name",
 *   message: 'required field "name" is missing',
 *   file: "/workspace/packages/core/deno.json",
 * };
 * ```
 */
export interface ConfigDiagnostic {
  /**
   * Machine-readable error code identifying the category of the problem.
   * Use {@link ConfigErrorCode} constants for known categories.
   */
  readonly code: ConfigErrorCode;

  /**
   * Dot/bracket-notation path to the offending field within the config object.
   *
   * @example "members"
   * @example "namedInputs.default[2]"
   */
  readonly path: string;

  /** Human-readable description of the problem. */
  readonly message: string;

  /**
   * Absolute or relative path to the config file that contains the problem.
   *
   * Present when the diagnostic is produced during file loading; absent when
   * produced by a pure validation function (which operates on already-parsed
   * data and has no knowledge of the originating file).
   */
  readonly file?: string;
}

// ---------------------------------------------------------------------------
// ConfigError
// ---------------------------------------------------------------------------

/**
 * A structured, throwable error produced when config loading or validation
 * fails.
 *
 * Wraps one or more {@link ConfigDiagnostic} entries so that callers can
 * inspect every problem rather than only the first. `Error.message` is set to
 * the primary (first) diagnostic's message for compatibility with standard
 * `catch (e)` handling.
 *
 * Use {@link ValidationError} for schema-validation-specific failures.
 *
 * @example
 * ```ts
 * try {
 *   // ...
 * } catch (e) {
 *   if (e instanceof ConfigError) {
 *     for (const d of e.diagnostics) {
 *       console.error(
 *         `[${d.code}] ${d.file ?? "<unknown>"}#${d.path}: ${d.message}`,
 *       );
 *     }
 *   }
 * }
 * ```
 */
export class ConfigError extends Error {
  /** All structured diagnostics associated with this error. */
  readonly diagnostics: readonly [ConfigDiagnostic, ...ConfigDiagnostic[]];

  constructor(
    diagnostics: readonly [ConfigDiagnostic, ...ConfigDiagnostic[]],
    options?: ErrorOptions,
  ) {
    super(diagnostics[0].message, options);
    this.name = "ConfigError";
    this.diagnostics = diagnostics;
  }

  /** Shorthand for the primary (first) diagnostic's error code. */
  get code(): ConfigErrorCode {
    return this.diagnostics[0].code;
  }

  /** Shorthand for the primary (first) diagnostic's file reference, if any. */
  get file(): string | undefined {
    return this.diagnostics[0].file;
  }
}

// ---------------------------------------------------------------------------
// ValidationError
// ---------------------------------------------------------------------------

/**
 * A {@link ConfigError} specifically produced by schema validation.
 *
 * Thrown (or constructed from result types) when a config object is
 * structurally invalid: required fields are missing, fields have wrong types,
 * values are outside the allowed set, etc.
 *
 * @example
 * ```ts
 * const result = validateWorkspaceConfig(raw);
 * if (!result.ok) {
 *   throw new ValidationError(result.diagnostics);
 * }
 * ```
 */
export class ValidationError extends ConfigError {
  constructor(
    diagnostics: readonly [ConfigDiagnostic, ...ConfigDiagnostic[]],
    options?: ErrorOptions,
  ) {
    super(diagnostics, options);
    this.name = "ValidationError";
  }
}
