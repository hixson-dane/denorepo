# Epic: Workspace Root Structure & Package Manifests

> Architecture Decision Record for [Epic #2](https://github.com/hixson-dane/denorepo/issues/2)
>
> **Status**: Proposed
> **Parent**: [docs/ARCHITECTURE.md](/docs/ARCHITECTURE.md)

---

## 1. Objective

Establish the root Deno workspace skeleton, directory conventions, and initial
package manifests so that every subsequent epic has a stable foundation to build
on. No build logic, runtime code, or CI pipelines are introduced here — only
structure and metadata.

## 2. Directory Tree

```text
/
├── deno.json                          # Root workspace manifest
├── README.md
├── docs/
│   ├── ARCHITECTURE.md                # High-level plan (source of truth)
│   └── architecture/
│       └── epics/
│           └── workspace-root.md      # This document
├── packages/
│   ├── core/
│   │   └── deno.json                  # @denorepo/core manifest
│   ├── cli/
│   │   └── deno.json                  # @denorepo/cli manifest
│   ├── plugin-sdk/
│   │   └── deno.json                  # @denorepo/plugin-sdk manifest
│   ├── plugins/                       # Parent directory for built-in plugins
│   │   └── .gitkeep
│   └── templates/                     # Parent directory for generator templates
│       └── .gitkeep
└── apps/
    └── remote-cache/
        └── deno.json                  # @denorepo/remote-cache manifest
```

### Notes

- `packages/plugins/` and `packages/templates/` start empty (`.gitkeep`) because
  no built-in plugin or template is created in this epic. Future epics will add
  sub-directories (e.g. `packages/plugins/deno/deno.json`).
- Every publishable package lives under `packages/` or `apps/` and has its own
  `deno.json`.
- The `/docs` tree is not a workspace member.

## 3. Root Workspace Manifest (`deno.json`)

```jsonc
{
  // Deno workspace definition — lists every member package.
  // When adding a new package, append its path here AND create a
  // per-package deno.json with at minimum a "name" and "version" field.
  "workspace": [
    "packages/core",
    "packages/cli",
    "packages/plugin-sdk",
    "apps/remote-cache"
  ]
}
```

### Rules for workspace membership

| Rule | Detail |
|------|--------|
| **Explicit membership** | Every member must be listed in the root `"workspace"` array. Deno does not auto-discover members. |
| **One manifest per member** | Each member directory must contain its own `deno.json` with at least `"name"` and `"version"`. |
| **Adding a new package** | 1) Create `<dir>/deno.json` with required fields. 2) Append the directory to the root `"workspace"` array. 3) Open a PR and label it with the relevant epic. |
| **Plugin / template directories** | Only added to `"workspace"` when they contain a `deno.json` manifest. Empty parent dirs (`plugins/`, `templates/`) are never workspace members. |
| **No glob patterns** | List members explicitly for clarity and to avoid accidental inclusion of scratch/test directories. |

## 4. Per-Package Manifest Conventions

Each package `deno.json` follows a minimal, consistent schema during this epic.
Build tasks, compiler options, and dependency declarations come in later epics.

### Required fields (this epic)

| Field | Purpose | Example |
|-------|---------|---------|
| `name` | Scoped package identifier, used by workspace imports and future JSR/npm publishing | `"@denorepo/core"` |
| `version` | Unified version string (all packages share the same version during MVP) | `"0.0.0"` |
| `exports` | Entry point(s) for consumers; start with `"."` pointing to a `mod.ts` stub | `{ ".": "./mod.ts" }` |

### Optional fields (defer until needed)

| Field | When to add |
|-------|-------------|
| `tasks` | When a package needs build, test, or lint scripts |
| `imports` | When the package takes external (non-workspace) dependencies |
| `compilerOptions` | When stricter/custom TS settings diverge from root |
| `publish` | When preparing for JSR/GitHub Packages publication |
| `lock` | Managed at the root level; individual packages should not set this |

### Naming convention

