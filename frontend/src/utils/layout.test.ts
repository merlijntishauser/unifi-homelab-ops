import { describe, it, expect, vi } from "vitest";
import type { Node, Edge } from "@xyflow/react";

// Mock dagre since its ESM interop doesn't work cleanly in vitest jsdom
vi.mock("@dagrejs/dagre", () => {
  class Graph {
    private nodes: Map<string, Record<string, number>> = new Map();
    private edges: Array<{ source: string; target: string }> = [];
    private graphConfig: Record<string, unknown> = {};
    private counter = 0;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(opts?: Record<string, unknown>) {}

    setDefaultEdgeLabel(fn: () => Record<string, unknown>) {
      fn(); // exercise the callback
      return this;
    }

    setGraph(config: Record<string, unknown>) {
      this.graphConfig = config;
    }

    setNode(id: string, dims: { width: number; height: number }) {
      this.nodes.set(id, { width: dims.width, height: dims.height, x: 0, y: 0 });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setEdge(source: string, target: string, label?: Record<string, unknown>, name?: string) {
      this.edges.push({ source, target });
    }

    node(id: string) {
      return this.nodes.get(id)!;
    }

    layoutNodes() {
      // Simple top-to-bottom layout: position nodes based on topological order
      const rank = new Map<string, number>();

      // Assign ranks based on edges (simple BFS from sources)
      for (const [id] of this.nodes) {
        if (!rank.has(id)) rank.set(id, 0);
      }
      for (const edge of this.edges) {
        const srcRank = rank.get(edge.source) ?? 0;
        rank.set(edge.target, Math.max(rank.get(edge.target) ?? 0, srcRank + 1));
      }

      // Sort by rank and assign positions
      const sorted = [...this.nodes.keys()].sort(
        (a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0),
      );

      // Group by rank and spread horizontally
      const rankGroups = new Map<number, string[]>();
      for (const id of sorted) {
        const r = rank.get(id) ?? 0;
        if (!rankGroups.has(r)) rankGroups.set(r, []);
        rankGroups.get(r)!.push(id);
      }

      for (const [r, ids] of rankGroups) {
        for (let i = 0; i < ids.length; i++) {
          const nodeData = this.nodes.get(ids[i])!;
          nodeData.x = i * 320 + nodeData.width / 2;
          nodeData.y = r * 220 + nodeData.height / 2;
        }
      }
    }
  }

  const mod = {
    graphlib: { Graph },
    layout: (g: Graph) => {
      (g as unknown as { layoutNodes: () => void }).layoutNodes();
    },
  };
  return { default: mod, ...mod };
});

import { getLayoutedElements } from "./layout";

describe("getLayoutedElements", () => {
  it("returns positioned nodes and edges with handles", () => {
    const nodes: Node[] = [
      { id: "a", position: { x: 0, y: 0 }, data: {} },
      { id: "b", position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [{ id: "e1", source: "a", target: "b" }];

    const result = getLayoutedElements(nodes, edges);

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);

    for (const node of result.nodes) {
      expect(node.position).toBeDefined();
      expect(typeof node.position.x).toBe("number");
      expect(typeof node.position.y).toBe("number");
    }
  });

  it("positions nodes differently when there are edges between them", () => {
    const nodes: Node[] = [
      { id: "a", position: { x: 0, y: 0 }, data: {} },
      { id: "b", position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [{ id: "e1", source: "a", target: "b" }];

    const result = getLayoutedElements(nodes, edges);

    const nodeA = result.nodes.find((n) => n.id === "a")!;
    const nodeB = result.nodes.find((n) => n.id === "b")!;

    // With TB layout, nodeA should be above nodeB (smaller y)
    expect(nodeA.position.y).toBeLessThan(nodeB.position.y);
  });

  it("handles empty inputs", () => {
    const result = getLayoutedElements([], []);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it("handles nodes with no edges", () => {
    const nodes: Node[] = [
      { id: "a", position: { x: 0, y: 0 }, data: {} },
      { id: "b", position: { x: 0, y: 0 }, data: {} },
    ];

    const result = getLayoutedElements(nodes, []);
    expect(result.nodes).toHaveLength(2);
    for (const node of result.nodes) {
      expect(node.position).toBeDefined();
    }
  });

  it("preserves extra node data after layout", () => {
    const nodes: Node[] = [
      { id: "a", position: { x: 0, y: 0 }, data: { label: "Zone A" }, type: "zone" },
    ];
    const edges: Edge[] = [];

    const result = getLayoutedElements(nodes, edges);
    expect(result.nodes[0].data).toEqual({ label: "Zone A" });
    expect(result.nodes[0].type).toBe("zone");
    expect(result.nodes[0].id).toBe("a");
  });

  it("spreads target handles when a node has multiple incoming edges", () => {
    // a and b are at the same rank (both sources), c is target of both
    // a at x~0, b at x~320 → c gets two incoming edges from different sides
    const nodes: Node[] = [
      { id: "a", position: { x: 0, y: 0 }, data: {} },
      { id: "b", position: { x: 0, y: 0 }, data: {} },
      { id: "c", position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "a", target: "c" },
      { id: "e2", source: "b", target: "c" },
    ];

    const result = getLayoutedElements(nodes, edges);
    const e1 = result.edges.find((e) => e.id === "e1")!;
    const e2 = result.edges.find((e) => e.id === "e2")!;

    // Two incoming edges to c should use different target handles
    expect(e1.targetHandle).not.toBe(e2.targetHandle);
  });

  it("spreads source handles when a node has multiple outgoing edges", () => {
    // a connects to both b and c; b and c at same rank with different x
    const nodes: Node[] = [
      { id: "a", position: { x: 0, y: 0 }, data: {} },
      { id: "b", position: { x: 0, y: 0 }, data: {} },
      { id: "c", position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "a", target: "b" },
      { id: "e2", source: "a", target: "c" },
    ];

    const result = getLayoutedElements(nodes, edges);
    const e1 = result.edges.find((e) => e.id === "e1")!;
    const e2 = result.edges.find((e) => e.id === "e2")!;

    // Two outgoing edges from a should use different source handles
    expect(e1.sourceHandle).not.toBe(e2.sourceHandle);
  });

  it("assigns center handle when node has a single connection", () => {
    const nodes: Node[] = [
      { id: "a", position: { x: 0, y: 0 }, data: {} },
      { id: "b", position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [{ id: "e1", source: "a", target: "b" }];

    const result = getLayoutedElements(nodes, edges);
    const e1 = result.edges.find((e) => e.id === "e1")!;

    // Single edge → center slot (index 2 of 5)
    expect(e1.sourceHandle).toBe("source-2");
    expect(e1.targetHandle).toBe("target-2");
  });

  it("handles a three-node chain", () => {
    const nodes: Node[] = [
      { id: "a", position: { x: 0, y: 0 }, data: {} },
      { id: "b", position: { x: 0, y: 0 }, data: {} },
      { id: "c", position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "a", target: "b" },
      { id: "e2", source: "b", target: "c" },
    ];

    const result = getLayoutedElements(nodes, edges);
    const [a, b, c] = ["a", "b", "c"].map((id) => result.nodes.find((n) => n.id === id)!);

    expect(a.position.y).toBeLessThan(b.position.y);
    expect(b.position.y).toBeLessThan(c.position.y);
  });
});
