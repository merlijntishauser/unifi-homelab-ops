import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DeviceMap from "./DeviceMap";
import type { TopologyDevice, TopologyEdge } from "../api/types";
import type { DeviceNodeData } from "./DeviceNode";

type AnyNode = { id: string; data: DeviceNodeData };
type AnyEdge = { id: string; source: string; target: string; label?: string; style?: { stroke: string } };

let capturedNodes: AnyNode[] = [];
let capturedEdges: AnyEdge[] = [];

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ nodes, edges }: { nodes: AnyNode[]; edges: AnyEdge[] }) => {
    capturedNodes = nodes;
    capturedEdges = edges;
    return (
      <div data-testid="react-flow">
        <div data-testid="nodes-count">{nodes.length}</div>
        <div data-testid="edges-count">{edges.length}</div>
      </div>
    );
  },
  Background: () => <div />,
  Controls: () => <div />,
  MiniMap: () => <div />,
  Handle: () => <div />,
  Position: { Top: "top", Bottom: "bottom" },
  useNodesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  MarkerType: { ArrowClosed: "arrowclosed" },
}));

vi.mock("@dagrejs/dagre", () => {
  class MockGraph {
    _nodes: Record<string, { x: number; y: number }> = {};
    setDefaultEdgeLabel() { return this; }
    setGraph = vi.fn();
    setNode(_id: string) { this._nodes[_id] = { x: 100, y: 100 }; }
    setEdge = vi.fn();
    node(id: string) { return this._nodes[id] ?? { x: 100, y: 100 }; }
  }
  return {
    default: {
      graphlib: { Graph: MockGraph },
      layout: vi.fn(),
    },
  };
});

const testDevices: TopologyDevice[] = [
  { mac: "aa:01", name: "Gateway", model: "UDM", model_name: "Dream Machine", type: "udm", ip: "10.0.0.1", version: "4.0", uptime: 0, status: "online", client_count: 5, ports: [] },
  { mac: "aa:02", name: "Switch", model: "USW", model_name: "", type: "usw", ip: "10.0.0.2", version: "7.0", uptime: 0, status: "online", client_count: 10, ports: [] },
];

const testEdges: TopologyEdge[] = [
  { from_mac: "aa:01", to_mac: "aa:02", speed: 1000, poe: false, wireless: false, local_port: null, remote_port: null },
];

