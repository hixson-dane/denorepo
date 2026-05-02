import { assertEquals } from "jsr:@std/assert@^1";
import {
  validateArchitectureDependencies,
  validateProjectConfig,
  validateWorkspaceConfig,
} from "./validate.ts";

// ---------------------------------------------------------------------------
// validateWorkspaceConfig
// ---------------------------------------------------------------------------

Deno.test("validateWorkspaceConfig — valid minimal config", () => {
  const result = validateWorkspaceConfig({ members: ["packages/core"] });
  assertEquals(result.ok, true);
  assertEquals(result.diagnostics.length, 0);
});

Deno.test("validateWorkspaceConfig — valid full config", () => {
  const result = validateWorkspaceConfig({
    members: ["packages/core", "packages/cli"],
    dependencyEdges: [{ source: "@denorepo/cli", target: "@denorepo/core" }],
    namedInputs: {
      default: [{ fileset: "**/*.ts" }, { env: "NODE_ENV" }],
    },
    targetDefaults: {
      build: { cache: true, outputs: ["dist/**"] },
    },
  });
  assertEquals(result.ok, true);
});

Deno.test("validateWorkspaceConfig — dependencyEdges entry with invalid source/target", () => {
  const result = validateWorkspaceConfig({
    members: [],
    dependencyEdges: [{ source: 123, target: null }],
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) => d.path === "dependencyEdges[0].source"),
    true,
  );
  assertEquals(
    result.diagnostics.some((d) => d.path === "dependencyEdges[0].target"),
    true,
  );
});

Deno.test("validateWorkspaceConfig — empty members array is valid", () => {
  const result = validateWorkspaceConfig({ members: [] });
  assertEquals(result.ok, true);
});

Deno.test("validateWorkspaceConfig — not a plain object", () => {
  const result = validateWorkspaceConfig(null);
  assertEquals(result.ok, false);
  assertEquals(result.diagnostics[0].path, "");
});

Deno.test("validateWorkspaceConfig — missing required members", () => {
  const result = validateWorkspaceConfig({});
  assertEquals(result.ok, false);
  assertEquals(result.diagnostics.some((d) => d.path === "members"), true);
});

Deno.test("validateWorkspaceConfig — members is not an array", () => {
  const result = validateWorkspaceConfig({ members: "packages/core" });
  assertEquals(result.ok, false);
  assertEquals(result.diagnostics.some((d) => d.path === "members"), true);
});

Deno.test("validateWorkspaceConfig — members contains non-string", () => {
  const result = validateWorkspaceConfig({ members: [42] });
  assertEquals(result.ok, false);
  assertEquals(result.diagnostics.some((d) => d.path === "members"), true);
});

Deno.test("validateWorkspaceConfig — namedInputs is not a plain object", () => {
  const result = validateWorkspaceConfig({
    members: [],
    namedInputs: "bad",
  });
  assertEquals(result.ok, false);
  assertEquals(result.diagnostics.some((d) => d.path === "namedInputs"), true);
});

Deno.test("validateWorkspaceConfig — namedInput entry is not an array", () => {
  const result = validateWorkspaceConfig({
    members: [],
    namedInputs: { default: "not-an-array" },
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) => d.path === "namedInputs.default"),
    true,
  );
});

Deno.test("validateWorkspaceConfig — namedInput entry with invalid InputDefinition", () => {
  const result = validateWorkspaceConfig({
    members: [],
    namedInputs: { default: [{ fileset: 123 }] },
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) => d.path === "namedInputs.default[0].fileset"),
    true,
  );
});

Deno.test("validateWorkspaceConfig — namedInput InputDefinition with multiple variant keys", () => {
  const result = validateWorkspaceConfig({
    members: [],
    namedInputs: { bad: [{ fileset: "**", env: "X" }] },
  });
  assertEquals(result.ok, false);
});

Deno.test("validateWorkspaceConfig — namedInput InputDefinition with no variant key", () => {
  const result = validateWorkspaceConfig({
    members: [],
    namedInputs: { bad: [{}] },
  });
  assertEquals(result.ok, false);
});

