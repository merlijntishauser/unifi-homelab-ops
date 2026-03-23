import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MetricsDetailView from "./MetricsDetailView";
import type { MetricsSnapshot, MetricsHistoryPoint, AppNotification } from "../api/types";

// Mock MetricsChart since recharts doesn't render in jsdom
vi.mock("./MetricsChart", () => ({
  default: ({ label, value }: { label: string; value: string }) => (
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
  it("renders device name and model", () => {
    render(
      <MetricsDetailView device={makeDevice()} history={[]} notifications={[]} onBack={vi.fn()} />,
    );
    expect(screen.getByText("Gateway")).toBeInTheDocument();
    expect(screen.getByText("UDM-Pro")).toBeInTheDocument();
  });

  it("renders back button", () => {
    render(
      <MetricsDetailView device={makeDevice()} history={[]} notifications={[]} onBack={vi.fn()} />,
    );
    expect(screen.getByText("Back to overview")).toBeInTheDocument();
  });

  it("calls onBack when back button is clicked", () => {
    const handler = vi.fn();
    render(
      <MetricsDetailView device={makeDevice()} history={[]} notifications={[]} onBack={handler} />,
    );
    fireEvent.click(screen.getByText("Back to overview"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("shows device metadata", () => {
    render(
      <MetricsDetailView device={makeDevice()} history={[]} notifications={[]} onBack={vi.fn()} />,
    );
    expect(screen.getByText("aa:bb:cc:dd:ee:01")).toBeInTheDocument();
    expect(screen.getByText("v4.0.6")).toBeInTheDocument();
    expect(screen.getByText("Up 1d 1h 1m")).toBeInTheDocument();
  });

  it("renders CPU and Memory chart sections", async () => {
    render(
      <MetricsDetailView device={makeDevice()} history={makeHistory(5)} notifications={[]} onBack={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByTestId("chart-CPU")).toBeInTheDocument());
    expect(screen.getByTestId("chart-Memory")).toBeInTheDocument();
  });

  it("renders temperature chart when temperature is available", async () => {
    render(
      <MetricsDetailView device={makeDevice({ temperature: 55 })} history={makeHistory(3)} notifications={[]} onBack={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByTestId("chart-Temperature")).toBeInTheDocument());
  });

  it("does not render temperature chart when temperature is null", async () => {
    render(
      <MetricsDetailView device={makeDevice({ temperature: null })} history={[]} notifications={[]} onBack={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByTestId("chart-CPU")).toBeInTheDocument());
    expect(screen.queryByTestId("chart-Temperature")).not.toBeInTheDocument();
  });

  it("renders traffic chart section", async () => {
    render(
      <MetricsDetailView device={makeDevice()} history={makeHistory(3)} notifications={[]} onBack={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByTestId("chart-Traffic (TX + RX)")).toBeInTheDocument());
  });

  it("formats bytes correctly in traffic chart value", async () => {
    render(
      <MetricsDetailView
        device={makeDevice({ tx_bytes: 1048576, rx_bytes: 2097152 })}
        history={[]}
        notifications={[]}
        onBack={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId("chart-Traffic (TX + RX)")).toHaveTextContent("3.0 MB"));
  });

  it("renders notifications when present", () => {
    render(
      <MetricsDetailView
        device={makeDevice()}
        history={[]}
        notifications={[makeNotification()]}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText("Active Notifications")).toBeInTheDocument();
    expect(screen.getByText("High CPU Usage")).toBeInTheDocument();
    expect(screen.getByText("CPU usage exceeded 80%")).toBeInTheDocument();
  });

  it("does not render notifications section when empty", () => {
    render(
      <MetricsDetailView device={makeDevice()} history={[]} notifications={[]} onBack={vi.fn()} />,
    );
    expect(screen.queryByText("Active Notifications")).not.toBeInTheDocument();
  });

  it("passes correct values to chart components", async () => {
    render(
      <MetricsDetailView device={makeDevice()} history={makeHistory(5)} notifications={[]} onBack={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByTestId("chart-CPU")).toHaveTextContent("25%"));
    expect(screen.getByTestId("chart-Memory")).toHaveTextContent("60%");
  });

  it("formats bytes as B for small values", async () => {
    render(
      <MetricsDetailView
        device={makeDevice({ tx_bytes: 100, rx_bytes: 200 })}
        history={[]}
        notifications={[]}
        onBack={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId("chart-Traffic (TX + RX)")).toHaveTextContent("300 B"));
  });

  it("formats bytes as KB for medium values", async () => {
    render(
      <MetricsDetailView
        device={makeDevice({ tx_bytes: 2048, rx_bytes: 0 })}
        history={[]}
        notifications={[]}
        onBack={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId("chart-Traffic (TX + RX)")).toHaveTextContent("2.0 KB"));
  });

  it("formats bytes as GB for large values", async () => {
    render(
      <MetricsDetailView
        device={makeDevice({ tx_bytes: 1073741824, rx_bytes: 0 })}
        history={[]}
        notifications={[]}
        onBack={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId("chart-Traffic (TX + RX)")).toHaveTextContent("1.0 GB"));
  });

  it("renders high severity notification with red dot", () => {
    const { container } = render(
      <MetricsDetailView
        device={makeDevice()}
        history={[]}
        notifications={[makeNotification({ severity: "high" })]}
        onBack={vi.fn()}
      />,
    );
    const dangerDot = container.querySelector(".bg-status-danger");
    expect(dangerDot).toBeInTheDocument();
  });

  it("renders medium severity notification with yellow dot", () => {
    const { container } = render(
      <MetricsDetailView
        device={makeDevice()}
        history={[]}
        notifications={[makeNotification({ severity: "medium" })]}
        onBack={vi.fn()}
      />,
    );
    const warningDot = container.querySelector(".bg-status-warning");
    expect(warningDot).toBeInTheDocument();
  });

  it("renders info severity notification with gray dot", () => {
    const { container } = render(
      <MetricsDetailView
        device={makeDevice()}
        history={[]}
        notifications={[makeNotification({ severity: "info" })]}
        onBack={vi.fn()}
      />,
    );
    const grayDot = container.querySelector(".bg-ui-text-dim");
    expect(grayDot).toBeInTheDocument();
  });

  it("passes temperature value to chart", async () => {
    render(
      <MetricsDetailView device={makeDevice({ temperature: 55 })} history={makeHistory(3)} notifications={[]} onBack={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByTestId("chart-Temperature")).toHaveTextContent("55C"));
  });

  it("renders with history that has no temperature", () => {
    const historyNoTemp = makeHistory(3).map((h) => ({ ...h, temperature: null }));
    render(
      <MetricsDetailView
        device={makeDevice({ temperature: null })}
        history={historyNoTemp}
        notifications={[]}
        onBack={vi.fn()}
      />,
    );
    expect(screen.queryByText("Temperature")).not.toBeInTheDocument();
  });
});
