import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ModuleSidebar from "./ModuleSidebar";

function renderSidebar(currentPath = "/firewall", onOpenSettings = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={[currentPath]}>
      <ModuleSidebar onOpenSettings={onOpenSettings} />
    </MemoryRouter>,
  );
}

describe("ModuleSidebar", () => {
  it("renders navigation with all module links", () => {
    renderSidebar();
    const nav = screen.getByRole("navigation", { name: "Module navigation" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByText("Firewall")).toBeInTheDocument();
    expect(screen.getByText("Topology")).toBeInTheDocument();
    expect(screen.getByText("Metrics")).toBeInTheDocument();
    expect(screen.getByText("Health")).toBeInTheDocument();
  });

  it("shows active state on current route", () => {
    renderSidebar("/firewall");
    const firewallLink = screen.getByText("Firewall").closest("a");
    expect(firewallLink?.className).toContain("bg-blue-50");
  });

  it("shows inactive state on non-current routes", () => {
    renderSidebar("/firewall");
    const topologyLink = screen.getByText("Topology").closest("a");
    expect(topologyLink?.className).not.toContain("bg-blue-50");
  });

  it("has correct link targets", () => {
    renderSidebar();
    expect(screen.getByText("Firewall").closest("a")).toHaveAttribute("href", "/firewall");
    expect(screen.getByText("Topology").closest("a")).toHaveAttribute("href", "/topology");
    expect(screen.getByText("Metrics").closest("a")).toHaveAttribute("href", "/metrics");
    expect(screen.getByText("Health").closest("a")).toHaveAttribute("href", "/health");
  });

  it("renders Settings button in bottom section", () => {
    renderSidebar();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("calls onOpenSettings when Settings is clicked", () => {
    const handler = vi.fn();
    renderSidebar("/firewall", handler);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
