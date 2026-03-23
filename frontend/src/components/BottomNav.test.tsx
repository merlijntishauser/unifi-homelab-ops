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
  it("renders 4 primary nav items and More button", () => {
    renderBottomNav();
    expect(screen.getByText("Health")).toBeInTheDocument();
    expect(screen.getByText("Metrics")).toBeInTheDocument();
    expect(screen.getByText("Topology")).toBeInTheDocument();
    expect(screen.getByText("Firewall")).toBeInTheDocument();
    expect(screen.getByText("More")).toBeInTheDocument();
  });

  it("has correct link targets for primary NavLink items", () => {
    renderBottomNav();
    expect(screen.getByText("Firewall").closest("a")).toHaveAttribute("href", "/firewall");
    expect(screen.getByText("Topology").closest("a")).toHaveAttribute("href", "/topology");
    expect(screen.getByText("Metrics").closest("a")).toHaveAttribute("href", "/metrics");
    expect(screen.getByText("Health").closest("a")).toHaveAttribute("href", "/health");
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

  it("More button opens overflow menu with remaining modules and Settings", () => {
    renderBottomNav();
    expect(screen.queryByText("Docs")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "More" }));

    expect(screen.getByText("Docs")).toBeInTheDocument();
    expect(screen.getByText("Rack Planner")).toBeInTheDocument();
    expect(screen.getByText("Home Assistant")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("overflow menu has correct link targets", () => {
    renderBottomNav();
    fireEvent.click(screen.getByRole("button", { name: "More" }));

    expect(screen.getByText("Docs").closest("a")).toHaveAttribute("href", "/docs");
    expect(screen.getByText("Rack Planner").closest("a")).toHaveAttribute("href", "/rack-planner");
    expect(screen.getByText("Home Assistant").closest("a")).toHaveAttribute("href", "/home-assistant");
  });

  it("calls onOpenSettings when Settings is clicked in overflow menu", () => {
    const handler = vi.fn();
    renderBottomNav("/firewall", handler);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByText("Settings"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("More button has aria-expanded attribute", () => {
    renderBottomNav();
    const moreButton = screen.getByRole("button", { name: "More" });
    expect(moreButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(moreButton);
    expect(moreButton).toHaveAttribute("aria-expanded", "true");
  });

  it("highlights More button when an overflow route is active", () => {
    renderBottomNav("/docs");
    const moreButton = screen.getByRole("button", { name: "More" });
    expect(moreButton.className).toContain("text-ub-blue");
  });

  it("has 4 links and 1 button when menu is closed", () => {
    renderBottomNav();
    const links = screen.getAllByRole("link");
    const buttons = screen.getAllByRole("button");
    expect(links).toHaveLength(4);
    expect(buttons).toHaveLength(1);
  });

  it("closes menu when clicking outside", () => {
    renderBottomNav();
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByText("Docs")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("Docs")).not.toBeInTheDocument();
  });

  it("closes menu when navigating via overflow link", () => {
    renderBottomNav();
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByText("Docs")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Docs"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes menu on second click of More button", () => {
    renderBottomNav();
    const moreButton = screen.getByRole("button", { name: "More" });

    fireEvent.click(moreButton);
    expect(screen.getByText("Docs")).toBeInTheDocument();

    fireEvent.click(moreButton);
    expect(screen.queryByText("Docs")).not.toBeInTheDocument();
  });

  it("highlights active overflow menu item when on overflow route", () => {
    renderBottomNav("/docs");
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    const docsLink = screen.getByText("Docs").closest("a");
    expect(docsLink?.className).toContain("text-ub-blue");
  });

  it("shows inactive overflow menu item when on different route", () => {
    renderBottomNav("/firewall");
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    const docsLink = screen.getByText("Docs").closest("a");
    expect(docsLink?.className).not.toContain("text-ub-blue");
  });
});
