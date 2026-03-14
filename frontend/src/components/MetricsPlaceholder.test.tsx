import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import MetricsPlaceholder from "./MetricsPlaceholder";

describe("MetricsPlaceholder", () => {
  it("renders heading and coming soon text", () => {
    render(<MetricsPlaceholder />);
    expect(screen.getByText("Metrics")).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });
});
