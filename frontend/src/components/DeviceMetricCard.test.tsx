import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DeviceMetricCard from "./DeviceMetricCard";
import type { MetricsSnapshot } from "../api/types";

function makeDevice(overrides?: Partial<MetricsSnapshot>): MetricsSnapshot {
  return {
    mac: "aa:bb:cc:dd:ee:01",
    name: "Gateway",
    model: "UDM-Pro",
    type: "gateway",
    cpu: 25,
    mem: 60,
    temperature: 52,
    uptime: 90061, // 1d 1h 1m
    tx_bytes: 1024,
    rx_bytes: 2048,
    num_sta: 5,
    version: "4.0.6",
    poe_consumption: null,
    poe_budget: null,
    status: "online",
    ...overrides,
  };
}

describe("DeviceMetricCard", () => {
  it("renders device name and model", () => {
    render(<DeviceMetricCard device={makeDevice()} onClick={vi.fn()} />);
    expect(screen.getByText("Gateway")).toBeInTheDocument();
    expect(screen.getByText("UDM-Pro")).toBeInTheDocument();
  });

  it("shows CPU and memory percentages", () => {
    render(<DeviceMetricCard device={makeDevice({ cpu: 42.7, mem: 71.3 })} onClick={vi.fn()} />);
    expect(screen.getByText("43%")).toBeInTheDocument();
    expect(screen.getByText("71%")).toBeInTheDocument();
  });

  it("shows temperature with green color for cool devices", () => {
    render(<DeviceMetricCard device={makeDevice({ temperature: 45 })} onClick={vi.fn()} />);
    const temp = screen.getByText("45C");
    expect(temp.className).toContain("text-status-success");
  });

  it("shows temperature with yellow color for warm devices", () => {
    render(<DeviceMetricCard device={makeDevice({ temperature: 65 })} onClick={vi.fn()} />);
    const temp = screen.getByText("65C");
    expect(temp.className).toContain("text-status-warning");
  });

  it("shows temperature with red color for hot devices", () => {
    render(<DeviceMetricCard device={makeDevice({ temperature: 85 })} onClick={vi.fn()} />);
    const temp = screen.getByText("85C");
    expect(temp.className).toContain("text-status-danger");
  });

  it("hides temperature when null", () => {
    render(<DeviceMetricCard device={makeDevice({ temperature: null })} onClick={vi.fn()} />);
    expect(screen.queryByText("Temp")).not.toBeInTheDocument();
  });

  it("shows client count", () => {
    render(<DeviceMetricCard device={makeDevice({ num_sta: 12 })} onClick={vi.fn()} />);
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("formats uptime correctly", () => {
    render(<DeviceMetricCard device={makeDevice({ uptime: 90061 })} onClick={vi.fn()} />);
    expect(screen.getByText("Uptime: 1d 1h 1m")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const handler = vi.fn();
    render(<DeviceMetricCard device={makeDevice()} onClick={handler} />);
    fireEvent.click(screen.getByRole("button"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("calls onClick on Enter key", () => {
    const handler = vi.fn();
    render(<DeviceMetricCard device={makeDevice()} onClick={handler} />);
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("calls onClick on Space key", () => {
    const handler = vi.fn();
    render(<DeviceMetricCard device={makeDevice()} onClick={handler} />);
    fireEvent.keyDown(screen.getByRole("button"), { key: " " });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick on other keys", () => {
    const handler = vi.fn();
    render(<DeviceMetricCard device={makeDevice()} onClick={handler} />);
    fireEvent.keyDown(screen.getByRole("button"), { key: "Tab" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("shows green status dot for online devices", () => {
    const { container } = render(<DeviceMetricCard device={makeDevice({ status: "online" })} onClick={vi.fn()} />);
    const dot = container.querySelector(".bg-status-success");
    expect(dot).toBeInTheDocument();
  });

  it("shows red status dot for offline devices", () => {
    const { container } = render(<DeviceMetricCard device={makeDevice({ status: "offline" })} onClick={vi.fn()} />);
    const dot = container.querySelector(".bg-status-danger");
    expect(dot).toBeInTheDocument();
  });

  it("shows gray status dot for unknown status", () => {
    const { container } = render(<DeviceMetricCard device={makeDevice({ status: "unknown" })} onClick={vi.fn()} />);
    const dot = container.querySelector(".bg-ui-text-dim");
    expect(dot).toBeInTheDocument();
  });

  it("shows PoE bar when poe_budget is set", () => {
    render(<DeviceMetricCard device={makeDevice({ poe_consumption: 45, poe_budget: 100 })} onClick={vi.fn()} />);
    expect(screen.getByText("PoE")).toBeInTheDocument();
    expect(screen.getByText("45W / 100W")).toBeInTheDocument();
  });

  it("hides PoE bar when poe_budget is null", () => {
    render(<DeviceMetricCard device={makeDevice({ poe_budget: null })} onClick={vi.fn()} />);
    expect(screen.queryByText("PoE")).not.toBeInTheDocument();
  });

  it("hides PoE bar when poe_budget is zero", () => {
    render(<DeviceMetricCard device={makeDevice({ poe_budget: 0 })} onClick={vi.fn()} />);
    expect(screen.queryByText("PoE")).not.toBeInTheDocument();
  });

  it("shows blue PoE bar when usage is below 70%", () => {
    const { container } = render(<DeviceMetricCard device={makeDevice({ poe_consumption: 30, poe_budget: 100 })} onClick={vi.fn()} />);
    const bar = container.querySelector(".bg-ub-blue:not(.h-1\\.5)");
    expect(bar).toBeInTheDocument();
  });

  it("handles null poe_consumption with poe_budget", () => {
    render(<DeviceMetricCard device={makeDevice({ poe_consumption: null, poe_budget: 100 })} onClick={vi.fn()} />);
    expect(screen.getByText("0W / 100W")).toBeInTheDocument();
  });

  it("shows red PoE bar when usage exceeds 90%", () => {
    const { container } = render(<DeviceMetricCard device={makeDevice({ poe_consumption: 95, poe_budget: 100 })} onClick={vi.fn()} />);
    expect(container.querySelector(".bg-status-danger")).toBeInTheDocument();
  });

  it("shows yellow PoE bar when usage exceeds 70%", () => {
    const { container } = render(<DeviceMetricCard device={makeDevice({ poe_consumption: 75, poe_budget: 100 })} onClick={vi.fn()} />);
    expect(container.querySelector(".bg-status-warning")).toBeInTheDocument();
  });

  it("has role=button and tabIndex", () => {
    render(<DeviceMetricCard device={makeDevice()} onClick={vi.fn()} />);
    const card = screen.getByRole("button");
    expect(card).toHaveAttribute("tabindex", "0");
  });
});