Deno.test("validateWorkspaceConfig — namedInput InputDefinition input variant with invalid projects", () => {
  const result = validateWorkspaceConfig({
    members: [],
    namedInputs: {
      bad: [{ input: "default", projects: "invalid-value" }],
    },
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) => d.path === "namedInputs.bad[0].projects"),
    true,
  );
});

Deno.test("validateWorkspaceConfig — targetDefaults is not a plain object", () => {
  const result = validateWorkspaceConfig({
    members: [],
    targetDefaults: 42,
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) => d.path === "targetDefaults"),
    true,
  );
});

Deno.test("validateWorkspaceConfig — targetDefaults entry with invalid cache type", () => {
  const result = validateWorkspaceConfig({
    members: [],
    targetDefaults: { build: { cache: "yes" } },
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) => d.path === "targetDefaults.build.cache"),
    true,
  );
});

Deno.test("validateWorkspaceConfig — namedInputs undefined is ignored", () => {
  const result = validateWorkspaceConfig({
    members: ["packages/core"],
    namedInputs: undefined,
  });
  assertEquals(result.ok, true);
});

Deno.test("validateWorkspaceConfig — namedInput item is neither string nor plain object", () => {
  const result = validateWorkspaceConfig({
    members: [],
    namedInputs: { default: [42] },
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) => d.path === "namedInputs.default[0]"),
    true,
  );
});

Deno.test("validateWorkspaceConfig — namedInput contains valid string item", () => {
  const result = validateWorkspaceConfig({
    members: [],
    namedInputs: { default: ["**/*.ts"] },
  });
  assertEquals(result.ok, true);
});

Deno.test("validateWorkspaceConfig — targetDefaults entry is not a plain object", () => {
  const result = validateWorkspaceConfig({
    members: [],
    targetDefaults: { build: "not-an-object" },
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) => d.path === "targetDefaults.build"),
    true,
  );
});

Deno.test("validateWorkspaceConfig — targetDefaults entry with invalid outputs type", () => {
  const result = validateWorkspaceConfig({
    members: [],
    targetDefaults: { build: { outputs: "dist/**" } },
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) => d.path === "targetDefaults.build.outputs"),
    true,
  );
});

Deno.test("validateWorkspaceConfig — targetDefaults entry with invalid inputs type", () => {
  const result = validateWorkspaceConfig({
    members: [],
    targetDefaults: { build: { inputs: "bad" } },
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) => d.path === "targetDefaults.build.inputs"),
    true,
  );
});

Deno.test("validateWorkspaceConfig — targetDefaults entry with invalid dependsOn type", () => {
  const result = validateWorkspaceConfig({
    members: [],
    targetDefaults: { test: { dependsOn: "build" } },
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) => d.path === "targetDefaults.test.dependsOn"),
    true,
  );
});

Deno.test("validateWorkspaceConfig — valid targetDefaults with full fields", () => {
  const result = validateWorkspaceConfig({
    members: ["packages/core"],
    targetDefaults: {
      build: {
        inputs: ["**/*.ts"],
        outputs: ["dist/**"],
        dependsOn: ["lint"],
        cache: true,
      },
    },
  });
  assertEquals(result.ok, true);
});

Deno.test("validateWorkspaceConfig — constraint with no tag restriction arrays is valid", () => {
  const result = validateWorkspaceConfig({
    members: [],
    constraints: [{ sourceTag: "scope:core" }],
  });
  assertEquals(result.ok, true);
});

// ---------------------------------------------------------------------------
// validateProjectConfig
// ---------------------------------------------------------------------------

Deno.test("validateProjectConfig — valid minimal config", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
  });
  assertEquals(result.ok, true);
  assertEquals(result.diagnostics.length, 0);
});

Deno.test("validateProjectConfig — valid full config", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
    version: "0.0.0",
    tags: ["scope:core", "type:library"],
    targets: {
      build: { command: "deno compile .", cache: true, outputs: ["dist/**"] },
      test: {
        command: "deno test",
        dependsOn: ["build", { target: "lint", projects: "self" }],
      },
    },
    implicitDependencies: ["@denorepo/plugin-sdk"],
    namedInputs: {
      sources: [{ fileset: "src/**/*.ts" }],
    },
  });
  assertEquals(result.ok, true);
});

