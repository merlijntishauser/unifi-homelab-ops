import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import MetricsChart from "./MetricsChart";
import type { ChartDatum } from "./MetricsChart";

// Track props passed to mocked recharts components via mutable ref objects
const captured = { yAxisProps: {} as Record<string, unknown>, tooltipProps: {} as Record<string, unknown> };

vi.mock("recharts", () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: (props: Record<string, unknown>) => {
    Object.assign(captured.yAxisProps, props);
    return <div data-testid="y-axis" />;
  },
  Tooltip: (props: Record<string, unknown>) => {
    Object.assign(captured.tooltipProps, props);
    return <div data-testid="tooltip" />;
  },
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
}));

const sampleData: ChartDatum[] = [
  { time: "12:00", value: 100 },
  { time: "12:05", value: 200 },
  { time: "12:10", value: 300 },
];

describe("MetricsChart", () => {
  beforeEach(() => {
    captured.yAxisProps = {};
    captured.tooltipProps = {};
  });

  it("shows loading spinner initially", () => {
    const { container } = render(
      <MetricsChart label="CPU" value="42%" data={sampleData} color="#006fff" unit="%" />,
    );
    // The spinner has the animate-spin class
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders label and value text after recharts loads", async () => {
    render(<MetricsChart label="CPU" value="42%" data={sampleData} color="#006fff" unit="%" />);
    expect(await screen.findByText("CPU")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
  });

  it("renders the recharts components after loading", async () => {
    render(<MetricsChart label="Memory" value="8 GB" data={sampleData} color="#ff0000" unit="bytes" />);
    expect(await screen.findByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
    expect(screen.getByTestId("area")).toBeInTheDocument();
    expect(screen.getByTestId("x-axis")).toBeInTheDocument();
    expect(screen.getByTestId("y-axis")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip")).toBeInTheDocument();
    expect(screen.getByTestId("cartesian-grid")).toBeInTheDocument();
  });

  describe("YAxis tickFormatter (formatAxisValue / formatBytes)", () => {
    it("formats bytes values", async () => {
      render(<MetricsChart label="Traffic" value="1.5 MB" data={sampleData} color="#00ff00" unit="bytes" />);
      await screen.findByTestId("y-axis");

      const tickFormatter = captured.yAxisProps.tickFormatter as (v: number) => string;
      expect(tickFormatter).toBeDefined();

      // formatBytes: < 1024
      expect(tickFormatter(500)).toBe("500 B");
      // formatBytes: KB range
      expect(tickFormatter(2048)).toBe("2.0 KB");
      // formatBytes: MB range
      expect(tickFormatter(1048576)).toBe("1.0 MB");
      // formatBytes: GB range
      expect(tickFormatter(1073741824)).toBe("1.0 GB");
    });

    it("formats celsius values", async () => {
      render(<MetricsChart label="Temp" value="45C" data={sampleData} color="#ff6600" unit="C" />);
      await screen.findByTestId("y-axis");

      const tickFormatter = captured.yAxisProps.tickFormatter as (v: number) => string;
      expect(tickFormatter(45.7)).toBe("46C");
    });

    it("formats percentage values", async () => {
      render(<MetricsChart label="CPU" value="42%" data={sampleData} color="#006fff" unit="%" />);
      await screen.findByTestId("y-axis");

      const tickFormatter = captured.yAxisProps.tickFormatter as (v: number) => string;
      expect(tickFormatter(42.3)).toBe("42%");
    });
  });

  describe("Tooltip formatter (formatAxisValue / formatBytes)", () => {
    it("formats tooltip values using the unit", async () => {
      render(<MetricsChart label="Traffic" value="1 MB" data={sampleData} color="#00ff00" unit="bytes" />);
      await screen.findByTestId("tooltip");

      const formatter = captured.tooltipProps.formatter as (v: unknown) => [string, string];
      expect(formatter).toBeDefined();

      const [formatted, lbl] = formatter(2048);
      expect(formatted).toBe("2.0 KB");
      expect(lbl).toBe("Traffic");
    });

    it("handles null/undefined tooltip values", async () => {
      render(<MetricsChart label="Temp" value="0C" data={sampleData} color="#ff0000" unit="C" />);
      await screen.findByTestId("tooltip");

      const formatter = captured.tooltipProps.formatter as (v: unknown) => [string, string];
      const [formatted] = formatter(null);
      expect(formatted).toBe("0C");

      const [formatted2] = formatter(undefined);
      expect(formatted2).toBe("0C");
    });
  });

  it("renders with empty data array", async () => {
    render(<MetricsChart label="Empty" value="0" data={[]} color="#ccc" unit="%" />);
    expect(await screen.findByText("Empty")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("removes the spinner once recharts loads", async () => {
    const { container } = render(
      <MetricsChart label="CPU" value="42%" data={sampleData} color="#006fff" unit="%" />,
    );
    await screen.findByTestId("area-chart");
    await waitFor(() => {
      expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
    });
  });
});
