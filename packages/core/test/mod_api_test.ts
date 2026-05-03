/**
 * Public API surface tests for `packages/core/mod.ts`.
 *
 * These tests import exclusively through the public entry-point (`mod.ts`) to
 * verify that every symbol advertised in the module JSDoc is actually exported
 * and usable.  They do not test the behaviour of each export in depth — the
 * unit and integration tests in `src/` and `test/` do that — they only assert
 * that the import graph is correct and that the re-exported values have the
 * expected runtime shape.
 *
 * @module
 */

import { assert, assertEquals, assertInstanceOf } from "jsr:@std/assert@^1";
import {
  buildProjectGraph,
  ConfigError,
  ConfigErrorCode,
  loadProjectConfigs,
  loadWorkspaceConfig,
  validateArchitectureDependencies,
  validateProjectConfig,
  validateWorkspaceConfig,
  ValidationError,
} from "../mod.ts";
import type {
  ConfigDiagnostic,
  DepConstraint,
  DependencyEdgeConfig,
  InputDefinition,
  LoadMemberConfigResult,
  LoadProjectConfigsOptions,
  LoadWorkspaceConfigOptions,
  LoadWorkspaceConfigResult,
  NamedInput,
  ProjectDependencyEdge,
  ProjectDependencyEdgeType,
  ProjectGraph,
  ProjectConfig,
  ProjectNode,
  ProjectNodeId,
  TargetConfig,
  TargetDefaults,
  TargetDependency,
  ValidationResult,
  WorkspaceConfig,
} from "../mod.ts";

// ---------------------------------------------------------------------------
// Type-level smoke tests
// ---------------------------------------------------------------------------

Deno.test("mod.ts: WorkspaceConfig type is assignable", () => {
  const cfg: WorkspaceConfig = {
    members: ["packages/core"],
    dependencyEdges: [{ source: "@scope/app", target: "@scope/pkg" }],
  };
  assertEquals(cfg.members, ["packages/core"]);
  assertEquals(cfg.dependencyEdges?.length, 1);
});

Deno.test("mod.ts: ProjectConfig type is assignable", () => {
  const cfg: ProjectConfig = {
    name: "@scope/pkg",
    root: "packages/pkg",
    explicitDependencies: ["@scope/shared"],
  };
  assertEquals(cfg.name, "@scope/pkg");
  assertEquals(cfg.root, "packages/pkg");
  assertEquals(cfg.explicitDependencies, ["@scope/shared"]);
});

Deno.test("mod.ts: ProjectNode type is assignable", () => {
  const node: ProjectNode = { id: "@scope/pkg", root: "packages/pkg" };
  assertEquals(node.id, "@scope/pkg");
});

Deno.test("mod.ts: ProjectDependencyEdgeType is assignable", () => {
  const type: ProjectDependencyEdgeType = "explicit";
  assertEquals(type, "explicit");
});

Deno.test("mod.ts: ProjectDependencyEdge type is assignable", () => {
  const edge: ProjectDependencyEdge = {
    source: "@scope/app",
    target: "@scope/pkg",
    type: "explicit",
  };
  assertEquals(edge.source, "@scope/app");
  assertEquals(edge.target, "@scope/pkg");
  assertEquals(edge.type, "explicit");
});

Deno.test("mod.ts: ProjectGraph type is assignable", () => {
  const app: ProjectNodeId = "@scope/app";
  const pkg: ProjectNodeId = "@scope/pkg";
  const graph: ProjectGraph = {
    nodes: [{ id: app, root: "apps/app" }, { id: pkg, root: "packages/pkg" }],
    edges: [{ source: app, target: pkg, type: "implicit" }],
  };
  assertEquals(graph.nodes.length, 2);
  assertEquals(graph.edges.length, 1);
});

Deno.test("mod.ts: DependencyEdgeConfig type is assignable", () => {
  const edge: DependencyEdgeConfig = { source: "@scope/app", target: "@scope/pkg" };
  assertEquals(edge.source, "@scope/app");
  assertEquals(edge.target, "@scope/pkg");
});

Deno.test("mod.ts: TargetConfig type is assignable", () => {
  const t: TargetConfig = { command: "deno test" };
  assertEquals(t.command, "deno test");
});

Deno.test("mod.ts: TargetDefaults type is assignable", () => {
  const d: TargetDefaults = { cache: true };
  assertEquals(d.cache, true);
});

Deno.test("mod.ts: DepConstraint type is assignable", () => {
  const c: DepConstraint = {
    sourceTag: "scope:core",
    notDependOnLibsWithTags: ["scope:cli"],
  };
  assertEquals(c.sourceTag, "scope:core");
});

Deno.test("mod.ts: InputDefinition (fileset variant) is assignable", () => {
  const i: InputDefinition = { fileset: "**/*.ts" };
  assert("fileset" in i);
});

Deno.test("mod.ts: NamedInput type is assignable", () => {
  const n: NamedInput = ["src/**/*.ts", { env: "NODE_ENV" }];
  assertEquals(n.length, 2);
});

Deno.test("mod.ts: TargetDependency (string variant) is assignable", () => {
  const dep: TargetDependency = "build";
  assertEquals(dep, "build");
});

