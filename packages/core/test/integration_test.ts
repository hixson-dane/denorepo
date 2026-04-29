/**
 * Integration tests for multi-project workspace loading.
 *
 * These tests exercise {@link loadWorkspaceConfig} and
 * {@link loadProjectConfigs} end-to-end against real fixture files on disk,
 * without any file-reading mocks.  Each fixture directory under
 * `test/fixtures/` represents a concrete workspace layout whose loading
 * outcome — both the successful config shapes and the diagnostic messages
 * produced for invalid inputs — is asserted here.
 *
 * Fixture layouts
 * ---------------
 * valid-multi-package/
 *   Workspace with two packages (@fixture/core, @fixture/cli) and one app
 *   (@fixture/remote-cache). All members are valid; used to assert the full
 *   happy-path config shape.
 *
 * invalid-workspace/
 *   Root deno.json that is missing the required "workspace" field.  Used to
 *   assert that the correct diagnostic code and message are produced.
 *
 * workspace-with-bad-members/
 *   Workspace whose members include a file with unparseable JSON, a project
 *   missing the required "name" field, and one fully-valid project.  Used to
 *   assert partial-failure behaviour and per-member diagnostic content.
 *
 * @module
 */

import { assertEquals } from "jsr:@std/assert@^1";
import { loadProjectConfigs } from "../src/load_project.ts";
import { loadWorkspaceConfig } from "../src/load.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolves a path relative to the fixtures directory next to this file. */
function fixturePath(name: string): string {
  return new URL(`./fixtures/${name}`, import.meta.url).pathname;
}

// ---------------------------------------------------------------------------
// valid-multi-package — happy-path end-to-end
// ---------------------------------------------------------------------------

Deno.test("integration: valid-multi-package — workspace lists all three members", async () => {
  const root = fixturePath("valid-multi-package");
  const result = await loadWorkspaceConfig(root);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals([...result.config.members], [
      "packages/core",
      "packages/cli",
      "apps/remote-cache",
    ]);
  }
});

Deno.test("integration: valid-multi-package — all project configs load successfully", async () => {
  const root = fixturePath("valid-multi-package");
  const wsResult = await loadWorkspaceConfig(root);
  assertEquals(wsResult.ok, true);
  if (!wsResult.ok) return;

  const results = await loadProjectConfigs(root, wsResult.config.members);
  assertEquals(results.length, 3);
  for (const r of results) {
    assertEquals(r.ok, true, `Expected member "${r.member}" to load OK`);
  }
});

Deno.test("integration: valid-multi-package — packages/core config shape matches fixture", async () => {
  const root = fixturePath("valid-multi-package");
  const results = await loadProjectConfigs(root, ["packages/core"]);

  assertEquals(results[0].ok, true);
  if (results[0].ok) {
    const cfg = results[0].config;
    assertEquals(cfg.name, "@fixture/core");
    assertEquals(cfg.root, "packages/core");
    assertEquals(cfg.version, "1.0.0");
    assertEquals([...cfg.tags!], ["scope:core", "type:library"]);
  }
});

Deno.test("integration: valid-multi-package — packages/cli config shape matches fixture", async () => {
  const root = fixturePath("valid-multi-package");
  const results = await loadProjectConfigs(root, ["packages/cli"]);

  assertEquals(results[0].ok, true);
  if (results[0].ok) {
    const cfg = results[0].config;
    assertEquals(cfg.name, "@fixture/cli");
    assertEquals(cfg.root, "packages/cli");
    assertEquals(cfg.version, "1.0.0");
    assertEquals([...cfg.tags!], ["scope:cli", "type:app"]);
    assertEquals([...cfg.implicitDependencies!], ["@fixture/core"]);
  }
});

Deno.test("integration: valid-multi-package — apps/remote-cache config shape matches fixture", async () => {
  const root = fixturePath("valid-multi-package");
  const results = await loadProjectConfigs(root, ["apps/remote-cache"]);

  assertEquals(results[0].ok, true);
  if (results[0].ok) {
    const cfg = results[0].config;
    assertEquals(cfg.name, "@fixture/remote-cache");
    assertEquals(cfg.root, "apps/remote-cache");
    assertEquals(cfg.version, "0.2.0");
    assertEquals([...cfg.tags!], ["scope:app", "type:app"]);
  }
});

Deno.test("integration: valid-multi-package — results preserve member order", async () => {
  const root = fixturePath("valid-multi-package");
  const members = ["packages/core", "packages/cli", "apps/remote-cache"];
  const results = await loadProjectConfigs(root, members);

  for (let i = 0; i < members.length; i++) {
    assertEquals(results[i].member, members[i]);
  }
});

// ---------------------------------------------------------------------------
// invalid-workspace — missing "workspace" field diagnostics
// ---------------------------------------------------------------------------

Deno.test('integration: invalid-workspace — result is not ok', async () => {
  const result = await loadWorkspaceConfig(fixturePath("invalid-workspace"));
  assertEquals(result.ok, false);
});