All packages use the `@denorepo/` scope:

| Directory | Manifest `name` |
|-----------|-----------------|
| `packages/core` | `@denorepo/core` |
| `packages/cli` | `@denorepo/cli` |
| `packages/plugin-sdk` | `@denorepo/plugin-sdk` |
| `apps/remote-cache` | `@denorepo/remote-cache` |
| `packages/plugins/<name>` | `@denorepo/plugin-<name>` |
| `packages/templates/<name>` | `@denorepo/template-<name>` |

### Initial `version`

All packages start at `"0.0.0"`. The unified versioning strategy (from
ARCHITECTURE.md) means all packages share a single version line until
independent release cadence becomes necessary.

## 5. Package Boundaries & Rationale

### `packages/core` — Workspace engine

| Aspect | Detail |
|--------|--------|
| **Responsibility** | Workspace config parsing, project graph builder, task runner, hashing, cache interfaces |
| **Depends on** | Nothing within the workspace (leaf node) |
| **Depended on by** | `cli`, `plugin-sdk` (approved interfaces only), `remote-cache` (contracts) |
| **Rationale** | Keeping the engine library dependency-free from CLI and plugin code allows it to be tested, published, and consumed independently. It is the most critical package. |

### `packages/cli` — User-facing commands

| Aspect | Detail |
|--------|--------|
| **Responsibility** | CLI argument parsing, command routing, output formatting, plugin loading glue |
| **Depends on** | `core`, `plugin-sdk` |
| **Depended on by** | Nothing (top of the dependency tree) |
| **Rationale** | Isolating CLI concerns (argument parsing, TTY output, interactive prompts) from core logic ensures the engine remains embeddable and testable without CLI coupling. |

### `packages/plugin-sdk` — Plugin contracts & types

| Aspect | Detail |
|--------|--------|
| **Responsibility** | TypeScript interfaces and types for generators, executors, and plugin lifecycle hooks |
| **Depends on** | Approved core interfaces only (e.g., project model types) |
| **Depended on by** | All `plugins/*` packages, and the CLI plugin loader |
| **Rationale** | A thin, stable contract layer allows plugins to be developed and tested without importing the full engine. Stability of this package is paramount — breaking changes here cascade to every plugin. |

### `packages/plugins/*` — Built-in plugins

| Aspect | Detail |
|--------|--------|
| **Responsibility** | Concrete implementations of generators and executors for supported project types (e.g., Deno library, Deno app) |
| **Depends on** | `plugin-sdk` |
| **Depended on by** | Nothing directly; loaded at runtime by CLI |
| **Rationale** | Keeping each plugin in its own sub-directory enables independent testing, lazy loading, and eventual community contribution. Plugins must never reach into `core` internals. |

### `packages/templates/*` — Generator templates & assets

| Aspect | Detail |
|--------|--------|
| **Responsibility** | Static or parameterized template files consumed by generator plugins |
| **Depends on** | Nothing (pure data/assets) |
| **Depended on by** | Generator plugins read templates at generation time |
| **Rationale** | Templates are inert assets. Separating them from plugin logic means templates can be updated, added, or community-contributed without touching any runtime code. |

### `apps/remote-cache` — Deployable cache service

| Aspect | Detail |
|--------|--------|
| **Responsibility** | HTTP API for cache exists/upload/download; authentication; storage backend |
| **Depends on** | Shared cache contract types from `core` (or a shared types package if extracted later) |
| **Depended on by** | Nothing within the workspace (deployed independently) |
| **Rationale** | Lives in-repo during MVP for fast iteration. First candidate for extraction to its own repository when deployment/versioning pressure appears (see decision rules in ARCHITECTURE.md). |

## 6. Dependency Direction Summary

```text
cli ──► core
cli ──► plugin-sdk
plugins/* ──► plugin-sdk
remote-cache ──► core (contracts only)
templates/* ──► (none)
core ──► (none)
plugin-sdk ──► core (approved interfaces only)
```

