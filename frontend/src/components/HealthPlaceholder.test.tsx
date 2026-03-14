import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HealthPlaceholder from "./HealthPlaceholder";

describe("HealthPlaceholder", () => {
  it("renders heading and coming soon text", () => {
    render(<HealthPlaceholder />);
    expect(screen.getByText("Site Health")).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });
});
