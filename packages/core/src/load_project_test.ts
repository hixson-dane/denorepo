import { assertEquals } from "jsr:@std/assert@^1";
import { loadProjectConfigs } from "./load_project.ts";

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

Deno.test("loadProjectConfigs — loads a single valid member", async () => {
  const results = await loadProjectConfigs("/workspace", ["packages/core"], {
    readFile: makeReader({
      "/workspace/packages/core/deno.json": JSON.stringify({
        name: "@denorepo/core",
        version: "0.0.0",
      }),
    }),
  });
  assertEquals(results.length, 1);
  assertEquals(results[0].ok, true);
  if (results[0].ok) {
    assertEquals(results[0].member, "packages/core");
    assertEquals(results[0].config.name, "@denorepo/core");
    assertEquals(results[0].config.root, "packages/core");
    assertEquals(results[0].config.version, "0.0.0");
  }
});

Deno.test("loadProjectConfigs — loads multiple members", async () => {
  const results = await loadProjectConfigs(
    "/workspace",
    ["packages/core", "packages/cli"],
    {
      readFile: makeReader({
        "/workspace/packages/core/deno.json": JSON.stringify({
          name: "@denorepo/core",
        }),
        "/workspace/packages/cli/deno.json": JSON.stringify({
          name: "@denorepo/cli",
        }),
      }),
    },
  );
  assertEquals(results.length, 2);
  assertEquals(results[0].ok, true);
  assertEquals(results[1].ok, true);
  if (results[0].ok) assertEquals(results[0].config.name, "@denorepo/core");
  if (results[1].ok) assertEquals(results[1].config.name, "@denorepo/cli");
});

Deno.test("loadProjectConfigs — empty members array returns empty results", async () => {
  const results = await loadProjectConfigs("/workspace", [], {
    readFile: makeReader({}),
  });
  assertEquals(results.length, 0);
});

Deno.test("loadProjectConfigs — strips trailing slash from root path", async () => {
  const results = await loadProjectConfigs("/workspace/", ["packages/core"], {
    readFile: makeReader({
      "/workspace/packages/core/deno.json": JSON.stringify({
        name: "@denorepo/core",
      }),
    }),
  });
  assertEquals(results[0].ok, true);
  if (results[0].ok) {
    assertEquals(results[0].config.root, "packages/core");
  }
});

Deno.test("loadProjectConfigs — accepts URL as workspaceRoot", async () => {
  const results = await loadProjectConfigs(
    new URL("file:///workspace"),
    ["packages/core"],
    {
      readFile: makeReader({
        "/workspace/packages/core/deno.json": JSON.stringify({
          name: "@denorepo/core",
        }),
      }),
    },
  );
  assertEquals(results[0].ok, true);
  if (results[0].ok) {
    assertEquals(results[0].config.name, "@denorepo/core");
  }
});

Deno.test("loadProjectConfigs — parses JSONC with comments", async () => {
  const jsoncContent = `{
    // Core library
    "name": "@denorepo/core",
    "version": "0.0.0" // current version
  }`;
  const results = await loadProjectConfigs("/workspace", ["packages/core"], {
    readFile: makeReader({
      "/workspace/packages/core/deno.json": jsoncContent,
    }),
  });
  assertEquals(results[0].ok, true);
  if (results[0].ok) {
    assertEquals(results[0].config.name, "@denorepo/core");
  }
});

Deno.test("loadProjectConfigs — normalizes optional fields", async () => {
  const results = await loadProjectConfigs("/workspace", ["packages/core"], {
    readFile: makeReader({
      "/workspace/packages/core/deno.json": JSON.stringify({
        name: "@denorepo/core",
        version: "1.2.3",
        tags: ["scope:core", "type:library"],
        implicitDependencies: ["@denorepo/plugin-sdk"],
        explicitDependencies: ["@denorepo/cli"],
      }),
    }),
  });
  assertEquals(results[0].ok, true);
  if (results[0].ok) {
    const cfg = results[0].config;
    assertEquals(cfg.name, "@denorepo/core");
    assertEquals(cfg.root, "packages/core");
    assertEquals(cfg.version, "1.2.3");
    assertEquals([...cfg.tags!], ["scope:core", "type:library"]);
    assertEquals([...cfg.implicitDependencies!], ["@denorepo/plugin-sdk"]);
    assertEquals([...cfg.explicitDependencies!], ["@denorepo/cli"]);
  }
});

Deno.test("loadProjectConfigs — extra deno.json fields (exports, tasks) are not included in config", async () => {
  const results = await loadProjectConfigs("/workspace", ["packages/core"], {
    readFile: makeReader({
      "/workspace/packages/core/deno.json": JSON.stringify({
        name: "@denorepo/core",
        exports: { ".": "./mod.ts" },
        tasks: { test: "deno test src/" },
      }),
    }),
  });
  assertEquals(results[0].ok, true);
  if (results[0].ok) {
    const cfg = results[0].config as Record<string, unknown>;
    assertEquals("exports" in cfg, false);
    assertEquals("tasks" in cfg, false);
  }
});

