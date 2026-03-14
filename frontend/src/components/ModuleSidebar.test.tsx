import { describe, it, expect, vi, beforeEach } from "vitest";
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

beforeEach(() => {
  try { localStorage.clear(); } catch { /* noop */ }
});

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

  it("renders Settings button", () => {
    renderSidebar();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });

  it("calls onOpenSettings when Settings is clicked", () => {
    const handler = vi.fn();
    renderSidebar("/firewall", handler);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("starts expanded by default", () => {
    renderSidebar();
    expect(screen.getByText("Firewall")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });

  it("collapses when toggle is clicked", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
    expect(screen.queryByText("Firewall")).not.toBeInTheDocument();
  });

  it("expands when toggle is clicked again", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(screen.getByText("Firewall")).toBeInTheDocument();
  });

  it("persists collapsed state in localStorage", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(localStorage.getItem("sidebarExpanded")).toBe("false");
  });

  it("shows tooltips on links when collapsed", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("title", "Firewall");
  });

  it("links remain clickable when collapsed", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    const links = screen.getAllByRole("link");
    expect(links.length).toBe(4);
    for (const link of links) {
      expect(link).toHaveAttribute("href");
    }
  });
});
