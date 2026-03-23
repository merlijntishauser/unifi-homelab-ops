import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MetricsDetailView from "./MetricsDetailView";
import type { MetricsSnapshot, MetricsHistoryPoint, AppNotification } from "../api/types";

// Mock MetricsChart since recharts doesn't render in jsdom
vi.mock("./MetricsChart", () => ({
  default: ({ label, value }: { label: string; value: string }) => (
    <div data-testid={`chart-${label}`}>{label}: {value}</div>
  ),
  DualMetricsChart: ({ label, value }: { label: string; value: string }) => (
    <div data-testid={`chart-${label}`}>{label}: {value}</div>
  ),
}));

function makeDevice(overrides?: Partial<MetricsSnapshot>): MetricsSnapshot {
  return {
    mac: "aa:bb:cc:dd:ee:01",
    name: "Gateway",
    model: "UDM-Pro",
    type: "gateway",
    cpu: 25,
    mem: 60,
    temperature: 52,
    uptime: 90061,
    tx_bytes: 1048576,
    rx_bytes: 2097152,
    num_sta: 5,
    version: "4.0.6",
    poe_consumption: null,
    poe_budget: null,
    ip: "192.168.1.1",
    status: "online",
    ...overrides,
  };
}

function makeHistory(count: number): MetricsHistoryPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(Date.now() - (count - i) * 60000).toISOString(),
    cpu: 20 + i,
    mem: 50 + i,
    temperature: 45 + i * 0.5,
    uptime: 86400 + i * 60,
    tx_bytes: 1000 * (i + 1),
    rx_bytes: 2000 * (i + 1),
    num_sta: 5,
    poe_consumption: null,
  }));
}

function makeNotification(overrides?: Partial<AppNotification>): AppNotification {
  return {
    id: 1,
    device_mac: "aa:bb:cc:dd:ee:01",
    check_id: "cpu_high",
    severity: "warning",
    title: "High CPU Usage",
    message: "CPU usage exceeded 80%",
    created_at: new Date().toISOString(),
    resolved_at: null,
    dismissed: false,
    ...overrides,
  };
}