Deno.test("validateProjectConfig — not a plain object", () => {
  const result = validateProjectConfig("string");
  assertEquals(result.ok, false);
  assertEquals(result.diagnostics[0].path, "");
});

Deno.test("validateProjectConfig — missing required name", () => {
  const result = validateProjectConfig({ root: "packages/core" });
  assertEquals(result.ok, false);
  assertEquals(result.diagnostics.some((d) => d.path === "name"), true);
});

Deno.test("validateProjectConfig — missing required root", () => {
  const result = validateProjectConfig({ name: "@denorepo/core" });
  assertEquals(result.ok, false);
  assertEquals(result.diagnostics.some((d) => d.path === "root"), true);
});

Deno.test("validateProjectConfig — both required fields missing", () => {
  const result = validateProjectConfig({});
  assertEquals(result.ok, false);
  assertEquals(result.diagnostics.length >= 2, true);
});

Deno.test("validateProjectConfig — name is not a string", () => {
  const result = validateProjectConfig({ name: 42, root: "packages/core" });
  assertEquals(result.ok, false);
  assertEquals(result.diagnostics.some((d) => d.path === "name"), true);
});

Deno.test("validateProjectConfig — root is not a string", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: ["packages/core"],
  });
  assertEquals(result.ok, false);
  assertEquals(result.diagnostics.some((d) => d.path === "root"), true);
});

Deno.test("validateProjectConfig — optional version is not a string", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
    version: 1,
  });
  assertEquals(result.ok, false);
  assertEquals(result.diagnostics.some((d) => d.path === "version"), true);
});

Deno.test("validateProjectConfig — optional tags contains non-string", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
    tags: ["scope:core", 99],
  });
  assertEquals(result.ok, false);
  assertEquals(result.diagnostics.some((d) => d.path === "tags"), true);
});

Deno.test("validateProjectConfig — targets is not a plain object", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
    targets: ["build"],
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) => d.path === "targets"),
    true,
  );
});

Deno.test("validateProjectConfig — target command is not a string", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
    targets: { build: { command: 123 } },
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) => d.path === "targets.build.command"),
    true,
  );
});

Deno.test("validateProjectConfig — target executor is not a string", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
    targets: { build: { executor: false } },
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) => d.path === "targets.build.executor"),
    true,
  );
});

Deno.test("validateProjectConfig — target outputs is not array of strings", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
    targets: { build: { outputs: [1, 2] } },
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) => d.path === "targets.build.outputs"),
    true,
  );
});

Deno.test("validateProjectConfig — target dependsOn contains invalid object", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
    targets: {
      build: { dependsOn: [{ target: 42 }] },
    },
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) =>
      d.path === "targets.build.dependsOn[0].target"
    ),
    true,
  );
});

Deno.test("validateProjectConfig — target dependsOn is not an array", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
    targets: { build: { dependsOn: "build" } },
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) => d.path === "targets.build.dependsOn"),
    true,
  );
});

Deno.test("validateProjectConfig — target options is not a plain object", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
    targets: { build: { options: "opts" } },
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) => d.path === "targets.build.options"),
    true,
  );
});

Deno.test("validateProjectConfig — implicitDependencies contains non-string", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
    implicitDependencies: [null],
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) => d.path === "implicitDependencies"),
    true,
  );
});

Deno.test("validateProjectConfig — explicitDependencies contains non-string", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
    explicitDependencies: [null],
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) => d.path === "explicitDependencies"),
    true,
  );
});

Deno.test("validateProjectConfig — namedInputs entry invalid", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
    namedInputs: { sources: "not-an-array" },
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) => d.path === "namedInputs.sources"),
    true,
  );
});