**Hard rules (enforce from day one):**

1. `core` must **never** import from `cli`.
2. `plugins/*` must **never** import from `core` directly — only via `plugin-sdk`.
3. `remote-cache` must **never** import CLI internals.
4. No circular dependencies between any workspace members.

## 7. Guidelines for Initial Manifests

These guidelines apply to the manifests created in this epic. Later epics will
layer on tasks, imports, and compiler options.

1. **No `tasks` field** — build/test/lint scripts are added when there is code
   to build, test, or lint.
2. **No `imports` field** — external dependencies come when code requires them.
3. **No `compilerOptions`** — use Deno defaults; override only when a concrete
   need arises in a future epic.
4. **`exports` points to a `mod.ts` stub** — each package gets a `mod.ts` with
   a placeholder comment. This ensures the manifest is structurally valid and
   workspace resolution works.
5. **`version` is `"0.0.0"`** everywhere — signals pre-release/unreleased state.
6. **Root `deno.json` contains only `"workspace"`** — no tasks, no imports, no
   compiler options at the root level during this epic.

## 8. Implementation Checklist

The following checklist is for implementers working on this epic. Each item
should be a single, reviewable PR or commit.

### Directories & Files

- [ ] Create `packages/core/` directory
- [ ] Create `packages/cli/` directory
- [ ] Create `packages/plugin-sdk/` directory
- [ ] Create `packages/plugins/` directory with `.gitkeep`
- [ ] Create `packages/templates/` directory with `.gitkeep`
- [ ] Create `apps/remote-cache/` directory

### Root Manifest

- [ ] Create root `deno.json` with `"workspace"` array listing:
  `packages/core`, `packages/cli`, `packages/plugin-sdk`, `apps/remote-cache`
- [ ] Verify `deno info` runs successfully from the repository root

### Per-Package Manifests

- [ ] `packages/core/deno.json` — `name: "@denorepo/core"`, `version: "0.0.0"`,
  `exports: { ".": "./mod.ts" }`
- [ ] `packages/cli/deno.json` — `name: "@denorepo/cli"`, `version: "0.0.0"`,
  `exports: { ".": "./mod.ts" }`
- [ ] `packages/plugin-sdk/deno.json` — `name: "@denorepo/plugin-sdk"`,
  `version: "0.0.0"`, `exports: { ".": "./mod.ts" }`
- [ ] `apps/remote-cache/deno.json` — `name: "@denorepo/remote-cache"`,
  `version: "0.0.0"`, `exports: { ".": "./mod.ts" }`

### Entry Point Stubs

- [ ] `packages/core/mod.ts` — placeholder export
- [ ] `packages/cli/mod.ts` — placeholder export
- [ ] `packages/plugin-sdk/mod.ts` — placeholder export
- [ ] `apps/remote-cache/mod.ts` — placeholder export

### Validation

- [ ] `deno check` passes from root with no errors
- [ ] `deno info` resolves workspace members correctly
- [ ] No circular dependency warnings
- [ ] Each package `mod.ts` is importable from another workspace member
  (manual verification)

### Documentation

- [ ] This architecture document is committed under
  `docs/architecture/epics/workspace-root.md`
- [ ] `docs/ARCHITECTURE.md` is still consistent and linked from `README.md`

## 9. Open Questions & Future Considerations

| Topic | Notes |
|-------|-------|
| **Lock file strategy** | Root-level `deno.lock` is standard for workspaces. Confirm no per-package lock files are needed. |
| **Import map at root** | May be useful later for aliasing workspace packages (e.g., `@denorepo/core`). Defer until the first cross-package import is needed. |
| **Shared types package** | If `core` exports grow large, a `packages/types` package could be split out. Defer until the API surface justifies it. |
| **CI workspace validation** | A CI step to validate workspace membership matches directory contents would prevent drift. Add in the CI epic. |

---

*This document should be reviewed and approved before implementing the directory
structure and manifests described above. Once approved, use the checklist in
§8 to drive implementation.*
