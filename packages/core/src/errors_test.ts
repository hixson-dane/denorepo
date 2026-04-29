import { assertEquals, assertInstanceOf } from "jsr:@std/assert@^1";
import {
  ConfigError,
  ConfigErrorCode,
  ValidationError,
} from "./errors.ts";
import type { ConfigDiagnostic } from "./errors.ts";

// ---------------------------------------------------------------------------
// ConfigErrorCode
// ---------------------------------------------------------------------------

Deno.test("ConfigErrorCode — values are stable string constants", () => {
  assertEquals(ConfigErrorCode.READ_ERROR, "CONFIG_READ_ERROR");
  assertEquals(ConfigErrorCode.PARSE_ERROR, "CONFIG_PARSE_ERROR");
  assertEquals(ConfigErrorCode.MISSING_FIELD, "CONFIG_MISSING_FIELD");
  assertEquals(ConfigErrorCode.INVALID_TYPE, "CONFIG_INVALID_TYPE");
  assertEquals(ConfigErrorCode.INVALID_VALUE, "CONFIG_INVALID_VALUE");
  assertEquals(ConfigErrorCode.MUTUALLY_EXCLUSIVE, "CONFIG_MUTUALLY_EXCLUSIVE");
  assertEquals(ConfigErrorCode.UNEXPECTED_FIELD, "CONFIG_UNEXPECTED_FIELD");
  assertEquals(ConfigErrorCode.FORBIDDEN_DEPENDENCY, "CONFIG_FORBIDDEN_DEPENDENCY");
});

// ---------------------------------------------------------------------------
// ConfigDiagnostic
// ---------------------------------------------------------------------------

Deno.test("ConfigDiagnostic — satisfies interface with required fields", () => {
  const diag: ConfigDiagnostic = {
    code: ConfigErrorCode.MISSING_FIELD,
    path: "name",
    message: 'required field "name" is missing',
  };
  assertEquals(diag.code, "CONFIG_MISSING_FIELD");
  assertEquals(diag.path, "name");
  assertEquals(diag.file, undefined);
});

Deno.test("ConfigDiagnostic — optional file field is accepted", () => {
  const diag: ConfigDiagnostic = {
    code: ConfigErrorCode.READ_ERROR,
    path: "",
    message: "Failed to read deno.json: No such file",
    file: "/workspace/deno.json",
  };
  assertEquals(diag.file, "/workspace/deno.json");
});

// ---------------------------------------------------------------------------
// ConfigError
// ---------------------------------------------------------------------------

Deno.test("ConfigError — is an instance of Error", () => {
  const diags = [
    {
      code: ConfigErrorCode.PARSE_ERROR,
      path: "",
      message: "Failed to parse deno.json: Unexpected token",
    },
  ] as const;
  const err = new ConfigError(diags);
  assertInstanceOf(err, Error);
  assertInstanceOf(err, ConfigError);
});

Deno.test("ConfigError — name is 'ConfigError'", () => {
  const diags = [{
    code: ConfigErrorCode.INVALID_TYPE,
    path: "",
    message: "must be a plain object",
  }] as const;
  const err = new ConfigError(diags);
  assertEquals(err.name, "ConfigError");
});

Deno.test("ConfigError — message matches first diagnostic", () => {
  const diags = [{
    code: ConfigErrorCode.MISSING_FIELD,
    path: "name",
    message: 'required field "name" is missing',
  }] as const;
  const err = new ConfigError(diags);
  assertEquals(err.message, 'required field "name" is missing');
});

Deno.test("ConfigError — code returns first diagnostic code", () => {
  const diags = [{
    code: ConfigErrorCode.READ_ERROR,
    path: "",
    message: "Failed to read deno.json: No such file",
    file: "/workspace/deno.json",
  }] as const;
  const err = new ConfigError(diags);
  assertEquals(err.code, "CONFIG_READ_ERROR");
});

Deno.test("ConfigError — file returns first diagnostic file", () => {
  const diags = [{
    code: ConfigErrorCode.READ_ERROR,
    path: "",
    message: "Failed to read deno.json: No such file",
    file: "/workspace/deno.json",
  }] as const;
  const err = new ConfigError(diags);
  assertEquals(err.file, "/workspace/deno.json");
});