Deno.test("validateProjectConfig — optional undefined fields are ignored", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
    version: undefined,
    tags: undefined,
    targets: undefined,
    implicitDependencies: undefined,
    explicitDependencies: undefined,
    namedInputs: undefined,
  });
  assertEquals(result.ok, true);
});

Deno.test("validateProjectConfig — target with string dependsOn item is valid", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
    targets: {
      test: { dependsOn: ["build"] },
    },
  });
  assertEquals(result.ok, true);
});

Deno.test("validateProjectConfig — target with input variant InputDefinition", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
    targets: {
      build: { inputs: [{ input: "default", projects: "dependencies" }] },
    },
  });
  assertEquals(result.ok, true);
});

Deno.test("validateProjectConfig — target with runtime InputDefinition", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
    targets: {
      build: { inputs: [{ runtime: "echo version" }] },
    },
  });
  assertEquals(result.ok, true);
});

Deno.test("validateProjectConfig — target with env InputDefinition", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
    targets: {
      build: { inputs: [{ env: "NODE_ENV" }] },
    },
  });
  assertEquals(result.ok, true);
});

Deno.test("validateProjectConfig — target cache is not boolean", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
    targets: { build: { cache: "yes" } },
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) => d.path === "targets.build.cache"),
    true,
  );
});

Deno.test("validateProjectConfig — target inputs is not an array", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
    targets: { build: { inputs: "**/*.ts" } },
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) => d.path === "targets.build.inputs"),
    true,
  );
});

Deno.test("validateProjectConfig — target inputs contains item that is neither string nor object", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
    targets: { build: { inputs: [42] } },
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) => d.path === "targets.build.inputs[0]"),
    true,
  );
});

Deno.test("validateProjectConfig — target inputs contains invalid InputDefinition", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
    targets: { build: { inputs: [{ fileset: 123 }] } },
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) =>
      d.path === "targets.build.inputs[0].fileset"
    ),
    true,
  );
});

Deno.test("validateProjectConfig — target dependsOn contains item that is neither string nor object", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
    targets: { build: { dependsOn: [42] } },
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) =>
      d.path === "targets.build.dependsOn[0]"
    ),
    true,
  );
});

Deno.test("validateProjectConfig — target dependsOn object with valid projects string", () => {
  const result = validateProjectConfig({
    name: "@denorepo/core",
    root: "packages/core",
    targets: {
      test: {
        dependsOn: [
          { target: "build", projects: "dependencies" },
          { target: "lint", projects: "@denorepo/cli" },
        ],
      },
    },
  });
  assertEquals(result.ok, true);
});

Deno.test("validateProjectConfig — multiple field errors reported together", () => {
  const result = validateProjectConfig({
    name: 42,
    root: 99,
    version: true,
  });
  assertEquals(result.ok, false);
  assertEquals(result.diagnostics.length >= 3, true);
  assertEquals(result.diagnostics.some((d) => d.path === "name"), true);
  assertEquals(result.diagnostics.some((d) => d.path === "root"), true);
  assertEquals(result.diagnostics.some((d) => d.path === "version"), true);
});

// ---------------------------------------------------------------------------
// validateWorkspaceConfig — constraints field
// ---------------------------------------------------------------------------

Deno.test("validateWorkspaceConfig — valid constraints array", () => {
  const result = validateWorkspaceConfig({
    members: ["packages/core", "packages/cli"],
    constraints: [
      { sourceTag: "scope:core", notDependOnLibsWithTags: ["scope:cli"] },
      {
        sourceTag: "scope:plugin",
        onlyDependOnLibsWithTags: ["scope:plugin-sdk", "scope:core"],
      },
    ],
  });
  assertEquals(result.ok, true);
});

Deno.test("validateWorkspaceConfig — constraints undefined is ignored", () => {
  const result = validateWorkspaceConfig({
    members: [],
    constraints: undefined,
  });
  assertEquals(result.ok, true);
});

Deno.test("validateWorkspaceConfig — constraints is not an array", () => {
  const result = validateWorkspaceConfig({
    members: [],
    constraints: "bad",
  });
  assertEquals(result.ok, false);
  assertEquals(result.diagnostics.some((d) => d.path === "constraints"), true);
});