Deno.test("mod.ts: TargetDependency (object variant) is assignable", () => {
  const dep: TargetDependency = { target: "build", projects: "dependencies" };
  assert(typeof dep === "object" && "target" in dep);
});

// ---------------------------------------------------------------------------
// ConfigErrorCode — exported as a value (const object)
// ---------------------------------------------------------------------------

Deno.test("mod.ts: ConfigErrorCode.READ_ERROR is exported", () => {
  assertEquals(ConfigErrorCode.READ_ERROR, "CONFIG_READ_ERROR");
});

Deno.test("mod.ts: ConfigErrorCode.MISSING_FIELD is exported", () => {
  assertEquals(ConfigErrorCode.MISSING_FIELD, "CONFIG_MISSING_FIELD");
});

// ---------------------------------------------------------------------------
// ConfigError / ValidationError — exported as constructable classes
// ---------------------------------------------------------------------------

Deno.test("mod.ts: ConfigError is instantiable", () => {
  const diag: ConfigDiagnostic = {
    code: ConfigErrorCode.READ_ERROR,
    path: "",
    message: "test error",
  };
  const err = new ConfigError([diag]);
  assertInstanceOf(err, ConfigError);
  assertInstanceOf(err, Error);
  assertEquals(err.code, ConfigErrorCode.READ_ERROR);
});

Deno.test("mod.ts: ValidationError is instantiable and extends ConfigError", () => {
  const diag: ConfigDiagnostic = {
    code: ConfigErrorCode.MISSING_FIELD,
    path: "name",
    message: "required field is missing",
  };
  const err = new ValidationError([diag]);
  assertInstanceOf(err, ValidationError);
  assertInstanceOf(err, ConfigError);
  assertEquals(err.name, "ValidationError");
});

// ---------------------------------------------------------------------------
// validateWorkspaceConfig / validateProjectConfig — exported functions
// ---------------------------------------------------------------------------

Deno.test("mod.ts: validateWorkspaceConfig returns ok:true for valid input", () => {
  const result: ValidationResult = validateWorkspaceConfig({
    members: ["packages/core"],
  });
  assertEquals(result.ok, true);
});

Deno.test("mod.ts: validateProjectConfig returns ok:true for valid input", () => {
  const result: ValidationResult = validateProjectConfig({
    name: "@scope/pkg",
    root: "packages/pkg",
    version: "0.0.0",
  });
  assertEquals(result.ok, true);
});

Deno.test("mod.ts: validateArchitectureDependencies is callable", () => {
  const projects: ProjectConfig[] = [
    { name: "@scope/core", root: "packages/core", tags: ["scope:core"] },
    { name: "@scope/cli", root: "packages/cli", tags: ["scope:cli"] },
  ];
  const constraints: DepConstraint[] = [];
  const result = validateArchitectureDependencies(
    constraints,
    projects,
    [{ source: "@scope/core", target: "@scope/cli" }],
  );
  assertEquals(typeof result.ok, "boolean");
});

Deno.test("mod.ts: buildProjectGraph is callable", () => {
  const graph = buildProjectGraph(
    [
      {
        name: "@scope/app",
        root: "apps/app",
        explicitDependencies: ["@scope/pkg"],
      },
      {
        name: "@scope/pkg",
        root: "packages/pkg",
      },
    ],
  );
  assertEquals(graph.edges, [
    { source: "@scope/app", target: "@scope/pkg", type: "explicit" },
  ]);
});

// ---------------------------------------------------------------------------
// loadWorkspaceConfig / loadProjectConfigs — exported async functions
// ---------------------------------------------------------------------------

Deno.test("mod.ts: loadWorkspaceConfig returns ok:false for non-existent root", async () => {
  const readFile = (_path: string): Promise<string> => {
    return Promise.reject(new Error("file not found"));
  };
  const opts: LoadWorkspaceConfigOptions = { readFile };
  const result: LoadWorkspaceConfigResult = await loadWorkspaceConfig(
    "/no/such/path",
    opts,
  );
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.diagnostics[0].code, ConfigErrorCode.READ_ERROR);
  }
});

Deno.test("mod.ts: loadWorkspaceConfig returns ok:true for minimal valid input", async () => {
  const readFile = (_path: string): Promise<string> =>
    Promise.resolve('{ "workspace": ["packages/core"] }');
  const result: LoadWorkspaceConfigResult = await loadWorkspaceConfig(
    "/fake/root",
    { readFile },
  );
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals([...result.config.members], ["packages/core"]);
  }
});

Deno.test("mod.ts: loadProjectConfigs returns a result per member", async () => {
  const fs: Record<string, string> = {
    "/fake/root/packages/core/deno.json": JSON.stringify({
      name: "@scope/core",
      version: "0.0.0",
    }),
  };
  const readFile = (path: string): Promise<string> => {
    const content = fs[path];
    if (!content) return Promise.reject(new Error(`not found: ${path}`));
    return Promise.resolve(content);
  };
  const opts: LoadProjectConfigsOptions = { readFile };
  const results: readonly LoadMemberConfigResult[] = await loadProjectConfigs(
    "/fake/root",
    ["packages/core"],
    opts,
  );
  assertEquals(results.length, 1);
  assertEquals(results[0].member, "packages/core");
  assertEquals(results[0].ok, true);
  if (results[0].ok) {
    assertEquals(results[0].config.name, "@scope/core");
  }
});
