import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Sparkline from "./Sparkline";

describe("Sparkline", () => {
  it("renders an SVG element", () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders a polyline with the correct stroke color", () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} color="#ff0000" />);
    const polyline = container.querySelector("polyline");
    expect(polyline).toHaveAttribute("stroke", "#ff0000");
  });

  it("uses default ub-blue color", () => {
    const { container } = render(<Sparkline data={[5, 10]} />);
    const polyline = container.querySelector("polyline");
    expect(polyline).toHaveAttribute("stroke", "#006fff");
  });

  it("renders flat line at mid-height for empty data", () => {
    const { container } = render(<Sparkline data={[]} height={24} width={80} />);
    const polyline = container.querySelector("polyline");
    expect(polyline?.getAttribute("points")).toBe("0,12 80,12");
  });

  it("renders flat line at mid-height when all values are the same", () => {
    const { container } = render(<Sparkline data={[5, 5, 5]} height={24} width={80} />);
    const polyline = container.querySelector("polyline");
    const points = polyline?.getAttribute("points") ?? "";
    // All y values should be at mid-height (12)
    const yValues = points.split(" ").map((p) => parseFloat(p.split(",")[1]));
    for (const y of yValues) {
      expect(y).toBe(12);
    }
  });

  it("applies custom width and height", () => {
    const { container } = render(<Sparkline data={[1, 2]} width={100} height={30} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 100 30");
    expect(svg).toHaveAttribute("width", "100");
    expect(svg).toHaveAttribute("height", "30");
  });

  it("applies className to SVG", () => {
    const { container } = render(<Sparkline data={[1]} className="my-spark" />);
    const svg = container.querySelector("svg");
    expect(svg?.className.baseVal).toContain("my-spark");
  });

  it("is hidden from accessibility tree", () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("normalizes data across the height range", () => {
    const { container } = render(<Sparkline data={[0, 100]} height={24} width={80} />);
    const polyline = container.querySelector("polyline");
    const points = polyline?.getAttribute("points") ?? "";
    const parts = points.split(" ");
    expect(parts.length).toBe(2);
    // First point (0) should be near bottom, second point (100) near top
    const y1 = parseFloat(parts[0].split(",")[1]);
    const y2 = parseFloat(parts[1].split(",")[1]);
    expect(y1).toBeGreaterThan(y2);
  });

  it("handles single data point", () => {
    const { container } = render(<Sparkline data={[50]} width={80} height={24} />);
    const polyline = container.querySelector("polyline");
    const points = polyline?.getAttribute("points") ?? "";
    expect(points.split(" ").length).toBe(1);
  });
});
