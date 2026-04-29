# Epic: Config Domain Model & Extension Strategy

> Architecture Decision Record for the config domain model in `packages/core`
>
> **Status**: Accepted
> **Parent**: [docs/ARCHITECTURE.md](/docs/ARCHITECTURE.md)

---

## 1. Objective

Document the configuration domain model used by the workspace engine, covering
all current types and fields, and establish the extension strategy for adding
new fields as the system grows (plugins, caching, generators, etc.).

No implementation changes are made in this document. This is the single source
of truth for contributors adding, modifying, or validating configuration fields.

---

## 2. Type Hierarchy

All configuration types live in `packages/core/src/config.ts`. They describe
the **logical shape** of configuration data — no parsing, validation, or I/O
logic belongs there.

```text
WorkspaceConfig
├── members: string[]
├── namedInputs: Record<string, NamedInput>
│   └── NamedInput = Array<string | InputDefinition>
│       └── InputDefinition = { input } | { fileset } | { runtime } | { env }
├── targetDefaults: Record<string, TargetDefaults>
│   └── TargetDefaults ⊂ TargetConfig (inputs, outputs, dependsOn, cache, options)
└── constraints: DepConstraint[]
    └── DepConstraint = { sourceTag, notDependOnLibsWithTags?, onlyDependOnLibsWithTags? }

ProjectConfig
├── name: string
├── root: string
├── version?: string
├── tags?: string[]
├── targets?: Record<string, TargetConfig>
│   └── TargetConfig = { command?, executor?, inputs?, outputs?, dependsOn?, cache?, options? }
├── implicitDependencies?: string[]
└── namedInputs?: Record<string, NamedInput>   ← project-level overrides
```

---

## 3. `WorkspaceConfig` — Top-Level Workspace Configuration

Defined by the root `deno.json` and loaded by `loadWorkspaceConfig` in
`packages/core/src/load.ts`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `members` | `readonly string[]` | **Yes** | Relative paths to workspace member directories. Each must contain a `deno.json` manifest. |
| `namedInputs` | `Record<string, NamedInput>` | No | Shared, reusable input sets referenced by name in target `inputs` arrays across all projects. |
| `targetDefaults` | `Record<string, TargetDefaults>` | No | Workspace-wide default settings for named targets (e.g. `"test"`, `"build"`). Per-project values override these. |
| `constraints` | `readonly DepConstraint[]` | No | Tag-based architecture dependency rules enforced across all projects. Violations are reported by `validateArchitectureDependencies`. |

### Example

```jsonc
{
  "workspace": [
    "packages/core",
    "packages/cli",
    "apps/remote-cache"
  ],
  "namedInputs": {
    "default": [
      { "fileset": "{projectRoot}/**/*.ts" },
      { "fileset": "{projectRoot}/deno.json" }
    ],
    "noCache": [
      { "runtime": "date +%s" }
    ]
  },
  "targetDefaults": {
    "test": {
      "inputs": ["default"],
      "cache": true
    },
    "build": {
      "inputs": ["default"],
      "outputs": ["dist/**"],
      "cache": true
    }
  },
  "constraints": [
    {
      "sourceTag": "scope:core",
      "notDependOnLibsWithTags": ["scope:cli"]
    }
  ]
}
```

---

## 4. `ProjectConfig` — Per-Project Configuration

Defined by a member's `deno.json` and loaded by `loadProjectConfigs` in
`packages/core/src/load_project.ts`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | **Yes** | Scoped package identifier (`@scope/name`). Canonical identifier throughout the workspace graph. |
| `root` | `string` | **Yes** (injected) | Relative path to the project root from the workspace root. Injected during loading; not read from `deno.json`. |
| `version` | `string` | No | Semver version string. All members share `"0.0.0"` during the MVP phase. |
| `tags` | `readonly string[]` | No | Classification tags for grouping, filtering, and dependency boundary rules (e.g. `"scope:core"`, `"type:library"`). |
| `targets` | `Record<string, TargetConfig>` | No | Named tasks provided by this project, keyed by target name. |
| `implicitDependencies` | `readonly string[]` | No | Workspace-level project name strings for dependencies not expressed via source imports. |
| `namedInputs` | `Record<string, NamedInput>` | No | Project-level named input overrides. Merged with (and takes precedence over) workspace-level `namedInputs`. |

### Example

```jsonc
{
  "name": "@denorepo/core",
  "version": "0.0.0",
  "exports": { ".": "./mod.ts" },
  "tags": ["scope:core", "type:library"],
  "targets": {
    "test": {
      "command": "deno test src/",
      "inputs": ["default"],
      "cache": true
    }
  },
  "implicitDependencies": []
}
```

---

## 5. `TargetConfig` — Single Named Target