Deno.test("validateWorkspaceConfig — constraint entry is not a plain object", () => {
  const result = validateWorkspaceConfig({
    members: [],
    constraints: ["not-an-object"],
  });
  assertEquals(result.ok, false);
  assertEquals(result.diagnostics.some((d) => d.path === "constraints[0]"), true);
});

Deno.test("validateWorkspaceConfig — constraint entry missing sourceTag", () => {
  const result = validateWorkspaceConfig({
    members: [],
    constraints: [{ notDependOnLibsWithTags: ["scope:cli"] }],
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) => d.path === "constraints[0].sourceTag"),
    true,
  );
});

Deno.test("validateWorkspaceConfig — constraint notDependOnLibsWithTags is not array of strings", () => {
  const result = validateWorkspaceConfig({
    members: [],
    constraints: [{ sourceTag: "scope:core", notDependOnLibsWithTags: [42] }],
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) =>
      d.path === "constraints[0].notDependOnLibsWithTags"
    ),
    true,
  );
});

Deno.test("validateWorkspaceConfig — constraint onlyDependOnLibsWithTags is not array of strings", () => {
  const result = validateWorkspaceConfig({
    members: [],
    constraints: [{ sourceTag: "scope:core", onlyDependOnLibsWithTags: [{}] }],
  });
  assertEquals(result.ok, false);
  assertEquals(
    result.diagnostics.some((d) =>
      d.path === "constraints[0].onlyDependOnLibsWithTags"
    ),
    true,
  );
});

// ---------------------------------------------------------------------------
// validateArchitectureDependencies
// ---------------------------------------------------------------------------

Deno.test("validateArchitectureDependencies — no constraints returns ok", () => {
  const result = validateArchitectureDependencies([], [
    { name: "@denorepo/core", root: "packages/core", tags: ["scope:core"] },
  ]);
  assertEquals(result.ok, true);
});

Deno.test("validateArchitectureDependencies — no projects returns ok", () => {
  const result = validateArchitectureDependencies(
    [{ sourceTag: "scope:core", notDependOnLibsWithTags: ["scope:cli"] }],
    [],
  );
  assertEquals(result.ok, true);
});

Deno.test("validateArchitectureDependencies — valid: core does not depend on cli", () => {
  const result = validateArchitectureDependencies(
    [{ sourceTag: "scope:core", notDependOnLibsWithTags: ["scope:cli"] }],
    [
      {
        name: "@denorepo/core",
        root: "packages/core",
        tags: ["scope:core"],
        implicitDependencies: ["@denorepo/plugin-sdk"],
      },
      {
        name: "@denorepo/cli",
        root: "packages/cli",
        tags: ["scope:cli"],
      },
      {
        name: "@denorepo/plugin-sdk",
        root: "packages/plugin-sdk",
        tags: ["scope:plugin-sdk"],
      },
    ],
  );
  assertEquals(result.ok, true);
});

Deno.test("validateArchitectureDependencies — violation: core depends on cli", () => {
  const result = validateArchitectureDependencies(
    [{ sourceTag: "scope:core", notDependOnLibsWithTags: ["scope:cli"] }],
    [
      {
        name: "@denorepo/core",
        root: "packages/core",
        tags: ["scope:core"],
        implicitDependencies: ["@denorepo/cli"],
      },
      {
        name: "@denorepo/cli",
        root: "packages/cli",
        tags: ["scope:cli"],
      },
    ],
  );
  assertEquals(result.ok, false);
  assertEquals(result.diagnostics.length, 1);
  assertEquals(result.diagnostics[0].code, "CONFIG_FORBIDDEN_DEPENDENCY");
  assertEquals(
    result.diagnostics[0].path,
    "@denorepo/core.implicitDependencies",
  );
});

