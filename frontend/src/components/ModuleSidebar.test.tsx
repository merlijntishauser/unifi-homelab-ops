import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ModuleSidebar from "./ModuleSidebar";

function renderSidebar(currentPath = "/firewall") {
  return render(
    <MemoryRouter initialEntries={[currentPath]}>
      <ModuleSidebar />
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
});
