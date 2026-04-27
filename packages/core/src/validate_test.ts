import { assertEquals } from "jsr:@std/assert@^1";
import {
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
    namedInputs: {
      default: [{ fileset: "**/*.ts" }, { env: "NODE_ENV" }],
    },
    targetDefaults: {
      build: { cache: true, outputs: ["dist/**"] },
    },
  });
  assertEquals(result.ok, true);
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
