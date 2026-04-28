/**
 * @denorepo/core — workspace engine
 *
 * Public API surface for the core package.
 */

export type {
  InputDefinition,
  NamedInput,
  ProjectConfig,
  TargetConfig,
  TargetDefaults,
  TargetDependency,
  WorkspaceConfig,
} from "./src/config.ts";

export type { ConfigDiagnostic, ValidationResult } from "./src/validate.ts";
export {
  validateProjectConfig,
  validateWorkspaceConfig,
} from "./src/validate.ts";

export {
  ConfigError,
  ConfigErrorCode,
  ValidationError,
} from "./src/errors.ts";

export type {
  LoadWorkspaceConfigOptions,
  LoadWorkspaceConfigResult,
} from "./src/load.ts";
export { loadWorkspaceConfig } from "./src/load.ts";

export type {
  LoadMemberConfigResult,
  LoadProjectConfigsOptions,
} from "./src/load_project.ts";
export { loadProjectConfigs } from "./src/load_project.ts";