Deno.test("validateArchitectureDependencies — violation: remote-cache depends on cli", () => {
  const result = validateArchitectureDependencies(
    [{ sourceTag: "scope:remote-cache", notDependOnLibsWithTags: ["scope:cli"] }],
    [
      {
        name: "@denorepo/remote-cache",
        root: "apps/remote-cache",
        tags: ["scope:remote-cache"],
        implicitDependencies: ["@denorepo/cli"],
      },
      {
        name: "@denorepo/cli",
        root: "packages/cli",
        tags: ["scope:cli"],
      },
    ],
  );
  assertEquals(result.ok, false);
  assertEquals(result.diagnostics[0].code, "CONFIG_FORBIDDEN_DEPENDENCY");
});

Deno.test("validateArchitectureDependencies — valid: onlyDependOnLibsWithTags satisfied", () => {
  const result = validateArchitectureDependencies(
    [{
      sourceTag: "scope:plugin",
      onlyDependOnLibsWithTags: ["scope:plugin-sdk", "scope:core"],
    }],
    [
      {
        name: "@denorepo/plugin-deno",
        root: "packages/plugins/deno",
        tags: ["scope:plugin"],
        implicitDependencies: ["@denorepo/plugin-sdk"],
      },
      {
        name: "@denorepo/plugin-sdk",
        root: "packages/plugin-sdk",
        tags: ["scope:plugin-sdk"],
      },
    ],
  );
  assertEquals(result.ok, true);
});

Deno.test("validateArchitectureDependencies — violation: onlyDependOnLibsWithTags not satisfied", () => {
  const result = validateArchitectureDependencies(
    [{
      sourceTag: "scope:plugin",
      onlyDependOnLibsWithTags: ["scope:plugin-sdk"],
    }],
    [
      {
        name: "@denorepo/plugin-deno",
        root: "packages/plugins/deno",
        tags: ["scope:plugin"],
        implicitDependencies: ["@denorepo/core"],
      },
      {
        name: "@denorepo/core",
        root: "packages/core",
        tags: ["scope:core"],
      },
    ],
  );
  assertEquals(result.ok, false);
  assertEquals(result.diagnostics[0].code, "CONFIG_FORBIDDEN_DEPENDENCY");
  assertEquals(
    result.diagnostics[0].path,
    "@denorepo/plugin-deno.implicitDependencies",
  );
});

Deno.test("validateArchitectureDependencies — dependency not in projects list is skipped", () => {
  // If dep project is unknown, we can't check its tags — skip silently.
  const result = validateArchitectureDependencies(
    [{ sourceTag: "scope:core", notDependOnLibsWithTags: ["scope:cli"] }],
    [
      {
        name: "@denorepo/core",
        root: "packages/core",
        tags: ["scope:core"],
        implicitDependencies: ["@denorepo/unknown-package"],
      },
    ],
  );
  assertEquals(result.ok, true);
});

Deno.test("validateArchitectureDependencies — constraint does not apply when source tag absent", () => {
  // Project without the constraint's sourceTag should not be checked.
  const result = validateArchitectureDependencies(
    [{ sourceTag: "scope:core", notDependOnLibsWithTags: ["scope:cli"] }],
    [
      {
        name: "@denorepo/cli",
        root: "packages/cli",
        tags: ["scope:cli"],
        implicitDependencies: ["@denorepo/other-cli"],
      },
      {
        name: "@denorepo/other-cli",
        root: "packages/other-cli",
        tags: ["scope:cli"],
      },
    ],
  );
  assertEquals(result.ok, true);
});

Deno.test("validateArchitectureDependencies — project with no tags is not affected by constraints", () => {
  const result = validateArchitectureDependencies(
    [{ sourceTag: "scope:core", notDependOnLibsWithTags: ["scope:cli"] }],
    [
      {
        name: "@denorepo/untagged",
        root: "packages/untagged",
        implicitDependencies: ["@denorepo/cli"],
      },
      {
        name: "@denorepo/cli",
        root: "packages/cli",
        tags: ["scope:cli"],
      },
    ],
  );
  assertEquals(result.ok, true);
});