A task definition within a project. Either `command` or `executor` must be
provided (they are mutually exclusive in practice).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `command` | `string` | One of `command`/`executor` | Shell command to run when this target is invoked. |
| `executor` | `string` | One of `command`/`executor` | Executor plugin identifier, e.g. `"@denorepo/plugin-deno:build"`. Used in place of `command` for plugin-driven targets. |
| `inputs` | `Array<string \| InputDefinition>` | No | Input definitions used to compute the cache key. Each entry is either a named input reference string or a structured `InputDefinition`. |
| `outputs` | `readonly string[]` | No | Output paths (relative to project root) cached and restored on a cache hit. |
| `dependsOn` | `Array<TargetDependency>` | No | Targets that must complete before this target executes. |
| `cache` | `boolean` | No | Whether outputs are eligible for caching. Defaults to `true` when `inputs`/`outputs` are defined. |
| `options` | `Record<string, unknown>` | No | Executor-specific or command-specific options passed through without interpretation by the core engine. |

---

## 6. `TargetDefaults` — Workspace-Level Target Defaults

A subset of `TargetConfig` fields applicable at the workspace level. The omitted
fields (`command`, `executor`) are intentionally excluded — defaults cannot
define how a target runs, only its cache/dependency behavior.

Included fields: `inputs`, `outputs`, `dependsOn`, `cache`, `options`.

Applied to every project target whose name matches the key in
`WorkspaceConfig.targetDefaults`. Per-project values take precedence.

---

## 7. `DepConstraint` — Tag-Based Dependency Rule

Used in `WorkspaceConfig.constraints` to enforce architecture boundaries.
Evaluated by `validateArchitectureDependencies` in `packages/core/src/validate.ts`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sourceTag` | `string` | **Yes** | The tag that activates this constraint. The constraint applies only to projects whose `tags` include this value. |
| `notDependOnLibsWithTags` | `readonly string[]` | No | Tags that dependency projects are **forbidden** from having. A `FORBIDDEN_DEPENDENCY` diagnostic is emitted if violated. |
| `onlyDependOnLibsWithTags` | `readonly string[]` | No | Tags of which dependency projects must have **at least one**. A `FORBIDDEN_DEPENDENCY` diagnostic is emitted if violated. |

At least one of the two optional arrays must be provided for the constraint to
have any effect.

### Example

```ts
// core must not depend on cli
{ sourceTag: "scope:core", notDependOnLibsWithTags: ["scope:cli"] }

// plugins may only depend on plugin-sdk
{ sourceTag: "type:plugin", onlyDependOnLibsWithTags: ["scope:plugin-sdk"] }
```

---

## 8. Supporting Types

### `InputDefinition`

A union type used to build cache keys for targets.

| Variant | Description | Example |
|---------|-------------|---------|
| `{ input: string; projects?: "self" \| "dependencies" }` | References a named input set, optionally scoped to the current project or its transitive dependencies. | `{ input: "default", projects: "self" }` |
| `{ fileset: string }` | Glob pattern selecting source files relative to the project root. | `{ fileset: "**/*.ts" }` |
| `{ runtime: string }` | Shell command whose stdout is included in the cache hash. | `{ runtime: "deno --version" }` |
| `{ env: string }` | Environment variable name whose value is included in the cache hash. | `{ env: "CI" }` |

### `NamedInput`

```ts
type NamedInput = ReadonlyArray<string | InputDefinition>;
```

An ordered list of glob strings or `InputDefinition` values. Defined once at
workspace or project level and referenced by name in target `inputs` arrays.

### `TargetDependency`

```ts
type TargetDependency =
  | string
  | { target: string; projects?: "self" | "dependencies" | string };
