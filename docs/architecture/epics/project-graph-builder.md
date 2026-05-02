# Epic: Graph Builder + Graph Command

> Architecture Decision Record for the project graph builder and `graph` command
>
> **Status**: Proposed
> **Parent**: [docs/ARCHITECTURE.md](/docs/ARCHITECTURE.md)
> **Related**: [workspace-root.md](./workspace-root.md), [config-model.md](./config-model.md)

---

## 1. Objective

Define the MVP architecture for building a project graph in `packages/core` and
exposing that graph through a `graph` command in `packages/cli`.

This document is planning-focused: it captures decisions, boundaries, and a
task-ready implementation checklist before the epic is split into smaller issues.

## 2. Existing Technical Context

### What already exists

- Root workspace membership is loaded from `deno.json.workspace` via
  `loadWorkspaceConfig`.
- Project configs are loaded per workspace member via `loadProjectConfigs`.
- `ProjectConfig` already includes `name`, `root`, `tags`, `targets`, and
  `implicitDependencies`.
- `validateArchitectureDependencies` already evaluates dependency boundaries
  using `ProjectConfig.implicitDependencies` and `WorkspaceConfig.constraints`.
- `packages/core` exports config loaders, validators, and diagnostics, but no
  graph domain/builder APIs yet.

### Current constraints that shape this epic

- `packages/core` must remain independent from `packages/cli`.
- The MVP has no source-import analysis yet, so graph edges must come from
  explicit metadata (`implicitDependencies`) first.
- Existing APIs return diagnostics/result unions rather than throwing for
  expected validation/load failures.

## 3. MVP Scope

### In scope

1. Build a project graph from loaded `ProjectConfig[]`.
2. Represent nodes by project identity and metadata needed for graph output.
3. Derive dependency edges from `implicitDependencies`.
4. Report graph-level diagnostics for invalid graph data (for example, duplicate
   names or unresolved dependency names).
5. Expose a CLI `graph` command that prints deterministic output in at least:
   - JSON format (machine-readable)
   - Text format (human-readable)

### Out of scope

- Source code import graph resolution.
- Task-execution graph planning from target `dependsOn`.
- Visualization/UI tooling.
- Scheduler/cache execution changes.

## 4. Decisions for This Epic

### 4.1 Canonical node identity

Use `ProjectConfig.name` as the canonical graph node ID.

Rationale: it is already treated as the stable workspace-level project
identifier across config loading and validation.

### 4.2 Edge source of truth for MVP

Use `ProjectConfig.implicitDependencies` as the only dependency-edge input in
this epic.

Rationale: this dependency data already exists in the schema and is already used
for architecture validation rules.

### 4.3 Graph builder boundary

Graph domain types and builder logic live in `packages/core`.

`packages/cli` only orchestrates load/build/render and must not become the owner
of dependency resolution rules.

### 4.4 Failure/diagnostic model

Graph construction should produce structured diagnostics rather than relying on
uncaught exceptions for invalid graph metadata.

This keeps behavior aligned with the current config loading/validation model.

### 4.5 Determinism

Graph output should be deterministic (stable node/edge ordering) for identical
inputs to support reliable CI snapshots, reproducible outputs, and easier review
diffs.

## 5. Planned API Shape (MVP)

Exact naming can be refined during implementation, but the API should include:

- Graph node type
- Graph edge type
- Graph diagnostic type
- Graph result type (graph + diagnostics)
- `buildProjectGraph(projects: readonly ProjectConfig[])`

The API should be exported from `packages/core/mod.ts`.

## 6. CLI `graph` Command Design (MVP)

Minimum command behavior:

1. Load workspace config.
2. Load member project configs.
3. Build project graph from successful project configs.
4. Render graph output in requested format.
5. Surface diagnostics in a predictable CLI output shape.

Potential baseline flags:

- `--format json|text`
- `--fail-on-diagnostics` (optional, if implemented in same epic)

Exit behavior must be explicit in implementation issues (success vs diagnostics
vs hard load failures).

## 7. Implementation Checklist

The following checklist is intended for issue splitting:

### Core graph model + builder

- [ ] Add graph domain types in `packages/core/src`.
- [ ] Implement project graph builder from `ProjectConfig[]`.
- [ ] Add graph diagnostics for duplicate names.
- [ ] Add graph diagnostics for unresolved dependency names.
- [ ] Export graph APIs from `packages/core/mod.ts`.

### Core tests

- [ ] Add unit tests for node/edge construction.
- [ ] Add unit tests for duplicate-name diagnostics.
- [ ] Add unit tests for unresolved dependency diagnostics.
- [ ] Add tests that assert deterministic ordering.

### CLI command

- [ ] Add CLI entrypoint/command routing needed for `graph`.
- [ ] Implement `graph` command integration with core loaders and builder.
- [ ] Add JSON formatter output.
- [ ] Add text formatter output.
- [ ] Define and test exit code behavior.

### CLI tests

- [ ] Add tests for `graph --format json`.
- [ ] Add tests for `graph --format text`.
- [ ] Add tests for failure modes and diagnostics handling.

## 8. References

- High-level architecture plan: [`docs/ARCHITECTURE.md`](../../ARCHITECTURE.md)
- Workspace foundation ADR: [`workspace-root.md`](./workspace-root.md)
- Config model ADR: [`config-model.md`](./config-model.md)
- Core config types: [`packages/core/src/config.ts`](../../../packages/core/src/config.ts)
- Workspace loader: [`packages/core/src/load.ts`](../../../packages/core/src/load.ts)
- Project loader: [`packages/core/src/load_project.ts`](../../../packages/core/src/load_project.ts)
- Validation logic: [`packages/core/src/validate.ts`](../../../packages/core/src/validate.ts)
- Current core public API: [`packages/core/mod.ts`](../../../packages/core/mod.ts)