Deno.test("validateArchitectureDependencies — multiple violations reported", () => {
  const result = validateArchitectureDependencies(
    [{ sourceTag: "scope:core", notDependOnLibsWithTags: ["scope:cli"] }],
    [
      {
        name: "@denorepo/core",
        root: "packages/core",
        tags: ["scope:core"],
        implicitDependencies: ["@denorepo/cli", "@denorepo/cli-utils"],
      },
      { name: "@denorepo/cli", root: "packages/cli", tags: ["scope:cli"] },
      {
        name: "@denorepo/cli-utils",
        root: "packages/cli-utils",
        tags: ["scope:cli"],
      },
    ],
  );
  assertEquals(result.ok, false);
  assertEquals(result.diagnostics.length, 2);
});

Deno.test("validateArchitectureDependencies — constraint with both notDepend and onlyDepend on same dep", () => {
  // dep has forbidden tag AND is not in the allowed-only list → two violations.
  const result = validateArchitectureDependencies(
    [{
      sourceTag: "scope:plugin",
      notDependOnLibsWithTags: ["scope:cli"],
      onlyDependOnLibsWithTags: ["scope:plugin-sdk"],
    }],
    [
      {
        name: "@denorepo/plugin-deno",
        root: "packages/plugins/deno",
        tags: ["scope:plugin"],
        implicitDependencies: ["@denorepo/cli"],
      },
      {
        name: "@denorepo/cli",
        root: "packages/cli",
        tags: ["scope:cli"],
      },
    ],
  );
  assertEquals(result.ok, false);
  assertEquals(result.diagnostics.length, 2);
  assertEquals(result.diagnostics[0].code, "CONFIG_FORBIDDEN_DEPENDENCY");
  assertEquals(result.diagnostics[1].code, "CONFIG_FORBIDDEN_DEPENDENCY");
});

Deno.test("validateArchitectureDependencies — constraint with empty tag arrays behaves as no restriction", () => {
  // An empty notDependOnLibsWithTags array should not trigger violations.
  const result = validateArchitectureDependencies(
    [{
      sourceTag: "scope:core",
      notDependOnLibsWithTags: [],
      onlyDependOnLibsWithTags: [],
    }],
    [
      {
        name: "@denorepo/core",
        root: "packages/core",
        tags: ["scope:core"],
        implicitDependencies: ["@denorepo/cli"],
      },
      {
        name: "@denorepo/cli",
        root: "packages/cli",
        tags: ["scope:cli"],
      },
    ],
  );
  assertEquals(result.ok, true);
});

Deno.test("validateArchitectureDependencies — multiple projects with multiple constraints", () => {
  const result = validateArchitectureDependencies(
    [
      { sourceTag: "scope:core", notDependOnLibsWithTags: ["scope:cli"] },
      {
        sourceTag: "scope:plugin",
        onlyDependOnLibsWithTags: ["scope:plugin-sdk"],
      },
    ],
    [
      {
        name: "@denorepo/core",
        root: "packages/core",
        tags: ["scope:core"],
        implicitDependencies: ["@denorepo/plugin-sdk"],
      },
      {
        name: "@denorepo/plugin-deno",
        root: "packages/plugins/deno",
        tags: ["scope:plugin"],
        implicitDependencies: ["@denorepo/plugin-sdk"],
      },
      {
        name: "@denorepo/plugin-sdk",
        root: "packages/plugin-sdk",
        tags: ["scope:plugin-sdk"],
      },
    ],
  );
  assertEquals(result.ok, true);
});

Deno.test("validateArchitectureDependencies — diagnostic message includes project and dep names", () => {
  const result = validateArchitectureDependencies(
    [{ sourceTag: "scope:core", notDependOnLibsWithTags: ["scope:cli"] }],
    [
      {
        name: "@denorepo/core",
        root: "packages/core",
        tags: ["scope:core"],
        implicitDependencies: ["@denorepo/cli"],
      },
      {
        name: "@denorepo/cli",
        root: "packages/cli",
        tags: ["scope:cli"],
      },
    ],
  );
  assertEquals(result.ok, false);
  assertEquals(result.diagnostics[0].message.includes("@denorepo/core"), true);
  assertEquals(result.diagnostics[0].message.includes("@denorepo/cli"), true);
});
