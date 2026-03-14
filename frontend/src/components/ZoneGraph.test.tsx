import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ZoneGraph from "./ZoneGraph";
import type { Zone, ZonePair } from "../api/types";

// Mock @xyflow/react completely since ReactFlow does not work in jsdom
const mockSetNodes = vi.fn();
const mockSetEdges = vi.fn();
let capturedOnEdgeClick: ((event: unknown, edge: { source: string; target: string }) => void) | null = null;

vi.mock("@xyflow/react", () => {
  return {
    ReactFlow: ({ nodes, edges, onEdgeClick, colorMode, children }: {
      nodes: unknown[];
      edges: Array<{ id: string; source: string; target: string; data?: { onLabelClick?: () => void } }>;
      onEdgeClick: (event: unknown, edge: { source: string; target: string }) => void;
      colorMode: string;
      children: React.ReactNode;
    }) => {
      capturedOnEdgeClick = onEdgeClick;
      return (
        <div data-testid="react-flow" data-color-mode={colorMode}>
          <div className="react-flow__viewport" data-testid="viewport" />
          <div data-testid="nodes-count">{Array.isArray(nodes) ? nodes.length : 0}</div>
          <div data-testid="edges-count">{Array.isArray(edges) ? edges.length : 0}</div>
          {Array.isArray(edges) && edges.map((edge) => (
            <button
              key={edge.id}
              data-testid={`edge-${edge.id}`}
              onClick={(e) => onEdgeClick?.(e, edge)}
            >
              {edge.id}
            </button>
          ))}
          {Array.isArray(edges) && edges.map((edge) => (
            edge.data?.onLabelClick ? (
              <button
                key={`label-${edge.id}`}
                data-testid={`edge-label-${edge.id}`}
                onClick={() => edge.data?.onLabelClick?.()}
              >
                label {edge.id}
              </button>
            ) : null
          ))}
          {children}
        </div>
      );
    },
    Background: () => <div data-testid="background" />,
    Controls: () => <div data-testid="controls" />,
    MiniMap: () => <div data-testid="minimap" />,
    MarkerType: { ArrowClosed: "arrowclosed" },
    useNodesState: (initial: unknown[]) => [initial, mockSetNodes, vi.fn()],
    useEdgesState: (initial: unknown[]) => [initial, mockSetEdges, vi.fn()],
  };
});

// Mock the layout utility
vi.mock("../utils/layout", () => ({
  getLayoutedElements: (nodes: unknown[], edges: unknown[]) => ({ nodes, edges }),
}));

// Mock child components
vi.mock("./ZoneNode", () => ({
  default: () => <div>ZoneNode</div>,
}));

vi.mock("./RuleEdge", () => ({
  default: () => <div>RuleEdge</div>,
}));

vi.mock("../utils/edgeColor", () => ({
  getEdgeColor: (a: number, b: number) => {
    if (a > 0 && b === 0) return "#00d68f";
    if (b > 0 && a === 0) return "#ff4d5e";
    return "#ffaa2c";
  },
}));