Deno.test('integration: invalid-workspace — diagnostic code is CONFIG_MISSING_FIELD', async () => {
  const result = await loadWorkspaceConfig(fixturePath("invalid-workspace"));
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.diagnostics[0].code, "CONFIG_MISSING_FIELD");
  }
});

Deno.test('integration: invalid-workspace — diagnostic path is "workspace"', async () => {
  const result = await loadWorkspaceConfig(fixturePath("invalid-workspace"));
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.diagnostics[0].path, "workspace");
  }
});

Deno.test('integration: invalid-workspace — diagnostic message mentions "workspace"', async () => {
  const result = await loadWorkspaceConfig(fixturePath("invalid-workspace"));
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.diagnostics[0].message.includes('"workspace"'), true);
  }
});

Deno.test('integration: invalid-workspace — diagnostic file points to root deno.json', async () => {
  const root = fixturePath("invalid-workspace");
  const result = await loadWorkspaceConfig(root);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.diagnostics[0].file, `${root}/deno.json`);
  }
});

// ---------------------------------------------------------------------------
// workspace-with-bad-members — partial failure diagnostics
// ---------------------------------------------------------------------------

Deno.test("integration: workspace-with-bad-members — workspace config loads OK", async () => {
  const result = await loadWorkspaceConfig(
    fixturePath("workspace-with-bad-members"),
  );
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals([...result.config.members], [
      "packages/valid",
      "packages/bad-json",
      "packages/missing-name",
    ]);
  }
});

Deno.test("integration: workspace-with-bad-members — packages/valid loads successfully", async () => {
  const root = fixturePath("workspace-with-bad-members");
  const results = await loadProjectConfigs(root, ["packages/valid"]);

  assertEquals(results[0].ok, true);
  if (results[0].ok) {
    assertEquals(results[0].config.name, "@fixture/valid");
    assertEquals(results[0].config.root, "packages/valid");
    assertEquals(results[0].config.version, "0.0.0");
  }
});

Deno.test("integration: workspace-with-bad-members — packages/bad-json returns parse diagnostic", async () => {
  const root = fixturePath("workspace-with-bad-members");
  const results = await loadProjectConfigs(root, ["packages/bad-json"]);

  assertEquals(results[0].ok, false);
  if (!results[0].ok) {
    assertEquals(results[0].member, "packages/bad-json");
    assertEquals(results[0].diagnostics[0].code, "CONFIG_PARSE_ERROR");
    assertEquals(
      results[0].diagnostics[0].message.includes("Failed to parse"),
      true,
    );
    assertEquals(
      results[0].diagnostics[0].file,
      `${root}/packages/bad-json/deno.json`,
    );
  }
});

Deno.test('integration: workspace-with-bad-members — packages/missing-name returns missing-field diagnostic', async () => {
  const root = fixturePath("workspace-with-bad-members");
  const results = await loadProjectConfigs(root, ["packages/missing-name"]);

  assertEquals(results[0].ok, false);
  if (!results[0].ok) {
    assertEquals(results[0].member, "packages/missing-name");
    assertEquals(
      results[0].diagnostics.some(
        (d) => d.path === "name" && d.code === "CONFIG_MISSING_FIELD",
      ),
      true,
    );
  }
});

Deno.test("integration: workspace-with-bad-members — partial failure does not block valid members", async () => {
  const root = fixturePath("workspace-with-bad-members");
  const results = await loadProjectConfigs(root, [
    "packages/valid",
    "packages/bad-json",
    "packages/missing-name",
  ]);

  assertEquals(results.length, 3);
  assertEquals(results[0].ok, true, 'packages/valid should succeed');
  assertEquals(results[1].ok, false, 'packages/bad-json should fail');
  assertEquals(results[2].ok, false, 'packages/missing-name should fail');
});

Deno.test("integration: workspace-with-bad-members — all three members are represented in results", async () => {
  const root = fixturePath("workspace-with-bad-members");
  const members = ["packages/valid", "packages/bad-json", "packages/missing-name"];
  const results = await loadProjectConfigs(root, members);

  for (let i = 0; i < members.length; i++) {
    assertEquals(results[i].member, members[i]);
  }
});

Deno.test("integration: workspace-with-bad-members — end-to-end: load workspace then projects captures all diagnostics", async () => {
  const root = fixturePath("workspace-with-bad-members");
  const wsResult = await loadWorkspaceConfig(root);
  assertEquals(wsResult.ok, true);
  if (!wsResult.ok) return;

  const results = await loadProjectConfigs(root, wsResult.config.members);

  const failedMembers = results.filter((r) => !r.ok).map((r) => r.member);
  assertEquals(failedMembers, ["packages/bad-json", "packages/missing-name"]);

  // Collect all diagnostics from failed members
  const allDiagCodes = results
    .filter((r) => !r.ok)
    .flatMap((r) => (!r.ok ? r.diagnostics : []))
    .map((d) => d.code);

  assertEquals(allDiagCodes.includes("CONFIG_PARSE_ERROR"), true);
  assertEquals(allDiagCodes.includes("CONFIG_MISSING_FIELD"), true);
});
