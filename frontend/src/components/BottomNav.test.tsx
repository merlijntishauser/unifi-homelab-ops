import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BottomNav from "./BottomNav";

function renderBottomNav(
  currentPath = "/firewall",
  onOpenSettings = vi.fn(),
) {
  return {
    onOpenSettings,
    ...render(
      <MemoryRouter initialEntries={[currentPath]}>
        <BottomNav onOpenSettings={onOpenSettings} />
      </MemoryRouter>,
    ),
  };
}

describe("BottomNav", () => {
  it("renders all 5 nav items", () => {
    renderBottomNav();
    expect(screen.getByText("Firewall")).toBeInTheDocument();
    expect(screen.getByText("Topology")).toBeInTheDocument();
    expect(screen.getByText("Metrics")).toBeInTheDocument();
    expect(screen.getByText("Health")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("has correct link targets for NavLink items", () => {
    renderBottomNav();
    expect(screen.getByText("Firewall").closest("a")).toHaveAttribute("href", "/firewall");
    expect(screen.getByText("Topology").closest("a")).toHaveAttribute("href", "/topology");
    expect(screen.getByText("Metrics").closest("a")).toHaveAttribute("href", "/metrics");
    expect(screen.getByText("Health").closest("a")).toHaveAttribute("href", "/health");
  });

  it("renders Settings as a button, not a link", () => {
    renderBottomNav();
    const settingsButton = screen.getByRole("button", { name: "Settings" });
    expect(settingsButton).toBeInTheDocument();
    expect(settingsButton.closest("a")).toBeNull();
  });

  it("calls onOpenSettings when Settings is clicked", () => {
    const handler = vi.fn();
    renderBottomNav("/firewall", handler);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("shows active state on current route", () => {
    renderBottomNav("/firewall");
    const firewallLink = screen.getByText("Firewall").closest("a");
    expect(firewallLink?.className).toContain("text-ub-blue");
  });

  it("shows inactive state on non-current routes", () => {
    renderBottomNav("/firewall");
    const topologyLink = screen.getByText("Topology").closest("a");
    expect(topologyLink?.className).not.toContain("text-ub-blue");
    expect(topologyLink?.className).toContain("text-ui-text-dim");
  });

  it("renders a nav element with correct aria label", () => {
    renderBottomNav();
    expect(screen.getByRole("navigation", { name: "Bottom navigation" })).toBeInTheDocument();
  });

  it("all items have text labels", () => {
    renderBottomNav();
    const labels = ["Firewall", "Topology", "Metrics", "Health", "Settings"];
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("has 4 links and 1 button", () => {
    renderBottomNav();
    const links = screen.getAllByRole("link");
    const buttons = screen.getAllByRole("button");
    expect(links).toHaveLength(4);
    expect(buttons).toHaveLength(1);
  });
});
