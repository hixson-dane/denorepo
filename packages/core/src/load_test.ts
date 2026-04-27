import { assertEquals } from "jsr:@std/assert@^1";
import { loadWorkspaceConfig } from "./load.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a `readFile` stub that maps paths to file contents.
 * Throws a `Deno.errors.NotFound`-like error when the path is not in the map.
 */
function makeReader(
  files: Record<string, string>,
): (path: string) => Promise<string> {
  return async (path: string): Promise<string> => {
    if (path in files) return files[path];
    throw new Error(`No such file: ${path}`);
  };
}

// ---------------------------------------------------------------------------
// Happy-path tests
// ---------------------------------------------------------------------------

Deno.test("loadWorkspaceConfig — loads valid deno.json with members", async () => {
  const result = await loadWorkspaceConfig("/workspace", {
    readFile: makeReader({
      "/workspace/deno.json": JSON.stringify({
        workspace: ["packages/core", "packages/cli"],
      }),
    }),
  });
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.config.members, ["packages/core", "packages/cli"]);
  }
});

Deno.test("loadWorkspaceConfig — empty workspace array is valid", async () => {
  const result = await loadWorkspaceConfig("/workspace", {
    readFile: makeReader({
      "/workspace/deno.json": JSON.stringify({ workspace: [] }),
    }),
  });
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.config.members, []);
  }
});

Deno.test("loadWorkspaceConfig — strips trailing slash from root path", async () => {
  const result = await loadWorkspaceConfig("/workspace/", {
    readFile: makeReader({
      "/workspace/deno.json": JSON.stringify({ workspace: ["packages/core"] }),
    }),
  });
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.config.members, ["packages/core"]);
  }
});

Deno.test("loadWorkspaceConfig — parses JSONC with comments", async () => {
  const jsoncContent = `{
    // Workspace members
    "workspace": [
      "packages/core", // core library
      "apps/remote-cache"
    ]
  }`;
  const result = await loadWorkspaceConfig("/workspace", {
    readFile: makeReader({ "/workspace/deno.json": jsoncContent }),
  });
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.config.members, ["packages/core", "apps/remote-cache"]);
  }
});

Deno.test("loadWorkspaceConfig — accepts URL as workspaceRoot", async () => {
  const result = await loadWorkspaceConfig(new URL("file:///workspace"), {
    readFile: makeReader({
      "/workspace/deno.json": JSON.stringify({ workspace: ["packages/core"] }),
    }),
  });
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.config.members, ["packages/core"]);
  }
});

// ---------------------------------------------------------------------------
// I/O error tests
// ---------------------------------------------------------------------------

Deno.test("loadWorkspaceConfig — file not found returns diagnostic", async () => {
  const result = await loadWorkspaceConfig("/no-such-dir", {
    readFile: makeReader({}),
  });
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.diagnostics[0].path, "");
    assertEquals(
      result.diagnostics[0].message.includes("Failed to read"),
      true,
    );
  }
});

// ---------------------------------------------------------------------------
// Parse error tests
// ---------------------------------------------------------------------------

Deno.test("loadWorkspaceConfig — malformed JSON returns parse diagnostic", async () => {
  const result = await loadWorkspaceConfig("/workspace", {
    readFile: makeReader({ "/workspace/deno.json": "{ bad json" }),
  });
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.diagnostics[0].path, "");
    assertEquals(
      result.diagnostics[0].message.includes("Failed to parse"),
      true,
    );
  }
});

// ---------------------------------------------------------------------------
// Structural validation tests
// ---------------------------------------------------------------------------

Deno.test("loadWorkspaceConfig — root is not a plain object", async () => {
  const result = await loadWorkspaceConfig("/workspace", {
    readFile: makeReader({ "/workspace/deno.json": '"just a string"' }),
  });
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.diagnostics[0].path, "");
    assertEquals(
      result.diagnostics[0].message.includes("plain object"),
      true,
    );
  }
});

Deno.test("loadWorkspaceConfig — root is an array", async () => {
  const result = await loadWorkspaceConfig("/workspace", {
    readFile: makeReader({ "/workspace/deno.json": "[]" }),
  });
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.diagnostics[0].path, "");
  }
});

Deno.test('loadWorkspaceConfig — missing "workspace" field', async () => {
  const result = await loadWorkspaceConfig("/workspace", {
    readFile: makeReader({
      "/workspace/deno.json": JSON.stringify({ name: "@scope/pkg" }),
    }),
  });
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.diagnostics[0].path, "workspace");
    assertEquals(
      result.diagnostics[0].message.includes('"workspace"'),
      true,
    );
  }
});

Deno.test('loadWorkspaceConfig — "workspace" is not an array', async () => {
  const result = await loadWorkspaceConfig("/workspace", {
    readFile: makeReader({
      "/workspace/deno.json": JSON.stringify({ workspace: "packages/core" }),
    }),
  });
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.diagnostics[0].path, "workspace");
    assertEquals(result.diagnostics[0].message.includes("array"), true);
  }
});

Deno.test('loadWorkspaceConfig — "workspace" contains a non-string entry', async () => {
  const result = await loadWorkspaceConfig("/workspace", {
    readFile: makeReader({
      "/workspace/deno.json": JSON.stringify({ workspace: ["packages/core", 42] }),
    }),
  });
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.diagnostics.some((d) => d.path === "workspace[1]"), true);
  }
});

Deno.test('loadWorkspaceConfig — "workspace" with multiple non-string entries emits one diagnostic per entry', async () => {
  const result = await loadWorkspaceConfig("/workspace", {
    readFile: makeReader({
      "/workspace/deno.json": JSON.stringify({ workspace: [1, null, "valid"] }),
    }),
  });
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.diagnostics.length, 2);
    assertEquals(result.diagnostics.some((d) => d.path === "workspace[0]"), true);
    assertEquals(result.diagnostics.some((d) => d.path === "workspace[1]"), true);
  }
});

// ---------------------------------------------------------------------------
// Normalization tests
// ---------------------------------------------------------------------------

Deno.test("loadWorkspaceConfig — normalized config has correct members", async () => {
  const members = ["packages/core", "packages/cli", "packages/plugin-sdk", "apps/remote-cache"];
  const result = await loadWorkspaceConfig("/workspace", {
    readFile: makeReader({
      "/workspace/deno.json": JSON.stringify({ workspace: members }),
    }),
  });
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals([...result.config.members], members);
  }
});
