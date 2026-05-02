import { assertEquals } from "jsr:@std/assert@^1";
import type {
  ProjectDependencyEdge,
  ProjectGraph,
  ProjectNode,
  ProjectNodeId,
} from "./graph.ts";

Deno.test("graph domain: ProjectNode type is assignable", () => {
  const node: ProjectNode = {
    id: "@denorepo/core",
    root: "packages/core",
    tags: ["scope:core", "type:library"],
  };

  assertEquals(node.id, "@denorepo/core");
  assertEquals(node.root, "packages/core");
  assertEquals(node.tags, ["scope:core", "type:library"]);
});

Deno.test("graph domain: ProjectDependencyEdge type is assignable", () => {
  const edge: ProjectDependencyEdge = {
    source: "@denorepo/cli",
    target: "@denorepo/core",
  };

  assertEquals(edge.source, "@denorepo/cli");
  assertEquals(edge.target, "@denorepo/core");
});

Deno.test("graph domain: ProjectGraph type is assignable", () => {
  const coreId: ProjectNodeId = "@denorepo/core";
  const cliId: ProjectNodeId = "@denorepo/cli";

  const graph: ProjectGraph = {
    nodes: [
      { id: coreId, root: "packages/core" },
      { id: cliId, root: "packages/cli" },
    ],
    edges: [
      { source: cliId, target: coreId },
    ],
  };

  assertEquals(graph.nodes.length, 2);
  assertEquals(graph.edges.length, 1);
  assertEquals(graph.edges[0], { source: "@denorepo/cli", target: "@denorepo/core" });
});