```

- **Plain string** — the name of another target in the **same** project that must
  complete first (e.g. `"build"`).
- **Object form** — enables cross-project or scoped dependencies:
  - `projects: "self"` — same project.
  - `projects: "dependencies"` — all transitive dependency projects.
  - `projects: "<name>"` — a specific project by name.

---

## 9. Field Validation

All config types are validated at runtime by `packages/core/src/validate.ts`.
Validation produces structured `ConfigDiagnostic` values rather than throwing,
and returns a `ValidationResult` (`{ ok: true, config }` or
`{ ok: false, diagnostics }`).

### Error codes (`ConfigErrorCode`)

Defined in `packages/core/src/errors.ts`:

| Code | Meaning |
|------|---------|
| `CONFIG_MISSING_FIELD` | A required field is absent. |
| `CONFIG_INVALID_TYPE` | A field has the wrong runtime type. |
| `CONFIG_PARSE_ERROR` | The JSON/JSONC source could not be parsed. |
| `CONFIG_NOT_FOUND` | The config file does not exist. |
| `CONFIG_FORBIDDEN_DEPENDENCY` | A project listed in `implicitDependencies` violates a `DepConstraint` rule. This is the only violation type checked by `validateArchitectureDependencies`; source-level import boundaries are not inspected by the core engine. |
| `CONFIG_UNKNOWN` | An unexpected error with no specific code. |

### How validation works

1. `loadWorkspaceConfig` reads and parses the root `deno.json`, then calls
   `validateWorkspaceConfig` on the raw value.
2. `loadProjectConfigs` reads each member's `deno.json`, then calls
   `validateProjectConfig` on each.
3. `validateArchitectureDependencies` is called separately (after loading) to
   enforce `DepConstraint` rules across the full project set.

---

## 10. Extension Strategy

This section describes how to safely add, evolve, or remove configuration fields
as the system grows.

### Principles

1. **All fields are `readonly`** — config objects are treated as value types.
   Never mutate a config object; create a new one instead.
2. **New optional fields default to `undefined`** — adding an optional field is
   a backward-compatible change. Required fields are a breaking change for any
   config that previously omitted them.
3. **One type file, one validator** — new fields in `config.ts` must be paired
   with corresponding validation logic in `validate.ts` before they are used.
4. **Executor `options` is the plugin escape hatch** — plugin-specific settings
   belong in `TargetConfig.options`, not as top-level fields in `TargetConfig`.
   This keeps the core model stable while allowing arbitrary executor configuration.

### Adding a new field (step-by-step)

1. **Add the field to the type** in `packages/core/src/config.ts`.
   - Mark it `readonly`.
   - Document it with a JSDoc comment (description, `@example` if useful).
   - Make it optional (`?`) unless it is truly required for all existing configs.

2. **Add validation** in `packages/core/src/validate.ts`.
   - Add a type-check branch in the relevant `validate*` function.
   - Use the existing `ConfigErrorCode` values. Add a new code to
     `packages/core/src/errors.ts` only if none of the existing codes fit.

3. **Add a unit test** in the corresponding `*_test.ts` file.
   - Test the valid case (field present and correct type).
   - Test the invalid type case (field present, wrong type → `CONFIG_INVALID_TYPE`).
   - If the field is required, test the missing case (→ `CONFIG_MISSING_FIELD`).

4. **Export from the public API** in `packages/core/mod.ts` if the new type or
   field is part of the public surface (i.e., consumers of `@denorepo/core` need
   it).

5. **Update this document** — add the field to the relevant table in §3–§8.

### Removing or renaming a field

- Mark the field `@deprecated` in JSDoc before removing it.
- Keep the old field for at least one version cycle; emit a diagnostic warning
  if the deprecated field is present.
- Remove the field and its validation logic together in the same PR.

### Plugin-specific configuration

Plugins should not introduce new top-level fields in `WorkspaceConfig` or
`ProjectConfig`. Instead:

- Use `TargetConfig.executor` to identify the plugin and
  `TargetConfig.options` to pass plugin-specific settings.
- If workspace-level plugin configuration is needed (e.g. shared defaults for a
  plugin), introduce a new **optional** top-level field in `WorkspaceConfig`
  scoped to the plugin (e.g. `pluginOptions?: Record<string, unknown>`).
- Any such addition must follow the steps in §10 above and must not break
  workspaces that do not use the plugin.

### Future extension points

The following areas are anticipated as the system grows. They are listed here
for awareness; none are implemented yet.

| Area | Anticipated field | Location | Notes |
|------|------------------|----------|-------|
| Remote cache | `cacheConfig?: RemoteCacheConfig` | `WorkspaceConfig` | Backend URL, auth, storage strategy. Defined in a future epic. |
| Generator pipeline | `generators?: GeneratorConfig[]` | `WorkspaceConfig` or `ProjectConfig` | Scaffolding entry points for the plugin-sdk generator flow. |
| Plugin registry | `plugins?: PluginEntry[]` | `WorkspaceConfig` | List of plugin packages to load at runtime; resolved via `plugin-sdk`. |
| Per-target environment | `env?: Record<string, string>` | `TargetConfig` | Static environment variables injected when running a target. |
| Affected computation | `affectedConfig?: AffectedConfig` | `WorkspaceConfig` | Custom base branch, SCM provider, or affected calculation strategy. |
| Output verbosity | `outputStyle?: "stream" \| "grouped" \| "compact"` | `WorkspaceConfig` | Controls how task output is printed by the CLI runner. |

---

## 11. References

- Config types: [`packages/core/src/config.ts`](../../../packages/core/src/config.ts)
- Validation logic: [`packages/core/src/validate.ts`](../../../packages/core/src/validate.ts)
- Error codes: [`packages/core/src/errors.ts`](../../../packages/core/src/errors.ts)
- Workspace loader: [`packages/core/src/load.ts`](../../../packages/core/src/load.ts)
- Project loader: [`packages/core/src/load_project.ts`](../../../packages/core/src/load_project.ts)
- Public API: [`packages/core/mod.ts`](../../../packages/core/mod.ts)
- Workspace structure ADR: [`docs/architecture/epics/workspace-root.md`](./workspace-root.md)
- High-level architecture: [`docs/ARCHITECTURE.md`](../../ARCHITECTURE.md)