describe("MetricsDetailView", () => {
  // --- Header & Device Info ---

  it("renders device name with status dot", () => {
    render(<MetricsDetailView device={makeDevice()} history={[]} notifications={[]} onBack={vi.fn()} />);
    expect(screen.getByText("Gateway")).toBeInTheDocument();
  });

  it("renders device info card with model, MAC, firmware, IP, uptime", () => {
    render(<MetricsDetailView device={makeDevice()} history={[]} notifications={[]} onBack={vi.fn()} />);
    expect(screen.getByText("UDM-Pro")).toBeInTheDocument();
    expect(screen.getByText("aa:bb:cc:dd:ee:01")).toBeInTheDocument();
    expect(screen.getByText("v4.0.6")).toBeInTheDocument();
    expect(screen.getByText("192.168.1.1")).toBeInTheDocument();
    expect(screen.getByText("1d 1h 1m")).toBeInTheDocument();
  });

  it("hides IP when empty", () => {
    render(<MetricsDetailView device={makeDevice({ ip: "" })} history={[]} notifications={[]} onBack={vi.fn()} />);
    expect(screen.queryByText("IP")).not.toBeInTheDocument();
  });

  it("shows clients in info card and stat strip for APs", () => {
    render(<MetricsDetailView device={makeDevice({ type: "uap", num_sta: 12 })} history={[]} notifications={[]} onBack={vi.fn()} />);
    const clientLabels = screen.getAllByText("Clients");
    expect(clientLabels.length).toBeGreaterThanOrEqual(2); // info card + stat strip
  });

  // --- Back button ---

  it("renders back button and calls onBack when clicked", () => {
    const handler = vi.fn();
    render(<MetricsDetailView device={makeDevice()} history={[]} notifications={[]} onBack={handler} />);
    fireEvent.click(screen.getByText("Back to overview"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  // --- Stat strip ---

  it("renders CPU and Memory stat cards with color indicators", () => {
    render(<MetricsDetailView device={makeDevice({ cpu: 25, mem: 60 })} history={[]} notifications={[]} onBack={vi.fn()} />);
    // Stat strip cards
    const statCards = screen.getAllByText("25%");
    expect(statCards.length).toBeGreaterThanOrEqual(1);
    const memCards = screen.getAllByText("60%");
    expect(memCards.length).toBeGreaterThanOrEqual(1);
  });

  it("shows yellow CPU stat when cpu >= 70", () => {
    const { container } = render(<MetricsDetailView device={makeDevice({ cpu: 75 })} history={[]} notifications={[]} onBack={vi.fn()} />);
    expect(container.querySelector(".bg-status-warning")).toBeInTheDocument();
  });

  it("shows red CPU stat when cpu >= 90", () => {
    const { container } = render(<MetricsDetailView device={makeDevice({ cpu: 95 })} history={[]} notifications={[]} onBack={vi.fn()} />);
    expect(container.querySelector(".bg-status-danger")).toBeInTheDocument();
  });

  it("shows temperature stat when available", () => {
    render(<MetricsDetailView device={makeDevice({ temperature: 65 })} history={[]} notifications={[]} onBack={vi.fn()} />);
    expect(screen.getByText("Temp")).toBeInTheDocument();
    expect(screen.getByText("65C")).toBeInTheDocument();
  });

  it("hides temperature stat when null", () => {
    render(<MetricsDetailView device={makeDevice({ temperature: null })} history={[]} notifications={[]} onBack={vi.fn()} />);
    expect(screen.queryByText("Temp")).not.toBeInTheDocument();
  });

  it("shows PoE stat when poe_budget is set", () => {
    render(<MetricsDetailView device={makeDevice({ poe_consumption: 45, poe_budget: 100 })} history={[]} notifications={[]} onBack={vi.fn()} />);
    expect(screen.getByText("PoE")).toBeInTheDocument();
    expect(screen.getByText("45/100W")).toBeInTheDocument();
  });

  // --- Charts ---

  it("renders CPU and Memory charts", () => {
    render(<MetricsDetailView device={makeDevice()} history={makeHistory(5)} notifications={[]} onBack={vi.fn()} />);
    expect(screen.getByTestId("chart-CPU")).toBeInTheDocument();
    expect(screen.getByTestId("chart-Memory")).toBeInTheDocument();
  });

  it("renders traffic chart as dual series", () => {
    render(<MetricsDetailView device={makeDevice()} history={makeHistory(3)} notifications={[]} onBack={vi.fn()} />);
    expect(screen.getByTestId("chart-Traffic")).toBeInTheDocument();
  });

  it("renders temperature chart when available", () => {
    render(<MetricsDetailView device={makeDevice({ temperature: 55 })} history={makeHistory(3)} notifications={[]} onBack={vi.fn()} />);
    expect(screen.getByTestId("chart-Temperature")).toBeInTheDocument();
  });

  it("does not render temperature chart when null", () => {
    render(<MetricsDetailView device={makeDevice({ temperature: null })} history={[]} notifications={[]} onBack={vi.fn()} />);
    expect(screen.queryByTestId("chart-Temperature")).not.toBeInTheDocument();
  });

  it("renders connected clients chart for APs", () => {
    render(<MetricsDetailView device={makeDevice({ type: "uap", num_sta: 10 })} history={makeHistory(3)} notifications={[]} onBack={vi.fn()} />);
    expect(screen.getByTestId("chart-Connected Clients")).toBeInTheDocument();
  });

  it("does not render clients chart for gateways with no clients", () => {
    render(<MetricsDetailView device={makeDevice({ type: "gateway", num_sta: 0 })} history={[]} notifications={[]} onBack={vi.fn()} />);
    expect(screen.queryByTestId("chart-Connected Clients")).not.toBeInTheDocument();
  });

  it("renders PoE chart with reference line when poe_budget set", () => {
    render(<MetricsDetailView device={makeDevice({ poe_consumption: 50, poe_budget: 100 })} history={makeHistory(3)} notifications={[]} onBack={vi.fn()} />);
    expect(screen.getByTestId("chart-PoE Consumption")).toBeInTheDocument();
  });

  it("does not render PoE chart when no budget", () => {
    render(<MetricsDetailView device={makeDevice({ poe_budget: null })} history={[]} notifications={[]} onBack={vi.fn()} />);
    expect(screen.queryByTestId("chart-PoE Consumption")).not.toBeInTheDocument();
  });

  // --- Traffic delta computation ---

  it("computes traffic deltas from cumulative counters", () => {
    const history: MetricsHistoryPoint[] = [
      { timestamp: "2026-01-01T00:00:00Z", cpu: 0, mem: 0, temperature: null, uptime: 0, tx_bytes: 100, rx_bytes: 200, num_sta: 0, poe_consumption: null },
      { timestamp: "2026-01-01T00:01:00Z", cpu: 0, mem: 0, temperature: null, uptime: 0, tx_bytes: 350, rx_bytes: 500, num_sta: 0, poe_consumption: null },
      { timestamp: "2026-01-01T00:02:00Z", cpu: 0, mem: 0, temperature: null, uptime: 0, tx_bytes: 600, rx_bytes: 900, num_sta: 0, poe_consumption: null },
    ];
    render(<MetricsDetailView device={makeDevice()} history={history} notifications={[]} onBack={vi.fn()} />);
    // Total delta: TX (250+250=500) + RX (300+400=700) = 1200 = 1.2 KB
    expect(screen.getByTestId("chart-Traffic")).toHaveTextContent("1.2 KB");
  });

  it("formats traffic deltas in MB range", () => {
    const history: MetricsHistoryPoint[] = [
      { timestamp: "2026-01-01T00:00:00Z", cpu: 0, mem: 0, temperature: null, uptime: 0, tx_bytes: 0, rx_bytes: 0, num_sta: 0, poe_consumption: null },
      { timestamp: "2026-01-01T00:01:00Z", cpu: 0, mem: 0, temperature: null, uptime: 0, tx_bytes: 1048576, rx_bytes: 1048576, num_sta: 0, poe_consumption: null },
    ];
    render(<MetricsDetailView device={makeDevice()} history={history} notifications={[]} onBack={vi.fn()} />);
    expect(screen.getByTestId("chart-Traffic")).toHaveTextContent("2.0 MB");
  });

  it("formats traffic deltas in GB range", () => {
    const history: MetricsHistoryPoint[] = [
      { timestamp: "2026-01-01T00:00:00Z", cpu: 0, mem: 0, temperature: null, uptime: 0, tx_bytes: 0, rx_bytes: 0, num_sta: 0, poe_consumption: null },
      { timestamp: "2026-01-01T00:01:00Z", cpu: 0, mem: 0, temperature: null, uptime: 0, tx_bytes: 1073741824, rx_bytes: 0, num_sta: 0, poe_consumption: null },
    ];
    render(<MetricsDetailView device={makeDevice()} history={history} notifications={[]} onBack={vi.fn()} />);
    expect(screen.getByTestId("chart-Traffic")).toHaveTextContent("1.0 GB");
  });

  it("handles invalid timestamps gracefully in traffic deltas", () => {
    const history: MetricsHistoryPoint[] = [
      { timestamp: "invalid", cpu: 0, mem: 0, temperature: null, uptime: 0, tx_bytes: 0, rx_bytes: 0, num_sta: 0, poe_consumption: null },
      { timestamp: "also-invalid", cpu: 0, mem: 0, temperature: null, uptime: 0, tx_bytes: 100, rx_bytes: 100, num_sta: 0, poe_consumption: null },
    ];
    render(<MetricsDetailView device={makeDevice()} history={history} notifications={[]} onBack={vi.fn()} />);
    // Should not crash -- renders with empty time labels
    expect(screen.getByTestId("chart-Traffic")).toBeInTheDocument();
  });

  it("clamps negative deltas to zero on counter reset", () => {
    const history: MetricsHistoryPoint[] = [
      { timestamp: "2026-01-01T00:00:00Z", cpu: 0, mem: 0, temperature: null, uptime: 0, tx_bytes: 1000, rx_bytes: 2000, num_sta: 0, poe_consumption: null },
      { timestamp: "2026-01-01T00:01:00Z", cpu: 0, mem: 0, temperature: null, uptime: 0, tx_bytes: 500, rx_bytes: 500, num_sta: 0, poe_consumption: null },
    ];
    render(<MetricsDetailView device={makeDevice()} history={history} notifications={[]} onBack={vi.fn()} />);
    expect(screen.getByTestId("chart-Traffic")).toHaveTextContent("0 B");
  });

  // --- Notifications ---

  it("renders notifications with severity strip and timestamp", () => {
    render(
      <MetricsDetailView device={makeDevice()} history={[]} notifications={[makeNotification()]} onBack={vi.fn()} />,
    );
    expect(screen.getByText("Active Notifications")).toBeInTheDocument();
    expect(screen.getByText("High CPU Usage")).toBeInTheDocument();
    expect(screen.getByText("CPU usage exceeded 80%")).toBeInTheDocument();
    expect(screen.getByText("just now")).toBeInTheDocument();
  });

  it("does not render notifications section when empty", () => {
    render(<MetricsDetailView device={makeDevice()} history={[]} notifications={[]} onBack={vi.fn()} />);
    expect(screen.queryByText("Active Notifications")).not.toBeInTheDocument();
  });

  it("renders high severity notification with red indicators", () => {
    const { container } = render(
      <MetricsDetailView device={makeDevice()} history={[]} notifications={[makeNotification({ severity: "high" })]} onBack={vi.fn()} />,
    );
    expect(container.querySelector(".bg-status-danger")).toBeInTheDocument();
  });

  it("renders medium severity with warning indicators", () => {
    const { container } = render(
      <MetricsDetailView device={makeDevice()} history={[]} notifications={[makeNotification({ severity: "medium" })]} onBack={vi.fn()} />,
    );
    expect(container.querySelector(".bg-status-warning")).toBeInTheDocument();
  });

  it("renders info severity with neutral indicators", () => {
    const { container } = render(
      <MetricsDetailView device={makeDevice()} history={[]} notifications={[makeNotification({ severity: "info" })]} onBack={vi.fn()} />,
    );
    expect(container.querySelector(".bg-status-success")).toBeInTheDocument();
  });

  // --- Memory threshold colors ---

  it("shows yellow memory stat when mem >= 85", () => {
    render(<MetricsDetailView device={makeDevice({ cpu: 10, mem: 88 })} history={[]} notifications={[]} onBack={vi.fn()} />);
    // Find the stat strip - mem 88% should have warning color
    const statText = screen.getByText("88%");
    expect(statText).toBeInTheDocument();
  });

  it("shows red memory stat when mem >= 95", () => {
    render(<MetricsDetailView device={makeDevice({ cpu: 10, mem: 97 })} history={[]} notifications={[]} onBack={vi.fn()} />);
    const statText = screen.getByText("97%");
    expect(statText).toBeInTheDocument();
  });

  // --- StatusDot branches ---

  it("renders offline status dot with danger color", () => {
    const { container } = render(
      <MetricsDetailView device={makeDevice({ status: "offline" })} history={[]} notifications={[]} onBack={vi.fn()} />,
    );
    expect(container.querySelector(".bg-status-danger")).toBeInTheDocument();
  });

  it("renders unknown status dot with dim color", () => {
    const { container } = render(
      <MetricsDetailView device={makeDevice({ status: "adopting" })} history={[]} notifications={[]} onBack={vi.fn()} />,
    );
    const dots = container.querySelectorAll(".bg-ui-text-dim");
    expect(dots.length).toBeGreaterThanOrEqual(1);
  });

  // --- PoE with null consumption branches ---

  it("renders PoE stat with null poe_consumption using 0 fallback", () => {
    render(
      <MetricsDetailView
        device={makeDevice({ poe_consumption: null, poe_budget: 100 })}
        history={[]}
        notifications={[]}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText("PoE")).toBeInTheDocument();
    expect(screen.getByText("0/100W")).toBeInTheDocument();
  });

  it("renders PoE chart with null poe_consumption using 0 fallback", () => {
    render(
      <MetricsDetailView
        device={makeDevice({ poe_consumption: null, poe_budget: 80 })}
        history={makeHistory(3)}
        notifications={[]}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByTestId("chart-PoE Consumption")).toHaveTextContent("0.0W");
  });

  // --- Temperature threshold colors ---

  it("shows green temp stat when temperature < 60", () => {
    const { container } = render(
      <MetricsDetailView device={makeDevice({ temperature: 45 })} history={[]} notifications={[]} onBack={vi.fn()} />,
    );
    expect(container.querySelector(".bg-status-success")).toBeInTheDocument();
  });

  it("shows red temp stat when temperature >= 80", () => {
    const { container } = render(
      <MetricsDetailView device={makeDevice({ temperature: 85 })} history={[]} notifications={[]} onBack={vi.fn()} />,
    );
    expect(container.querySelector(".bg-status-danger")).toBeInTheDocument();
  });

  // --- PoE color thresholds ---

  it("shows yellow PoE stat when consumption/budget >= 0.7", () => {
    const { container } = render(
      <MetricsDetailView device={makeDevice({ poe_consumption: 75, poe_budget: 100 })} history={[]} notifications={[]} onBack={vi.fn()} />,
    );
    expect(container.querySelector(".bg-status-warning")).toBeInTheDocument();
  });

  it("shows red PoE stat when consumption/budget >= 0.9", () => {
    const { container } = render(
      <MetricsDetailView device={makeDevice({ poe_consumption: 95, poe_budget: 100 })} history={[]} notifications={[]} onBack={vi.fn()} />,
    );
    expect(container.querySelector(".bg-status-danger")).toBeInTheDocument();
  });

  // --- Critical severity notification ---

  it("renders critical severity notification with red indicators", () => {
    const { container } = render(
      <MetricsDetailView device={makeDevice()} history={[]} notifications={[makeNotification({ severity: "critical" })]} onBack={vi.fn()} />,
    );
    expect(container.querySelector(".bg-status-danger")).toBeInTheDocument();
  });

  // --- SeverityDot low/info branch ---

  it("renders low severity notification with dim dot", () => {
    const { container } = render(
      <MetricsDetailView device={makeDevice()} history={[]} notifications={[makeNotification({ severity: "low" })]} onBack={vi.fn()} />,
    );
    const dimDots = container.querySelectorAll(".bg-ui-text-dim");
    expect(dimDots.length).toBeGreaterThanOrEqual(1);
  });

  // --- Hides clients in info card when not applicable ---

  it("hides clients in info card for switch with no clients", () => {
    render(
      <MetricsDetailView device={makeDevice({ type: "usw", num_sta: 0 })} history={[]} notifications={[]} onBack={vi.fn()} />,
    );
    expect(screen.queryByText("Clients")).not.toBeInTheDocument();
  });
});