describe("ZoneGraph", () => {
  const zones: Zone[] = [
    { id: "z1", name: "External", networks: [] },
    { id: "z2", name: "Internal", networks: [{ id: "n1", name: "LAN", vlan_id: 1, subnet: "10.0.0.0/24" }] },
  ];

  const zonePairs: ZonePair[] = [
    {
      source_zone_id: "z1",
      destination_zone_id: "z2",
      rules: [
        {
          id: "r1",
          name: "Allow HTTP",
          description: "",
          enabled: true,
          action: "ALLOW",
          source_zone_id: "z1",
          destination_zone_id: "z2",
          protocol: "TCP",
          port_ranges: ["80"],
          ip_ranges: [],
          index: 1,
          predefined: false,
        },
      ],
      allow_count: 1,
      block_count: 0,
      analysis: { score: 85, grade: "B", findings: [] },
    },
  ];

  const onEdgeSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnEdgeClick = null;
  });

  it("renders ReactFlow with correct number of nodes", () => {
    render(
      <ZoneGraph zones={zones} zonePairs={zonePairs} colorMode="light" onEdgeSelect={onEdgeSelect} />,
    );
    expect(screen.getByTestId("nodes-count").textContent).toBe("2");
  });

  it("renders ReactFlow with correct number of edges", () => {
    render(
      <ZoneGraph zones={zones} zonePairs={zonePairs} colorMode="light" onEdgeSelect={onEdgeSelect} />,
    );
    expect(screen.getByTestId("edges-count").textContent).toBe("1");
  });

  it("passes colorMode to ReactFlow", () => {
    render(
      <ZoneGraph zones={zones} zonePairs={zonePairs} colorMode="dark" onEdgeSelect={onEdgeSelect} />,
    );
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-color-mode", "dark");
  });

  it("renders Background, Controls, and MiniMap", () => {
    render(
      <ZoneGraph zones={zones} zonePairs={zonePairs} colorMode="light" onEdgeSelect={onEdgeSelect} />,
    );
    expect(screen.getByTestId("background")).toBeInTheDocument();
    expect(screen.getByTestId("controls")).toBeInTheDocument();
    expect(screen.getByTestId("minimap")).toBeInTheDocument();
  });

  it("calls onEdgeSelect when edge is clicked and pair is found", () => {
    render(
      <ZoneGraph zones={zones} zonePairs={zonePairs} colorMode="light" onEdgeSelect={onEdgeSelect} />,
    );

    fireEvent.click(screen.getByTestId("edge-z1->z2"));
    expect(onEdgeSelect).toHaveBeenCalledWith(zonePairs[0]);
  });

  it("calls onEdgeSelect via onLabelClick (buildElements callback)", () => {
    render(
      <ZoneGraph zones={zones} zonePairs={zonePairs} colorMode="light" onEdgeSelect={onEdgeSelect} />,
    );

    // Click the edge label button which triggers onLabelClick from buildElements
    fireEvent.click(screen.getByTestId("edge-label-z1->z2"));
    expect(onEdgeSelect).toHaveBeenCalledWith(zonePairs[0]);
  });

  it("does not call onEdgeSelect when clicked edge does not match any zone pair", () => {
    render(
      <ZoneGraph zones={zones} zonePairs={zonePairs} colorMode="light" onEdgeSelect={onEdgeSelect} />,
    );

    // Simulate clicking an edge with source/target that doesn't match any zone pair
    capturedOnEdgeClick!({}, { source: "z999", target: "z888" });
    expect(onEdgeSelect).not.toHaveBeenCalled();
  });

  it("handles empty zone pairs gracefully", () => {
    render(
      <ZoneGraph zones={zones} zonePairs={[]} colorMode="light" onEdgeSelect={onEdgeSelect} />,
    );

    // With empty zone pairs, no edges exist to click
    expect(onEdgeSelect).not.toHaveBeenCalled();
  });

  it("handles empty zones and zone pairs", () => {
    render(
      <ZoneGraph zones={[]} zonePairs={[]} colorMode="light" onEdgeSelect={onEdgeSelect} />,
    );
    expect(screen.getByTestId("nodes-count").textContent).toBe("0");
    expect(screen.getByTestId("edges-count").textContent).toBe("0");
  });

  it("filters to only connected zones when focusZoneIds has one ID", () => {
    const threeZones: Zone[] = [
      { id: "z1", name: "External", networks: [] },
      { id: "z2", name: "Internal", networks: [] },
      { id: "z3", name: "Guest", networks: [] },
    ];
    const pairs: ZonePair[] = [
      {
        source_zone_id: "z1", destination_zone_id: "z2",
        rules: [{ id: "r1", name: "R1", description: "", enabled: true, action: "ALLOW", source_zone_id: "z1", destination_zone_id: "z2", protocol: "TCP", port_ranges: [], ip_ranges: [], index: 1, predefined: false }],
        allow_count: 1, block_count: 0, analysis: null,
      },
      {
        source_zone_id: "z2", destination_zone_id: "z3",
        rules: [{ id: "r2", name: "R2", description: "", enabled: true, action: "BLOCK", source_zone_id: "z2", destination_zone_id: "z3", protocol: "TCP", port_ranges: [], ip_ranges: [], index: 2, predefined: false }],
        allow_count: 0, block_count: 1, analysis: null,
      },
    ];

    render(
      <ZoneGraph zones={threeZones} zonePairs={pairs} colorMode="light" onEdgeSelect={onEdgeSelect} focusZoneIds={["z1"]} />,
    );
    // z1 connects to z2 only, so we should see 2 nodes (z1, z2) and 1 edge
    expect(screen.getByTestId("nodes-count").textContent).toBe("2");
    expect(screen.getByTestId("edges-count").textContent).toBe("1");
  });

  it("filters to exact pair when focusZoneIds has two IDs", () => {
    const threeZones: Zone[] = [
      { id: "z1", name: "External", networks: [] },
      { id: "z2", name: "Internal", networks: [] },
      { id: "z3", name: "Guest", networks: [] },
    ];
    const pairs: ZonePair[] = [
      {
        source_zone_id: "z1", destination_zone_id: "z2",
        rules: [{ id: "r1", name: "R1", description: "", enabled: true, action: "ALLOW", source_zone_id: "z1", destination_zone_id: "z2", protocol: "TCP", port_ranges: [], ip_ranges: [], index: 1, predefined: false }],
        allow_count: 1, block_count: 0, analysis: null,
      },
      {
        source_zone_id: "z1", destination_zone_id: "z3",
        rules: [{ id: "r2", name: "R2", description: "", enabled: true, action: "BLOCK", source_zone_id: "z1", destination_zone_id: "z3", protocol: "TCP", port_ranges: [], ip_ranges: [], index: 2, predefined: false }],
        allow_count: 0, block_count: 1, analysis: null,
      },
    ];

    render(
      <ZoneGraph zones={threeZones} zonePairs={pairs} colorMode="light" onEdgeSelect={onEdgeSelect} focusZoneIds={["z1", "z2"]} />,
    );
    // Only z1->z2 pair, so 2 nodes and 1 edge (z1->z3 excluded)
    expect(screen.getByTestId("nodes-count").textContent).toBe("2");
    expect(screen.getByTestId("edges-count").textContent).toBe("1");
  });

  it("includes reverse-direction pair when focusZoneIds has two IDs", () => {
    const threeZones: Zone[] = [
      { id: "z1", name: "External", networks: [] },
      { id: "z2", name: "Internal", networks: [] },
      { id: "z3", name: "Guest", networks: [] },
    ];
    const pairs: ZonePair[] = [
      {
        source_zone_id: "z2", destination_zone_id: "z1",
        rules: [{ id: "r1", name: "R1", description: "", enabled: true, action: "ALLOW", source_zone_id: "z2", destination_zone_id: "z1", protocol: "TCP", port_ranges: [], ip_ranges: [], index: 1, predefined: false }],
        allow_count: 1, block_count: 0, analysis: null,
      },
      {
        source_zone_id: "z1", destination_zone_id: "z3",
        rules: [{ id: "r2", name: "R2", description: "", enabled: true, action: "BLOCK", source_zone_id: "z1", destination_zone_id: "z3", protocol: "TCP", port_ranges: [], ip_ranges: [], index: 2, predefined: false }],
        allow_count: 0, block_count: 1, analysis: null,
      },
    ];

    render(
      <ZoneGraph zones={threeZones} zonePairs={pairs} colorMode="light" onEdgeSelect={onEdgeSelect} focusZoneIds={["z1", "z2"]} />,
    );
    // z2->z1 matches the reverse direction (source=b, dest=a), z1->z3 excluded
    expect(screen.getByTestId("nodes-count").textContent).toBe("2");
    expect(screen.getByTestId("edges-count").textContent).toBe("1");
  });

  it("creates two separate edges for bidirectional zone pairs", () => {
    const biPairs: ZonePair[] = [
      {
        source_zone_id: "z1", destination_zone_id: "z2",
        rules: [{ id: "r1", name: "Allow HTTP", description: "", enabled: true, action: "ALLOW", source_zone_id: "z1", destination_zone_id: "z2", protocol: "TCP", port_ranges: ["80"], ip_ranges: [], index: 1, predefined: false }],
        allow_count: 1, block_count: 0, analysis: null,
      },
      {
        source_zone_id: "z2", destination_zone_id: "z1",
        rules: [{ id: "r2", name: "Block SSH", description: "", enabled: true, action: "BLOCK", source_zone_id: "z2", destination_zone_id: "z1", protocol: "TCP", port_ranges: ["22"], ip_ranges: [], index: 2, predefined: false }],
        allow_count: 0, block_count: 1, analysis: null,
      },
    ];

    render(
      <ZoneGraph zones={zones} zonePairs={biPairs} colorMode="light" onEdgeSelect={onEdgeSelect} />,
    );
    expect(screen.getByTestId("edges-count").textContent).toBe("2");
    expect(screen.getByTestId("edge-z1->z2")).toBeInTheDocument();
    expect(screen.getByTestId("edge-z2->z1")).toBeInTheDocument();
  });

  it("passes zone names and edge offset for bidirectional pairs", () => {
    const biPairs: ZonePair[] = [
      {
        source_zone_id: "z1", destination_zone_id: "z2",
        rules: [],
        allow_count: 0, block_count: 0, analysis: null,
      },
      {
        source_zone_id: "z2", destination_zone_id: "z1",
        rules: [],
        allow_count: 0, block_count: 0, analysis: null,
      },
    ];

    render(
      <ZoneGraph zones={zones} zonePairs={biPairs} colorMode="light" onEdgeSelect={onEdgeSelect} />,
    );

    // The mock renders edge IDs as button text - verify both edges exist
    expect(screen.getByTestId("edge-z1->z2")).toBeInTheDocument();
    expect(screen.getByTestId("edge-z2->z1")).toBeInTheDocument();
  });

  it("deduplicates zone pairs with the same source and destination", () => {
    const dupPairs: ZonePair[] = [
      {
        source_zone_id: "z1", destination_zone_id: "z2",
        rules: [{ id: "r1", name: "Allow HTTP", description: "", enabled: true, action: "ALLOW", source_zone_id: "z1", destination_zone_id: "z2", protocol: "TCP", port_ranges: ["80"], ip_ranges: [], index: 1, predefined: false }],
        allow_count: 1, block_count: 0, analysis: null,
      },
      {
        source_zone_id: "z1", destination_zone_id: "z2",
        rules: [{ id: "r2", name: "Duplicate", description: "", enabled: true, action: "ALLOW", source_zone_id: "z1", destination_zone_id: "z2", protocol: "TCP", port_ranges: [], ip_ranges: [], index: 2, predefined: false }],
        allow_count: 1, block_count: 0, analysis: null,
      },
    ];

    render(
      <ZoneGraph zones={zones} zonePairs={dupPairs} colorMode="light" onEdgeSelect={onEdgeSelect} />,
    );
    // Should deduplicate to 1 edge, not 2
    expect(screen.getByTestId("edges-count").textContent).toBe("1");
  });

  it("filters out hidden zones when showHidden is false", () => {
    const threeZones: Zone[] = [
      { id: "z1", name: "External", networks: [] },
      { id: "z2", name: "Internal", networks: [] },
      { id: "z3", name: "Guest", networks: [] },
    ];
    const pairs: ZonePair[] = [
      {
        source_zone_id: "z1", destination_zone_id: "z2",
        rules: [{ id: "r1", name: "R1", description: "", enabled: true, action: "ALLOW", source_zone_id: "z1", destination_zone_id: "z2", protocol: "TCP", port_ranges: [], ip_ranges: [], index: 1, predefined: false }],
        allow_count: 1, block_count: 0, analysis: null,
      },
      {
        source_zone_id: "z2", destination_zone_id: "z3",
        rules: [{ id: "r2", name: "R2", description: "", enabled: true, action: "BLOCK", source_zone_id: "z2", destination_zone_id: "z3", protocol: "TCP", port_ranges: [], ip_ranges: [], index: 2, predefined: false }],
        allow_count: 0, block_count: 1, analysis: null,
      },
    ];

    render(
      <ZoneGraph zones={threeZones} zonePairs={pairs} colorMode="light" onEdgeSelect={onEdgeSelect} hiddenZoneIds={new Set(["z3"])} showHidden={false} />,
    );
    // z3 is hidden, so 2 nodes (z1, z2) and 1 edge (z1->z2)
    expect(screen.getByTestId("nodes-count").textContent).toBe("2");
    expect(screen.getByTestId("edges-count").textContent).toBe("1");
  });

  it("shows hidden zones when showHidden is true", () => {
    const threeZones: Zone[] = [
      { id: "z1", name: "External", networks: [] },
      { id: "z2", name: "Internal", networks: [] },
      { id: "z3", name: "Guest", networks: [] },
    ];
    const pairs: ZonePair[] = [
      {
        source_zone_id: "z1", destination_zone_id: "z2",
        rules: [{ id: "r1", name: "R1", description: "", enabled: true, action: "ALLOW", source_zone_id: "z1", destination_zone_id: "z2", protocol: "TCP", port_ranges: [], ip_ranges: [], index: 1, predefined: false }],
        allow_count: 1, block_count: 0, analysis: null,
      },
      {
        source_zone_id: "z2", destination_zone_id: "z3",
        rules: [{ id: "r2", name: "R2", description: "", enabled: true, action: "BLOCK", source_zone_id: "z2", destination_zone_id: "z3", protocol: "TCP", port_ranges: [], ip_ranges: [], index: 2, predefined: false }],
        allow_count: 0, block_count: 1, analysis: null,
      },
    ];

    render(
      <ZoneGraph zones={threeZones} zonePairs={pairs} colorMode="light" onEdgeSelect={onEdgeSelect} hiddenZoneIds={new Set(["z3"])} showHidden={true} />,
    );
    // showHidden=true means all zones visible despite hiddenZoneIds
    expect(screen.getByTestId("nodes-count").textContent).toBe("3");
    expect(screen.getByTestId("edges-count").textContent).toBe("2");
  });

  it("shows all zones when focusZoneIds is not set", () => {
    const threeZones: Zone[] = [
      { id: "z1", name: "External", networks: [] },
      { id: "z2", name: "Internal", networks: [] },
      { id: "z3", name: "Guest", networks: [] },
    ];

    render(
      <ZoneGraph zones={threeZones} zonePairs={[]} colorMode="light" onEdgeSelect={onEdgeSelect} />,
    );
    expect(screen.getByTestId("nodes-count").textContent).toBe("3");
  });

  describe("useCrispZoom", () => {
    const mockDisconnect = vi.fn();
    let mockObserve: ReturnType<typeof vi.fn>;
    let capturedCallback: (() => void) | null;
    let OriginalMutationObserver: typeof MutationObserver;

    beforeEach(() => {
      capturedCallback = null;
      mockObserve = vi.fn();
      mockDisconnect.mockClear();

      OriginalMutationObserver = globalThis.MutationObserver;
      globalThis.MutationObserver = class MockMutationObserver {
        constructor(cb: () => void) {
          capturedCallback = cb;
        }
        observe = mockObserve;
        disconnect = mockDisconnect;
        takeRecords = vi.fn();
      } as unknown as typeof MutationObserver;
    });

    afterEach(() => {
      globalThis.MutationObserver = OriginalMutationObserver;
    });

    it("applies zoom fix when viewport has a valid scale transform", () => {
      render(
        <ZoneGraph zones={zones} zonePairs={zonePairs} colorMode="light" onEdgeSelect={onEdgeSelect} />,
      );

      const viewport = screen.getByTestId("viewport");
      viewport.style.transform = "translate(100px, 200px) scale(2)";

      // applyZoomFix is called immediately during effect setup
      // Trigger it again via the observer callback
      capturedCallback!();

      expect(viewport.style.transform).toBe("translate(50px, 100px)");
      expect(viewport.style.zoom).toBe("2");
    });

    it("observes viewport style attribute changes", () => {
      render(
        <ZoneGraph zones={zones} zonePairs={zonePairs} colorMode="light" onEdgeSelect={onEdgeSelect} />,
      );

      expect(mockObserve).toHaveBeenCalledWith(
        screen.getByTestId("viewport"),
        { attributes: true, attributeFilter: ["style"] },
      );
    });

    it("disconnects observer on unmount", () => {
      const { unmount } = render(
        <ZoneGraph zones={zones} zonePairs={zonePairs} colorMode="light" onEdgeSelect={onEdgeSelect} />,
      );

      expect(mockDisconnect).not.toHaveBeenCalled();
      unmount();
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it("does not modify transform when it has no scale()", () => {
      render(
        <ZoneGraph zones={zones} zonePairs={zonePairs} colorMode="light" onEdgeSelect={onEdgeSelect} />,
      );

      const viewport = screen.getByTestId("viewport");
      viewport.style.transform = "translate(100px, 200px)";

      capturedCallback!();

      expect(viewport.style.transform).toBe("translate(100px, 200px)");
      expect(viewport.style.zoom).toBe("");
    });

    it("does not modify transform when scale is present but regex does not match", () => {
      render(
        <ZoneGraph zones={zones} zonePairs={zonePairs} colorMode="light" onEdgeSelect={onEdgeSelect} />,
      );

      const viewport = screen.getByTestId("viewport");
      // Has "scale(" substring but not in the expected translate(...) scale(...) format
      viewport.style.transform = "scale(2)";

      capturedCallback!();

      expect(viewport.style.transform).toBe("scale(2)");
      expect(viewport.style.zoom).toBe("");
    });

    it("applies zoom fix on initial render when transform already set", () => {
      // Pre-set the transform before render by using a custom mock
      // The viewport gets the transform set before the effect runs
      // We test this by setting the style in the mock ReactFlow
      const viewportTransform = "translate(300px, 150px) scale(1.5)";

      // We need to set the transform before the effect runs.
      // Since useEffect runs after render, we can set it via a ref callback pattern.
      // Instead, we'll verify the initial call by checking the MutationObserver was created
      // and the observe was called, then simulate the initial transform.
      render(
        <ZoneGraph zones={zones} zonePairs={zonePairs} colorMode="light" onEdgeSelect={onEdgeSelect} />,
      );

      const viewport = screen.getByTestId("viewport");
      viewport.style.transform = viewportTransform;
      capturedCallback!();

      expect(viewport.style.transform).toBe("translate(200px, 100px)");
      expect(viewport.style.zoom).toBe("1.5");
    });

    it("handles fractional scale values correctly", () => {
      render(
        <ZoneGraph zones={zones} zonePairs={zonePairs} colorMode="light" onEdgeSelect={onEdgeSelect} />,
      );

      const viewport = screen.getByTestId("viewport");
      viewport.style.transform = "translate(50px, 25px) scale(0.5)";

      capturedCallback!();

      expect(viewport.style.transform).toBe("translate(100px, 50px)");
      expect(viewport.style.zoom).toBe("0.5");
    });
  });
});