Deno.test("ConfigError — file is undefined when diagnostic has no file", () => {
  const diags = [{
    code: ConfigErrorCode.INVALID_TYPE,
    path: "",
    message: "must be a plain object",
  }] as const;
  const err = new ConfigError(diags);
  assertEquals(err.file, undefined);
});

Deno.test("ConfigError — diagnostics preserves all entries", () => {
  const diags = [
    {
      code: ConfigErrorCode.MISSING_FIELD,
      path: "name",
      message: 'required field "name" is missing',
    },
    {
      code: ConfigErrorCode.MISSING_FIELD,
      path: "root",
      message: 'required field "root" is missing',
    },
  ] as const;
  const err = new ConfigError(diags);
  assertEquals(err.diagnostics.length, 2);
  assertEquals(err.diagnostics[1].path, "root");
});

Deno.test("ConfigError — accepts ErrorOptions cause", () => {
  const cause = new Error("original cause");
  const diags = [{
    code: ConfigErrorCode.READ_ERROR,
    path: "",
    message: "Failed to read deno.json: original cause",
  }] as const;
  const err = new ConfigError(diags, { cause });
  assertEquals(err.cause, cause);
});

// ---------------------------------------------------------------------------
// ValidationError
// ---------------------------------------------------------------------------

Deno.test("ValidationError — is an instance of ConfigError and Error", () => {
  const diags = [{
    code: ConfigErrorCode.MISSING_FIELD,
    path: "name",
    message: 'required field "name" is missing',
  }] as const;
  const err = new ValidationError(diags);
  assertInstanceOf(err, Error);
  assertInstanceOf(err, ConfigError);
  assertInstanceOf(err, ValidationError);
});

Deno.test("ValidationError — name is 'ValidationError'", () => {
  const diags = [{
    code: ConfigErrorCode.INVALID_TYPE,
    path: "members",
    message: "must be an array of strings",
  }] as const;
  const err = new ValidationError(diags);
  assertEquals(err.name, "ValidationError");
});

Deno.test("ValidationError — message and code from first diagnostic", () => {
  const diags = [{
    code: ConfigErrorCode.INVALID_VALUE,
    path: "namedInputs.default[0].projects",
    message: 'must be "self" or "dependencies"',
  }] as const;
  const err = new ValidationError(diags);
  assertEquals(err.message, 'must be "self" or "dependencies"');
  assertEquals(err.code, "CONFIG_INVALID_VALUE");
});

Deno.test("ValidationError — can be distinguished from ConfigError by instanceof", () => {
  const diags = [{
    code: ConfigErrorCode.MISSING_FIELD,
    path: "name",
    message: 'required field "name" is missing',
  }] as const;
  const configErr = new ConfigError(diags);
  const validationErr = new ValidationError(diags);

  assertEquals(configErr instanceof ValidationError, false);
  assertEquals(validationErr instanceof ConfigError, true);
});

Deno.test("ValidationError — accepts ErrorOptions cause", () => {
  const cause = new Error("original cause");
  const diags = [{
    code: ConfigErrorCode.INVALID_TYPE,
    path: "members",
    message: "must be an array of strings",
  }] as const;
  const err = new ValidationError(diags, { cause });
  assertEquals(err.cause, cause);
});

Deno.test("ConfigDiagnostic — FORBIDDEN_DEPENDENCY code is accepted", () => {
  const diag: ConfigDiagnostic = {
    code: ConfigErrorCode.FORBIDDEN_DEPENDENCY,
    path: "@denorepo/core.implicitDependencies",
    message: 'Project "@denorepo/core" must not depend on "@denorepo/cli".',
  };
  assertEquals(diag.code, "CONFIG_FORBIDDEN_DEPENDENCY");
  assertEquals(diag.path, "@denorepo/core.implicitDependencies");
  assertEquals(diag.file, undefined);
});

Deno.test("ConfigError — diagnostics with FORBIDDEN_DEPENDENCY code", () => {
  const diags = [{
    code: ConfigErrorCode.FORBIDDEN_DEPENDENCY,
    path: "@denorepo/core.implicitDependencies",
    message: 'Forbidden dependency: "@denorepo/cli".',
  }] as const;
  const err = new ConfigError(diags);
  assertEquals(err.code, "CONFIG_FORBIDDEN_DEPENDENCY");
  assertEquals(err.name, "ConfigError");
  assertEquals(err.file, undefined);
});