describe("DeviceMap", () => {
  it("renders ReactFlow with correct node count", () => {
    render(<DeviceMap devices={testDevices} edges={testEdges} colorMode="dark" onDeviceSelect={vi.fn()} />);
    expect(screen.getByTestId("nodes-count").textContent).toBe("2");
  });

  it("renders ReactFlow with correct edge count", () => {
    render(<DeviceMap devices={testDevices} edges={testEdges} colorMode="dark" onDeviceSelect={vi.fn()} />);
    expect(screen.getByTestId("edges-count").textContent).toBe("1");
  });

  it("renders with empty data", () => {
    render(<DeviceMap devices={[]} edges={[]} colorMode="dark" onDeviceSelect={vi.fn()} />);
    expect(screen.getByTestId("nodes-count").textContent).toBe("0");
  });

  it("renders edges with various speeds", () => {
    const edgesWithSpeeds: TopologyEdge[] = [
      { from_mac: "aa:01", to_mac: "aa:02", speed: 1000, poe: false, wireless: false, local_port: null, remote_port: null },
      { from_mac: "aa:02", to_mac: "aa:01", speed: 2500, poe: true, wireless: false, local_port: null, remote_port: null },
      { from_mac: "aa:01", to_mac: "aa:02", speed: 10000, poe: false, wireless: false, local_port: null, remote_port: null },
      { from_mac: "aa:02", to_mac: "aa:01", speed: 100, poe: false, wireless: false, local_port: null, remote_port: null },
      { from_mac: "aa:01", to_mac: "aa:02", speed: null, poe: false, wireless: false, local_port: null, remote_port: null },
    ];
    render(<DeviceMap devices={testDevices} edges={edgesWithSpeeds} colorMode="dark" onDeviceSelect={vi.fn()} />);
    expect(screen.getByTestId("edges-count").textContent).toBe("5");
  });

  it("renders with AP device type", () => {
    const apDevice: TopologyDevice = { mac: "aa:03", name: "AP", model: "UAP", model_name: "UAP", type: "uap", ip: "10.0.0.3", version: "7.0", uptime: 0, status: "online", client_count: 20, ports: [] };
    render(<DeviceMap devices={[...testDevices, apDevice]} edges={testEdges} colorMode="light" onDeviceSelect={vi.fn()} />);
    expect(screen.getByTestId("nodes-count").textContent).toBe("3");
  });

  it("applies saved positions when provided", () => {
    const saved = [{ mac: "aa:01", x: 500, y: 300 }];
    render(<DeviceMap devices={testDevices} edges={testEdges} colorMode="dark" onDeviceSelect={vi.fn()} savedPositions={saved} />);
    expect(screen.getByTestId("nodes-count").textContent).toBe("2");
  });

  it("passes onNodeDragEnd through to ReactFlow", () => {
    const onDrag = vi.fn();
    render(<DeviceMap devices={testDevices} edges={testEdges} colorMode="dark" onDeviceSelect={vi.fn()} onNodeDragEnd={onDrag} />);
    expect(screen.getByTestId("nodes-count").textContent).toBe("2");
  });

  it("maps ugw device type to gateway", () => {
    const ugwDevice: TopologyDevice = { mac: "aa:10", name: "UGW", model: "UGW3", model_name: "Security Gateway", type: "ugw", ip: "10.0.0.10", version: "5.0", uptime: 0, status: "online", client_count: 0, ports: [] };
    render(<DeviceMap devices={[ugwDevice]} edges={[]} colorMode="dark" onDeviceSelect={vi.fn()} />);
    expect(capturedNodes[0].data.deviceType).toBe("gateway");
  });

  it("maps udm device type to gateway", () => {
    render(<DeviceMap devices={testDevices} edges={testEdges} colorMode="dark" onDeviceSelect={vi.fn()} />);
    const gatewayNode = capturedNodes.find((n) => n.id === "aa:01");
    expect(gatewayNode?.data.deviceType).toBe("gateway");
  });

  it("maps usw device type to switch", () => {
    render(<DeviceMap devices={testDevices} edges={testEdges} colorMode="dark" onDeviceSelect={vi.fn()} />);
    const switchNode = capturedNodes.find((n) => n.id === "aa:02");
    expect(switchNode?.data.deviceType).toBe("switch");
  });

  it("maps uap device type to ap", () => {
    const apDevice: TopologyDevice = { mac: "aa:03", name: "AP", model: "UAP", model_name: "AP Pro", type: "uap", ip: "10.0.0.3", version: "7.0", uptime: 0, status: "online", client_count: 20, ports: [] };
    render(<DeviceMap devices={[apDevice]} edges={[]} colorMode="dark" onDeviceSelect={vi.fn()} />);
    expect(capturedNodes[0].data.deviceType).toBe("ap");
  });

  it("maps unknown device type to other", () => {
    const unknownDevice: TopologyDevice = { mac: "aa:99", name: "Unknown", model: "X1", model_name: "", type: "unknown", ip: "10.0.0.99", version: "1.0", uptime: 0, status: "online", client_count: 0, ports: [] };
    render(<DeviceMap devices={[unknownDevice]} edges={[]} colorMode="dark" onDeviceSelect={vi.fn()} />);
    expect(capturedNodes[0].data.deviceType).toBe("other");
  });

  it("uses model_name when available, falls back to model when empty", () => {
    render(<DeviceMap devices={testDevices} edges={testEdges} colorMode="dark" onDeviceSelect={vi.fn()} />);
    const gatewayNode = capturedNodes.find((n) => n.id === "aa:01");
    expect(gatewayNode?.data.model).toBe("Dream Machine");
    const switchNode = capturedNodes.find((n) => n.id === "aa:02");
    expect(switchNode?.data.model).toBe("USW");
  });

  it("filters out edges referencing non-existent devices", () => {
    const edgesWithOrphan: TopologyEdge[] = [
      { from_mac: "aa:01", to_mac: "aa:02", speed: 1000, poe: false, wireless: false, local_port: null, remote_port: null },
      { from_mac: "aa:01", to_mac: "zz:99", speed: 1000, poe: false, wireless: false, local_port: null, remote_port: null },
    ];
    render(<DeviceMap devices={testDevices} edges={edgesWithOrphan} colorMode="dark" onDeviceSelect={vi.fn()} />);
    expect(screen.getByTestId("edges-count").textContent).toBe("1");
  });

  it("formats edge label with PoE", () => {
    const poeEdge: TopologyEdge[] = [
      { from_mac: "aa:01", to_mac: "aa:02", speed: 1000, poe: true, wireless: false, local_port: null, remote_port: null },
    ];
    render(<DeviceMap devices={testDevices} edges={poeEdge} colorMode="dark" onDeviceSelect={vi.fn()} />);
    expect(capturedEdges[0].label).toBe("1G / PoE");
  });

  it("formats edge label with PoE only when speed is null", () => {
    const poeOnlyEdge: TopologyEdge[] = [
      { from_mac: "aa:01", to_mac: "aa:02", speed: null, poe: true, wireless: false, local_port: null, remote_port: null },
    ];
    render(<DeviceMap devices={testDevices} edges={poeOnlyEdge} colorMode="dark" onDeviceSelect={vi.fn()} />);
    expect(capturedEdges[0].label).toBe("PoE");
  });

  it("sets edge label to undefined when no speed and no PoE", () => {
    const plainEdge: TopologyEdge[] = [
      { from_mac: "aa:01", to_mac: "aa:02", speed: null, poe: false, wireless: false, local_port: null, remote_port: null },
    ];
    render(<DeviceMap devices={testDevices} edges={plainEdge} colorMode="dark" onDeviceSelect={vi.fn()} />);
    expect(capturedEdges[0].label).toBeUndefined();
  });

  it("uses blue stroke for wireless edges", () => {
    const wirelessEdge: TopologyEdge[] = [
      { from_mac: "aa:01", to_mac: "aa:02", speed: null, poe: false, wireless: true, local_port: null, remote_port: null },
    ];
    render(<DeviceMap devices={testDevices} edges={wirelessEdge} colorMode="dark" onDeviceSelect={vi.fn()} />);
    expect(capturedEdges[0].style?.stroke).toBe("#006fff");
  });

  it("uses grey stroke for wired edges", () => {
    render(<DeviceMap devices={testDevices} edges={testEdges} colorMode="dark" onDeviceSelect={vi.fn()} />);
    expect(capturedEdges[0].style?.stroke).toBe("#4a5468");
  });

  it("formats speed 0 as empty string", () => {
    const zeroSpeedEdge: TopologyEdge[] = [
      { from_mac: "aa:01", to_mac: "aa:02", speed: 0, poe: false, wireless: false, local_port: null, remote_port: null },
    ];
    render(<DeviceMap devices={testDevices} edges={zeroSpeedEdge} colorMode="dark" onDeviceSelect={vi.fn()} />);
    expect(capturedEdges[0].label).toBeUndefined();
  });

  it("formats speed 2500 as 2.5G", () => {
    const edge25g: TopologyEdge[] = [
      { from_mac: "aa:01", to_mac: "aa:02", speed: 2500, poe: false, wireless: false, local_port: null, remote_port: null },
    ];
    render(<DeviceMap devices={testDevices} edges={edge25g} colorMode="dark" onDeviceSelect={vi.fn()} />);
    expect(capturedEdges[0].label).toBe("2.5G");
  });

  it("formats speed 10000 as 10G", () => {
    const edge10g: TopologyEdge[] = [
      { from_mac: "aa:01", to_mac: "aa:02", speed: 10000, poe: false, wireless: false, local_port: null, remote_port: null },
    ];
    render(<DeviceMap devices={testDevices} edges={edge10g} colorMode="dark" onDeviceSelect={vi.fn()} />);
    expect(capturedEdges[0].label).toBe("10G");
  });

  it("formats other speeds as megabits", () => {
    const edge100m: TopologyEdge[] = [
      { from_mac: "aa:01", to_mac: "aa:02", speed: 100, poe: false, wireless: false, local_port: null, remote_port: null },
    ];
    render(<DeviceMap devices={testDevices} edges={edge100m} colorMode="dark" onDeviceSelect={vi.fn()} />);
    expect(capturedEdges[0].label).toBe("100M");
  });

  it("calls onDeviceSelect when node onSelect is invoked", () => {
    const onDeviceSelect = vi.fn();
    render(<DeviceMap devices={testDevices} edges={testEdges} colorMode="dark" onDeviceSelect={onDeviceSelect} />);
    capturedNodes[0].data.onSelect();
    expect(onDeviceSelect).toHaveBeenCalledWith(
      expect.objectContaining({ mac: capturedNodes[0].id }),
    );
  });

  it("sorts devices by rank: gateways first, switches middle, APs last", () => {
    const mixedDevices: TopologyDevice[] = [
      { mac: "aa:03", name: "AP", model: "UAP", model_name: "AP Pro", type: "uap", ip: "10.0.0.3", version: "7.0", uptime: 0, status: "online", client_count: 20, ports: [] },
      { mac: "aa:01", name: "Gateway", model: "UDM", model_name: "Dream Machine", type: "udm", ip: "10.0.0.1", version: "4.0", uptime: 0, status: "online", client_count: 5, ports: [] },
      { mac: "aa:02", name: "Switch", model: "USW", model_name: "Switch Pro", type: "usw", ip: "10.0.0.2", version: "7.0", uptime: 0, status: "online", client_count: 10, ports: [] },
    ];
    render(<DeviceMap devices={mixedDevices} edges={[]} colorMode="dark" onDeviceSelect={vi.fn()} />);
    expect(capturedNodes[0].data.deviceType).toBe("gateway");
    expect(capturedNodes[1].data.deviceType).toBe("switch");
    expect(capturedNodes[2].data.deviceType).toBe("ap");
  });

  it("renders with empty savedPositions array (no override)", () => {
    render(<DeviceMap devices={testDevices} edges={testEdges} colorMode="dark" onDeviceSelect={vi.fn()} savedPositions={[]} />);
    expect(screen.getByTestId("nodes-count").textContent).toBe("2");
  });

  it("handles unknown device type by assigning default rank", () => {
    const unknownDevice: TopologyDevice = {
      mac: "aa:04", name: "NVR", model: "UNVR", model_name: "Network Video Recorder",
      type: "unvr", ip: "10.0.0.4", version: "3.0", uptime: 0, status: "online", client_count: 0, ports: [],
    };
    render(<DeviceMap devices={[...testDevices, unknownDevice]} edges={testEdges} colorMode="dark" onDeviceSelect={vi.fn()} />);
    expect(screen.getByTestId("nodes-count").textContent).toBe("3");
  });
});
