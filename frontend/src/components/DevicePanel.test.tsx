import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DevicePanel from "./DevicePanel";
import type { TopologyDevice } from "../api/types";

const testDevice: TopologyDevice = {
  mac: "aa:bb:cc:dd:ee:01",
  name: "Test Switch",
  model: "USW-24",
  model_name: "UniFi Switch 24",
  type: "switch",
  ip: "192.168.1.2",
  version: "7.1.0",
  uptime: 90061,
  status: "online",
  client_count: 10,
  ports: [
    { idx: 1, name: "Port 1", speed: 1000, up: true, poe: true, poe_power: 4.2, connected_device: "AP-Office", connected_mac: "aa:bb:cc:dd:ee:03", native_vlan: 1 },
    { idx: 2, name: "Port 2", speed: 100, up: true, poe: false, poe_power: null, connected_device: null, connected_mac: null, native_vlan: 10 },
    { idx: 3, name: "Port 3", speed: null, up: false, poe: true, poe_power: null, connected_device: null, connected_mac: null, native_vlan: null },
  ],
};

describe("DevicePanel", () => {
  it("renders device name", () => {
    render(<DevicePanel device={testDevice} onClose={vi.fn()} />);
    expect(screen.getByText("Test Switch")).toBeInTheDocument();
  });

  it("renders device details", () => {
    render(<DevicePanel device={testDevice} onClose={vi.fn()} />);
    expect(screen.getByText("192.168.1.2")).toBeInTheDocument();
    expect(screen.getByText(/aa:bb:cc:dd:ee:01/i)).toBeInTheDocument();
    expect(screen.getByText("7.1.0")).toBeInTheDocument();
  });

  it("formats uptime", () => {
    render(<DevicePanel device={testDevice} onClose={vi.fn()} />);
    expect(screen.getByText(/1d 1h 1m/)).toBeInTheDocument();
  });

  it("renders port table", () => {
    render(<DevicePanel device={testDevice} onClose={vi.fn()} />);
    expect(screen.getByText("AP-Office")).toBeInTheDocument();
    expect(screen.getByText("1G")).toBeInTheDocument();
  });

  it("shows PoE power for active PoE ports", () => {
    render(<DevicePanel device={testDevice} onClose={vi.fn()} />);
    expect(screen.getAllByText("4.2W").length).toBeGreaterThanOrEqual(1);
  });

  it("renders online status", () => {
    render(<DevicePanel device={testDevice} onClose={vi.fn()} />);
    expect(screen.getByText(/online/i)).toBeInTheDocument();
  });

  it("renders client count", () => {
    render(<DevicePanel device={testDevice} onClose={vi.fn()} />);
    expect(screen.getAllByText("10").length).toBeGreaterThanOrEqual(1);
  });

  it("calls onClose when close button clicked", () => {
    const handler = vi.fn();
    render(<DevicePanel device={testDevice} onClose={handler} />);
    fireEvent.click(screen.getByLabelText("Close panel"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("renders model name", () => {
    render(<DevicePanel device={testDevice} onClose={vi.fn()} />);
    expect(screen.getByText("UniFi Switch 24")).toBeInTheDocument();
  });

  it("renders offline status with danger color", () => {
    const offlineDevice = { ...testDevice, status: "offline" };
    const { container } = render(<DevicePanel device={offlineDevice} onClose={vi.fn()} />);
    expect(container.querySelector(".bg-status-danger")).toBeInTheDocument();
  });

  it("renders unknown status with dim color", () => {
    const unknownDevice = { ...testDevice, status: "adopting" };
    const { container } = render(<DevicePanel device={unknownDevice} onClose={vi.fn()} />);
    const dots = container.querySelectorAll(".bg-ui-text-dim");
    expect(dots.length).toBeGreaterThanOrEqual(1);
  });

  it("formats 2.5G port speed", () => {
    const device = {
      ...testDevice,
      ports: [{ idx: 1, name: "Port 1", speed: 2500, up: true, poe: false, poe_power: null, connected_device: null, connected_mac: null, native_vlan: null }],
    };
    render(<DevicePanel device={device} onClose={vi.fn()} />);
    expect(screen.getByText("2.5G")).toBeInTheDocument();
  });

  it("formats 10G port speed", () => {
    const device = {
      ...testDevice,
      ports: [{ idx: 1, name: "Port 1", speed: 10000, up: true, poe: false, poe_power: null, connected_device: null, connected_mac: null, native_vlan: null }],
    };
    render(<DevicePanel device={device} onClose={vi.fn()} />);
    expect(screen.getByText("10G")).toBeInTheDocument();
  });

  it("formats unknown speed as megabit", () => {
    const device = {
      ...testDevice,
      ports: [{ idx: 1, name: "Port 1", speed: 500, up: true, poe: false, poe_power: null, connected_device: null, connected_mac: null, native_vlan: null }],
    };
    render(<DevicePanel device={device} onClose={vi.fn()} />);
    expect(screen.getByText("500M")).toBeInTheDocument();
  });

  it("shows Down for null speed", () => {
    const device = {
      ...testDevice,
      ports: [{ idx: 1, name: "Port 1", speed: null, up: false, poe: false, poe_power: null, connected_device: null, connected_mac: null, native_vlan: null }],
    };
    render(<DevicePanel device={device} onClose={vi.fn()} />);
    expect(screen.getByText("Down")).toBeInTheDocument();
  });

  it("shows Down for zero speed", () => {
    const device = {
      ...testDevice,
      ports: [{ idx: 1, name: "Port 1", speed: 0, up: false, poe: false, poe_power: null, connected_device: null, connected_mac: null, native_vlan: null }],
    };
    render(<DevicePanel device={device} onClose={vi.fn()} />);
    expect(screen.getByText("Down")).toBeInTheDocument();
  });

  it("shows -- for null connected_device", () => {
    const device = {
      ...testDevice,
      ports: [{ idx: 1, name: "Port 1", speed: 1000, up: true, poe: false, poe_power: null, connected_device: null, connected_mac: null, native_vlan: null }],
    };
    render(<DevicePanel device={device} onClose={vi.fn()} />);
    // Several dashes exist for null connected_device, poe, vlan
    const dashes = screen.getAllByText("--");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("shows -- for null native_vlan", () => {
    const device = {
      ...testDevice,
      ports: [{ idx: 1, name: "Port 1", speed: 1000, up: true, poe: false, poe_power: null, connected_device: "Something", connected_mac: null, native_vlan: null }],
    };
    render(<DevicePanel device={device} onClose={vi.fn()} />);
    // Two dashes for PoE and VLAN
    const dashes = screen.getAllByText("--");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("shows PoE budget section when ports have PoE consumption", () => {
    render(<DevicePanel device={testDevice} onClose={vi.fn()} />);
    expect(screen.getByText("PoE Budget")).toBeInTheDocument();
  });

  it("hides PoE budget section when no PoE ports have power", () => {
    const device = {
      ...testDevice,
      ports: [
        { idx: 1, name: "Port 1", speed: 1000, up: true, poe: false, poe_power: null, connected_device: null, connected_mac: null, native_vlan: 1 },
      ],
    };
    render(<DevicePanel device={device} onClose={vi.fn()} />);
    expect(screen.queryByText("PoE Budget")).not.toBeInTheDocument();
  });

  it("hides port table when no ports", () => {
    const device = { ...testDevice, ports: [] };
    render(<DevicePanel device={device} onClose={vi.fn()} />);
    expect(screen.queryByText(/Ports \(/)).not.toBeInTheDocument();
  });

  it("shows -- for PoE when port is PoE but has no power", () => {
    const device = {
      ...testDevice,
      ports: [
        { idx: 1, name: "Port 1", speed: 1000, up: true, poe: true, poe_power: null, connected_device: null, connected_mac: null, native_vlan: 1 },
      ],
    };
    render(<DevicePanel device={device} onClose={vi.fn()} />);
    const dashes = screen.getAllByText("--");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("formats uptime with only minutes when hours and days are zero", () => {
    const device = { ...testDevice, uptime: 120 };
    render(<DevicePanel device={device} onClose={vi.fn()} />);
    expect(screen.getByText("2m")).toBeInTheDocument();
  });

  it("formats uptime with hours and minutes when days is zero", () => {
    const device = { ...testDevice, uptime: 7260 };
    render(<DevicePanel device={device} onClose={vi.fn()} />);
    expect(screen.getByText("2h 1m")).toBeInTheDocument();
  });

  it("calculates poe_power ?? 0 when poe_power is null for reduce", () => {
    const device = {
      ...testDevice,
      ports: [
        { idx: 1, name: "Port 1", speed: 1000, up: true, poe: true, poe_power: 5.0, connected_device: null, connected_mac: null, native_vlan: 1 },
        { idx: 2, name: "Port 2", speed: 1000, up: true, poe: true, poe_power: null, connected_device: null, connected_mac: null, native_vlan: 1 },
      ],
    };
    render(<DevicePanel device={device} onClose={vi.fn()} />);
    expect(screen.getByText("PoE Budget")).toBeInTheDocument();
    expect(screen.getByText("5.0W")).toBeInTheDocument();
  });
});
