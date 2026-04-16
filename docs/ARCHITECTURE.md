# denorepo Architecture + Execution Instructions

This document is the working plan for building a Deno-first, Nx-like monorepo toolchain as a solo developer using Copilot agents.

## Recommended repository strategy

Start as a **single monorepo** using a Deno workspace, with strict package boundaries and explicit dependency direction.

Why now:
- Faster refactors across CLI/core/plugins/templates in one PR.
- Simpler agent tasking (one repo, one project board, one CI surface).
- Lower release/coordination overhead during MVP.

## Proposed monorepo layout

```text
/apps
  /remote-cache        # Deployable remote cache service (can split later)
/docs                  # Planning/architecture/how-to docs (optional but recommended)
/packages
  /core                # Workspace config, graph builder, task runner, hashing, cache interfaces
  /cli                 # User-facing CLI commands
  /plugin-sdk          # Plugin contracts/types/runtime interfaces
  /plugins/*           # Built-in plugins
  /templates/*         # Generator templates/assets
```

Notes:
- `apps/remote-cache/` should remain in this repo during early iterations for speed.
- It is the first candidate to become its own repository once deployment/versioning pressure appears.

## Dependency direction rules (enforce from day one)

- `packages/core` **must not** depend on `packages/cli`.
- `packages/cli` depends on `packages/core` (and plugin loading/runtime glue).
- `packages/plugin-sdk` should be lightweight and stable.
- `packages/plugins/*` depend on `packages/plugin-sdk` (and only approved core interfaces).
- `packages/templates/*` are consumed by generators/plugins; avoid reverse dependencies.
- `apps/remote-cache` should not depend on CLI internals; share contracts via core/sdk interfaces where needed.

## Caching implementation sequence

1. **Local cache MVP**
   - Deterministic task hash.
   - Store artifact/metadata locally.
   - Hydrate outputs on cache hit.
2. **Remote cache client interface**
   - Define cache backend abstraction in core.
   - Add remote client behind feature/config toggle.
3. **Remote cache server (HTTP API)**
   - `apps/remote-cache` service for upload/download/exists flow.
   - Start simple; harden auth/storage later.

## Publishing strategy

- Start publishing via **GitHub Packages** for operational simplicity.
- Design package boundaries and metadata so publishing to **JSR + npm** can be added without architectural rewrite.
- Use **unified versioning** initially (single version line across publishable packages).
- Split versioning only if independent release cadence becomes necessary.

## GitHub Project (v2) setup for solo + Copilot-agent workflow

Use one Project (v2) as the control plane for all issues.

### Suggested Status values
- Backlog
- Ready
- In Progress (Agent)
- In Review
- Done

### Suggested custom fields
- `Area` (single select): core, cli, plugin-sdk, plugins, templates, cache, remote-cache, docs, ci
- `Priority` (single select): P0, P1, P2
- `Effort` (single select): S, M, L
- `Epic` (text or single select)
- `Dependencies` (text or linked issues)

### Agent-ready issue template

Each issue should include:
- **Goal**
- **Non-goals**
- **Acceptance criteria** (testable)
- **Boundaries** (allowed files/packages to touch)

## Suggested MVP epics and sequencing

1. Workspace + project model foundation (`core`)
2. Graph builder + graph command (`core` + `cli`)
3. Task runner basics (`core` + `cli`)
4. Local cache (`core`)
5. Generator pipeline + templates (`plugin-sdk` + `plugins` + `templates`)
6. Plugin runtime + one built-in plugin (`plugin-sdk` + `plugins`)
7. Remote cache interface (`core`)
8. Remote cache service (`apps/remote-cache`)

## Decision rules for splitting into multiple repositories

Keep components in one monorepo until at least one is true:
- Independent deployment lifecycle is required (strong signal: remote cache service).
- Independent versioning/release cadence is required.
- External contributor base needs isolated ownership/review paths.
- CI/release coupling across packages becomes a measurable bottleneck.

If none of the above is true, keep it in the monorepo.

## Next steps (create these first issues)

1. **Define root Deno workspace structure and package manifests**
   - Goal: establish `/packages` and `/apps` skeleton with agreed boundaries.
2. **Implement workspace/project config model in `packages/core`**
   - Goal: parse and validate workspace + project definitions.
3. **Implement initial project graph builder in `packages/core`**
   - Goal: discover projects and dependency edges.
4. **Add `graph` command in `packages/cli`**
   - Goal: print/export project graph from core.
5. **Implement basic task runner pipeline in `packages/core`**
   - Goal: run project tasks with deterministic execution inputs.
6. **Implement local cache MVP (hash/store/hydrate) in `packages/core`**
   - Goal: cache task outputs and restore on hits.
7. **Create `packages/plugin-sdk` v0 contracts and loader integration points**
   - Goal: define generator/executor/plugin interfaces.
8. **Create first built-in plugin + template path (`packages/plugins/deno`, `packages/templates/basic`)**
   - Goal: scaffold a basic app/lib via plugin-driven generator flow.
9. **Define remote cache client interface in `packages/core`**
   - Goal: backend-agnostic contract ready for HTTP implementation.
10. **Bootstrap `apps/remote-cache` HTTP service skeleton**
    - Goal: implement minimal exists/upload/download API shape.