Deno.test("loadProjectConfigs — root field is always derived from member path, not deno.json", async () => {
  const results = await loadProjectConfigs("/workspace", ["packages/core"], {
    readFile: makeReader({
      "/workspace/packages/core/deno.json": JSON.stringify({
        name: "@denorepo/core",
        // deliberately omit root — it must be injected
      }),
    }),
  });
  assertEquals(results[0].ok, true);
  if (results[0].ok) {
    assertEquals(results[0].config.root, "packages/core");
  }
});

// ---------------------------------------------------------------------------
// I/O error tests
// ---------------------------------------------------------------------------

Deno.test("loadProjectConfigs — missing file returns per-member diagnostic", async () => {
  const results = await loadProjectConfigs("/workspace", ["packages/missing"], {
    readFile: makeReader({}),
  });
  assertEquals(results[0].ok, false);
  if (!results[0].ok) {
    assertEquals(results[0].member, "packages/missing");
    assertEquals(results[0].diagnostics[0].path, "");
    assertEquals(
      results[0].diagnostics[0].message.includes("Failed to read"),
      true,
    );
  }
});

Deno.test("loadProjectConfigs — partial failure does not block other members", async () => {
  const results = await loadProjectConfigs(
    "/workspace",
    ["packages/core", "packages/missing", "packages/cli"],
    {
      readFile: makeReader({
        "/workspace/packages/core/deno.json": JSON.stringify({
          name: "@denorepo/core",
        }),
        "/workspace/packages/cli/deno.json": JSON.stringify({
          name: "@denorepo/cli",
        }),
        // packages/missing is intentionally absent
      }),
    },
  );
  assertEquals(results.length, 3);
  assertEquals(results[0].ok, true);
  assertEquals(results[1].ok, false);
  assertEquals(results[2].ok, true);
  assertEquals(results[1].member, "packages/missing");
});

// ---------------------------------------------------------------------------
// Parse error tests
// ---------------------------------------------------------------------------

Deno.test("loadProjectConfigs — malformed JSON returns parse diagnostic", async () => {
  const results = await loadProjectConfigs("/workspace", ["packages/core"], {
    readFile: makeReader({
      "/workspace/packages/core/deno.json": "{ bad json",
    }),
  });
  assertEquals(results[0].ok, false);
  if (!results[0].ok) {
    assertEquals(results[0].diagnostics[0].path, "");
    assertEquals(
      results[0].diagnostics[0].message.includes("Failed to parse"),
      true,
    );
  }
});

// ---------------------------------------------------------------------------
// Structural validation tests
// ---------------------------------------------------------------------------

Deno.test("loadProjectConfigs — root value is not a plain object", async () => {
  const results = await loadProjectConfigs("/workspace", ["packages/core"], {
    readFile: makeReader({
      "/workspace/packages/core/deno.json": '"just a string"',
    }),
  });
  assertEquals(results[0].ok, false);
  if (!results[0].ok) {
    assertEquals(results[0].diagnostics[0].path, "");
    assertEquals(
      results[0].diagnostics[0].message.includes("plain object"),
      true,
    );
  }
});

Deno.test("loadProjectConfigs — root value is an array", async () => {
  const results = await loadProjectConfigs("/workspace", ["packages/core"], {
    readFile: makeReader({
      "/workspace/packages/core/deno.json": "[]",
    }),
  });
  assertEquals(results[0].ok, false);
  if (!results[0].ok) {
    assertEquals(results[0].diagnostics[0].path, "");
  }
});

Deno.test('loadProjectConfigs — missing "name" field returns diagnostic', async () => {
  const results = await loadProjectConfigs("/workspace", ["packages/core"], {
    readFile: makeReader({
      "/workspace/packages/core/deno.json": JSON.stringify({
        version: "0.0.0",
      }),
    }),
  });
  assertEquals(results[0].ok, false);
  if (!results[0].ok) {
    assertEquals(results[0].member, "packages/core");
    assertEquals(
      results[0].diagnostics.some((d) => d.path === "name"),
      true,
    );
  }
});

Deno.test('loadProjectConfigs — non-string "name" field returns diagnostic', async () => {
  const results = await loadProjectConfigs("/workspace", ["packages/core"], {
    readFile: makeReader({
      "/workspace/packages/core/deno.json": JSON.stringify({ name: 42 }),
    }),
  });
  assertEquals(results[0].ok, false);
  if (!results[0].ok) {
    assertEquals(
      results[0].diagnostics.some((d) => d.path === "name"),
      true,
    );
  }
});

