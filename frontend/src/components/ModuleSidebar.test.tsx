import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ModuleSidebar from "./ModuleSidebar";

const mockVersionCheck = vi.hoisted(() => ({
  build: { version: "dev", commit: "", date: "", isDev: true, label: "dev" },
  updateAvailable: null as string | null,
}));

vi.mock("../hooks/useVersionCheck", () => ({
  useVersionCheck: () => mockVersionCheck,
}));

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
    expect(screen.getByText("Docs")).toBeInTheDocument();
    expect(screen.getByText("Rack")).toBeInTheDocument();
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
    expect(screen.getByText("Docs").closest("a")).toHaveAttribute("href", "/docs");
    expect(screen.getByText("Rack").closest("a")).toHaveAttribute("href", "/rack-planner");
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
    expect(links[0]).toHaveAttribute("title", "Health");
  });

  it("links remain clickable when collapsed", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    const links = screen.getAllByRole("link");
    expect(links.length).toBe(7);
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

  it("shows version label in expanded state", () => {
    mockVersionCheck.build = { version: "1.1.0", commit: "abc1234", date: "2026-03-21", isDev: false, label: "v1.1.0 (abc1234, Mar 21, 2026)" };
    mockVersionCheck.updateAvailable = null;
    renderSidebar();
    expect(screen.getByText("v1.1.0 (abc1234, Mar 21, 2026)")).toBeInTheDocument();
  });

  it("shows update available alert when newer version exists", () => {
    mockVersionCheck.build = { version: "1.0.0", commit: "abc", date: "", isDev: false, label: "v1.0.0" };
    mockVersionCheck.updateAvailable = "v1.1.0";
    renderSidebar();
    expect(screen.getByText("v1.1.0 available")).toBeInTheDocument();
  });
});
