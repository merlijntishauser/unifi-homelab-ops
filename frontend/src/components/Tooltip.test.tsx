import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Tooltip from "./Tooltip";

describe("Tooltip", () => {
  it("renders text with tooltip role", () => {
    render(<Tooltip text="Hello" />);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Hello");
  });

  it("centers by default", () => {
    render(<Tooltip text="Centered" />);
    const el = screen.getByRole("tooltip");
    expect(el.className).toContain("left-1/2");
    expect(el.className).toContain("-translate-x-1/2");
  });

  it("aligns left when specified", () => {
    render(<Tooltip text="Left" align="left" />);
    const el = screen.getByRole("tooltip");
    expect(el.className).toContain("left-0");
    expect(el.className).not.toContain("left-1/2");
  });

  it("aligns right when specified", () => {
    render(<Tooltip text="Right" align="right" />);
    const el = screen.getByRole("tooltip");
    expect(el.className).toContain("right-0");
    expect(el.className).not.toContain("left-1/2");
  });
});
