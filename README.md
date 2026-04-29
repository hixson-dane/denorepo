# denorepo
Monorepo manager similar to nx, but built entirely in deno

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the working architecture and execution plan.

## Workspace structure

This repository uses a Deno workspace with explicit members defined in [`deno.json`](deno.json):

- `packages/core` (`@denorepo/core`): workspace engine (config, graph, task runner, hashing/cache interfaces).
- `packages/cli` (`@denorepo/cli`): user-facing command surface.
- `packages/plugin-sdk` (`@denorepo/plugin-sdk`): plugin contracts/types used by plugin implementations and loader paths.
- `apps/remote-cache` (`@denorepo/remote-cache`): deployable remote cache service.

Workspace support directories:

- `packages/plugins/`: parent folder for built-in plugin packages (not a workspace member until a child has its own `deno.json`).
- `packages/templates/`: parent folder for generator templates/assets (not a workspace member until a child has its own `deno.json`).

## Adding new packages or apps

Add a new package/app when the code represents a clear boundary (engine/library, CLI surface, plugin contract/implementation, template assets, or deployable app) and should have an independent manifest.

When adding one:

1. Create the new directory under `packages/` or `apps/`.
2. Add a `deno.json` with at least `name`, `version`, and `exports`.
3. Add the directory path to the root `"workspace"` array in [`deno.json`](deno.json).
4. Keep dependency direction aligned with the architecture rules (for example: `core` never depends on `cli`, plugins depend on `plugin-sdk`).

## Architecture decision records

- Workspace root structure: [`docs/architecture/epics/workspace-root.md`](docs/architecture/epics/workspace-root.md)
  - Implementation checklist: [`docs/architecture/epics/workspace-root.md#8-implementation-checklist`](docs/architecture/epics/workspace-root.md#8-implementation-checklist)
- Config domain model & extension strategy: [`docs/architecture/epics/config-model.md`](docs/architecture/epics/config-model.md)