Deno.test('loadProjectConfigs — invalid "version" field returns diagnostic', async () => {
  const results = await loadProjectConfigs("/workspace", ["packages/core"], {
    readFile: makeReader({
      "/workspace/packages/core/deno.json": JSON.stringify({
        name: "@denorepo/core",
        version: 123,
      }),
    }),
  });
  assertEquals(results[0].ok, false);
  if (!results[0].ok) {
    assertEquals(
      results[0].diagnostics.some((d) => d.path === "version"),
      true,
    );
  }
});

Deno.test('loadProjectConfigs — invalid "tags" field returns diagnostic', async () => {
  const results = await loadProjectConfigs("/workspace", ["packages/core"], {
    readFile: makeReader({
      "/workspace/packages/core/deno.json": JSON.stringify({
        name: "@denorepo/core",
        tags: "not-an-array",
      }),
    }),
  });
  assertEquals(results[0].ok, false);
  if (!results[0].ok) {
    assertEquals(
      results[0].diagnostics.some((d) => d.path === "tags"),
      true,
    );
  }
});

// ---------------------------------------------------------------------------
// Normalization: member path ordering preserved
// ---------------------------------------------------------------------------

Deno.test("loadProjectConfigs — results are in the same order as members", async () => {
  const members = ["packages/core", "packages/cli", "apps/remote-cache"];
  const files: Record<string, string> = {};
  for (const m of members) {
    files[`/workspace/${m}/deno.json`] = JSON.stringify({
      name: `@denorepo/${m.split("/").at(-1) ?? m}`,
    });
  }
  const results = await loadProjectConfigs("/workspace", members, {
    readFile: makeReader(files),
  });
  assertEquals(results.length, 3);
  for (let i = 0; i < members.length; i++) {
    assertEquals(results[i].member, members[i]);
  }
});

// ---------------------------------------------------------------------------
// Diagnostic code and file field tests
// ---------------------------------------------------------------------------

Deno.test("loadProjectConfigs — I/O diagnostic has READ_ERROR code and file path", async () => {
  const results = await loadProjectConfigs("/workspace", ["packages/missing"], {
    readFile: makeReader({}),
  });
  assertEquals(results[0].ok, false);
  if (!results[0].ok) {
    assertEquals(results[0].diagnostics[0].code, "CONFIG_READ_ERROR");
    assertEquals(
      results[0].diagnostics[0].file,
      "/workspace/packages/missing/deno.json",
    );
  }
});

Deno.test("loadProjectConfigs — parse error diagnostic has PARSE_ERROR code and file path", async () => {
  const results = await loadProjectConfigs("/workspace", ["packages/core"], {
    readFile: makeReader({
      "/workspace/packages/core/deno.json": "{ bad json",
    }),
  });
  assertEquals(results[0].ok, false);
  if (!results[0].ok) {
    assertEquals(results[0].diagnostics[0].code, "CONFIG_PARSE_ERROR");
    assertEquals(
      results[0].diagnostics[0].file,
      "/workspace/packages/core/deno.json",
    );
  }
});

Deno.test('loadProjectConfigs — missing "name" diagnostic has MISSING_FIELD code', async () => {
  const results = await loadProjectConfigs("/workspace", ["packages/core"], {
    readFile: makeReader({
      "/workspace/packages/core/deno.json": JSON.stringify({ version: "0.0.0" }),
    }),
  });
  assertEquals(results[0].ok, false);
  if (!results[0].ok) {
    const nameDiag = results[0].diagnostics.find((d) => d.path === "name");
    assertEquals(nameDiag !== undefined, true);
    assertEquals(nameDiag!.code, "CONFIG_MISSING_FIELD");
    assertEquals(nameDiag!.file, "/workspace/packages/core/deno.json");
  }
});

Deno.test('loadProjectConfigs — invalid type diagnostic has INVALID_TYPE code', async () => {
  const results = await loadProjectConfigs("/workspace", ["packages/core"], {
    readFile: makeReader({
      "/workspace/packages/core/deno.json": JSON.stringify({ name: 42 }),
    }),
  });
  assertEquals(results[0].ok, false);
  if (!results[0].ok) {
    const nameDiag = results[0].diagnostics.find((d) => d.path === "name");
    assertEquals(nameDiag !== undefined, true);
    assertEquals(nameDiag!.code, "CONFIG_INVALID_TYPE");
    assertEquals(nameDiag!.file, "/workspace/packages/core/deno.json");
  }
});

Deno.test("loadProjectConfigs — plain object diagnostic has INVALID_TYPE code and file path", async () => {
  const results = await loadProjectConfigs("/workspace", ["packages/core"], {
    readFile: makeReader({
      "/workspace/packages/core/deno.json": '"just a string"',
    }),
  });
  assertEquals(results[0].ok, false);
  if (!results[0].ok) {
    assertEquals(results[0].diagnostics[0].code, "CONFIG_INVALID_TYPE");
    assertEquals(
      results[0].diagnostics[0].file,
      "/workspace/packages/core/deno.json",
    );
  }
});
