import { describe, it, expect } from "vitest";
import { getActionColor, getEdgeColor } from "./edgeColor";

describe("getActionColor", () => {
  it("returns green for ALLOW", () => {
    expect(getActionColor("ALLOW")).toBe("#00d68f");
  });

  it("returns red for BLOCK", () => {
    expect(getActionColor("BLOCK")).toBe("#ff4d5e");
  });

  it("returns red for REJECT", () => {
    expect(getActionColor("REJECT")).toBe("#ff4d5e");
  });

  it("returns red for unknown action", () => {
    expect(getActionColor("OTHER")).toBe("#ff4d5e");
  });
});

describe("getEdgeColor", () => {
  it("returns green when only allows", () => {
    expect(getEdgeColor(3, 0)).toBe("#00d68f");
  });

  it("returns red when only blocks", () => {
    expect(getEdgeColor(0, 2)).toBe("#ff4d5e");
  });

  it("returns amber when mixed", () => {
    expect(getEdgeColor(1, 1)).toBe("#ffaa2c");
  });

  it("returns amber when both zero", () => {
    expect(getEdgeColor(0, 0)).toBe("#ffaa2c");
  });
});
