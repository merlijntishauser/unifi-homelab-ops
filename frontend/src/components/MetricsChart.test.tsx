import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import MetricsChart from "./MetricsChart";

// Store captured props from mock recharts components
const capturedProps: Record<string, Record<string, unknown>> = {};

function mockComponent(name: string) {
  return function MockComp(props: Record<string, unknown>) {
    capturedProps[name] = props;
    return <div data-testid={`recharts-${name}`}>{props.children as React.ReactNode}</div>;
  };
}

vi.mock("recharts", () => ({
  AreaChart: mockComponent("AreaChart"),
  Area: mockComponent("Area"),
  XAxis: mockComponent("XAxis"),
  YAxis: mockComponent("YAxis"),
  Tooltip: mockComponent("Tooltip"),
  CartesianGrid: mockComponent("CartesianGrid"),
  ReferenceLine: mockComponent("ReferenceLine"),
  Legend: mockComponent("Legend"),
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div style={{ width: 400, height: 120 }}>{children}</div>
  ),
}));

beforeEach(() => {
  for (const key of Object.keys(capturedProps)) delete capturedProps[key];
});

describe("MetricsChart", () => {
  it("shows loading spinner initially", () => {
    const { container } = render(
      <MetricsChart label="CPU" value="25%" data={[]} color="#006fff" unit="%" />,
    );
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders chart after recharts loads", async () => {
    render(
      <MetricsChart label="CPU" value="25%" data={[{ time: "08:00", value: 25 }]} color="#006fff" unit="%" />,
    );
    await waitFor(() => expect(screen.getByText("CPU")).toBeInTheDocument());
    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  it("renders reference line when provided", async () => {
    render(
      <MetricsChart label="PoE" value="50W" data={[]} color="#f59e0b" unit="W" referenceLine={100} referenceLabel="Budget 100W" />,
    );
    await waitFor(() => expect(screen.getByTestId("recharts-ReferenceLine")).toBeInTheDocument());
  });

  it("does not render reference line when not provided", async () => {
    render(
      <MetricsChart label="CPU" value="25%" data={[]} color="#006fff" unit="%" />,
    );
    await waitFor(() => expect(screen.getByText("CPU")).toBeInTheDocument());
    expect(screen.queryByTestId("recharts-ReferenceLine")).not.toBeInTheDocument();
  });

  it("renders reference line with empty label when referenceLabel is omitted", async () => {
    render(
      <MetricsChart label="PoE" value="50W" data={[]} color="#f59e0b" unit="W" referenceLine={100} />,
    );
    await waitFor(() => expect(capturedProps["ReferenceLine"]).toBeDefined());
    const label = capturedProps["ReferenceLine"].label as { value: string };
    expect(label.value).toBe("");
  });

  it("passes tickFormatter that formats bytes", async () => {
    render(
      <MetricsChart label="Traffic" value="1 MB" data={[]} color="#00d68f" unit="bytes" />,
    );
    await waitFor(() => expect(capturedProps["YAxis"]).toBeDefined());
    const formatter = capturedProps["YAxis"].tickFormatter as (v: number) => string;
    expect(formatter(0)).toBe("0 B");
    expect(formatter(1024)).toBe("1.0 KB");
    expect(formatter(1048576)).toBe("1.0 MB");
    expect(formatter(1073741824)).toBe("1.0 GB");
  });

  it("passes tickFormatter that formats celsius", async () => {
    render(
      <MetricsChart label="Temp" value="52C" data={[]} color="#ffaa2c" unit="C" />,
    );
    await waitFor(() => expect(capturedProps["YAxis"]).toBeDefined());
    const formatter = capturedProps["YAxis"].tickFormatter as (v: number) => string;
    expect(formatter(52)).toBe("52C");
  });

  it("passes tickFormatter that formats percentages", async () => {
    render(
      <MetricsChart label="CPU" value="25%" data={[]} color="#006fff" unit="%" />,
    );
    await waitFor(() => expect(capturedProps["YAxis"]).toBeDefined());
    const formatter = capturedProps["YAxis"].tickFormatter as (v: number) => string;
    expect(formatter(25)).toBe("25%");
  });
  it("passes Tooltip formatter that handles null values", async () => {
    render(<MetricsChart label="CPU" value="25%" data={[]} color="#006fff" unit="%" />);
    await waitFor(() => expect(capturedProps["Tooltip"]).toBeDefined());
    const formatter = capturedProps["Tooltip"].formatter as (v: unknown) => [string, string];
    expect(formatter(null)).toEqual(["0%", "CPU"]);
    expect(formatter(undefined)).toEqual(["0%", "CPU"]);
    expect(formatter(42)).toEqual(["42%", "CPU"]);
  });
});

