import { assertEquals } from "jsr:@std/assert@^1";
import { buildProjectGraph } from "./graph_builder.ts";

Deno.test("buildProjectGraph — models explicit and implicit dependency edges from project config", () => {
  const graph = buildProjectGraph([
    {
      name: "@denorepo/app",
      root: "apps/app",
      explicitDependencies: ["@denorepo/core"],
      implicitDependencies: ["@denorepo/plugin-sdk"],
    },
    {
      name: "@denorepo/core",
      root: "packages/core",
    },
    {
      name: "@denorepo/plugin-sdk",
      root: "packages/plugin-sdk",
    },
  ]);

  assertEquals(graph.nodes.map((n) => n.id), [
    "@denorepo/app",
    "@denorepo/core",
    "@denorepo/plugin-sdk",
  ]);
  assertEquals(graph.edges, [
    {
      source: "@denorepo/app",
      target: "@denorepo/core",
      type: "explicit",
    },
    {
      source: "@denorepo/app",
      target: "@denorepo/plugin-sdk",
      type: "implicit",
    },
  ]);
});

Deno.test("buildProjectGraph — consumes workspace dependencyEdges and de-duplicates", () => {
  const graph = buildProjectGraph(
    [
      {
        name: "@denorepo/app",
        root: "apps/app",
        explicitDependencies: ["@denorepo/core"],
      },
      {
        name: "@denorepo/core",
        root: "packages/core",
      },
    ],
    {
      dependencyEdges: [
        { source: "@denorepo/app", target: "@denorepo/core" },
        { source: "@denorepo/app", target: "@denorepo/core" },
      ],
    },
  );

  assertEquals(graph.edges, [
    {
      source: "@denorepo/app",
      target: "@denorepo/core",
      type: "explicit",
    },
  ]);
});

Deno.test("buildProjectGraph — de-duplication handles names containing null characters", () => {
  const graph = buildProjectGraph(
    [
      {
        name: "a\u0000b",
        root: "packages/a",
        explicitDependencies: ["c"],
      },
      {
        name: "a",
        root: "packages/a2",
        explicitDependencies: ["b\u0000c"],
      },
      { name: "c", root: "packages/c" },
      { name: "b\u0000c", root: "packages/bc" },
    ],
    {
      dependencyEdges: [
        { source: "a\u0000b", target: "c" },
        { source: "a", target: "b\u0000c" },
      ],
    },
  );

  assertEquals(graph.edges, [
    { source: "a", target: "b\u0000c", type: "explicit" },
    { source: "a\u0000b", target: "c", type: "explicit" },
  ]);
});
