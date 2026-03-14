import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TopologyPlaceholder from "./TopologyPlaceholder";

describe("TopologyPlaceholder", () => {
  it("renders heading and coming soon text", () => {
    render(<TopologyPlaceholder />);
    expect(screen.getByText("Topology")).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });
});
