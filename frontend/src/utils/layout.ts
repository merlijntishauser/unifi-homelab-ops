import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";

const NODE_WIDTH = 220;
const NODE_HEIGHT = 100;
const HANDLE_SLOTS = 5; // must match HANDLE_PCTS in ZoneNode

/**
 * Pick a handle index (0..HANDLE_SLOTS-1) for each edge so that edges
 * fan out across the node instead of overlapping on one anchor point.
 *
 * Outgoing edges from a node are sorted by target-x and spread across
 * source-0 .. source-4. Incoming edges are sorted by source-x and
 * spread across target-0 .. target-4.
 */
function assignHandles(
  edges: Edge[],
  posMap: Map<string, { x: number; y: number }>,
): Edge[] {
  // Group edges by node: outgoing (source) and incoming (target)
  const outgoing = new Map<string, Edge[]>();
  const incoming = new Map<string, Edge[]>();

  for (const edge of edges) {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    outgoing.get(edge.source)!.push(edge);
    if (!incoming.has(edge.target)) incoming.set(edge.target, []);
    incoming.get(edge.target)!.push(edge);
  }

  const sourceHandles = new Map<string, string>();
  const targetHandles = new Map<string, string>();

  // Assign source handles: sort outgoing by target x, spread evenly
  for (const [, nodeEdges] of outgoing) {
    const sorted = [...nodeEdges].sort(
      (a, b) => posMap.get(a.target)!.x - posMap.get(b.target)!.x,
    );
    const n = sorted.length;
    for (let i = 0; i < n; i++) {
      const slot =
        n === 1
          ? Math.floor(HANDLE_SLOTS / 2)
          : Math.round((i * (HANDLE_SLOTS - 1)) / (n - 1));
      sourceHandles.set(sorted[i].id, `source-${slot}`);
    }
  }

  // Assign target handles: sort incoming by source x, spread evenly
  for (const [, nodeEdges] of incoming) {
    const sorted = [...nodeEdges].sort(
      (a, b) => posMap.get(a.source)!.x - posMap.get(b.source)!.x,
    );
    const n = sorted.length;
    for (let i = 0; i < n; i++) {
      const slot =
        n === 1
          ? Math.floor(HANDLE_SLOTS / 2)
          : Math.round((i * (HANDLE_SLOTS - 1)) / (n - 1));
      targetHandles.set(sorted[i].id, `target-${slot}`);
    }
  }

  return edges.map((edge) => ({
    ...edge,
    sourceHandle: sourceHandles.get(edge.id)!,
    targetHandle: targetHandles.get(edge.id)!,
  }));
}

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph({ multigraph: true }).setDefaultEdgeLabel(
    () => ({}),
  );
  g.setGraph({ rankdir: "TB", ranksep: 300, nodesep: 100 });

  nodes.forEach((node) =>
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }),
  );
  edges.forEach((edge) => g.setEdge(edge.source, edge.target, {}, edge.id));
  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    };
  });

  const posMap = new Map(layoutedNodes.map((n) => [n.id, n.position]));
  const layoutedEdges = assignHandles(edges, posMap);

  return { nodes: layoutedNodes, edges: layoutedEdges };
}
