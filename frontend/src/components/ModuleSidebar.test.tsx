import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ModuleSidebar from "./ModuleSidebar";

function renderSidebar(
  currentPath = "/firewall",
  onOpenSettings = vi.fn(),
  extra?: { notificationCount?: number; onOpenNotifications?: () => void },
) {
  return render(
    <MemoryRouter initialEntries={[currentPath]}>
      <ModuleSidebar
        onOpenSettings={onOpenSettings}
        notificationCount={extra?.notificationCount}
        onOpenNotifications={extra?.onOpenNotifications}
      />
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

  it("renders Notifications button when onOpenNotifications is provided", () => {
    renderSidebar("/firewall", vi.fn(), { onOpenNotifications: vi.fn() });
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });

  it("does not render Notifications button when onOpenNotifications is not provided", () => {
    renderSidebar();
    expect(screen.queryByRole("button", { name: "Notifications" })).not.toBeInTheDocument();
  });

  it("calls onOpenNotifications when Notifications button is clicked", () => {
    const handler = vi.fn();
    renderSidebar("/firewall", vi.fn(), { onOpenNotifications: handler });
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("shows notification badge when count > 0", () => {
    renderSidebar("/firewall", vi.fn(), { notificationCount: 3, onOpenNotifications: vi.fn() });
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows 9+ for counts above 9", () => {
    renderSidebar("/firewall", vi.fn(), { notificationCount: 15, onOpenNotifications: vi.fn() });
    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("does not show badge when count is 0", () => {
    renderSidebar("/firewall", vi.fn(), { notificationCount: 0, onOpenNotifications: vi.fn() });
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
