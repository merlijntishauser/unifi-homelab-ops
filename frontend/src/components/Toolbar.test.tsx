import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Toolbar from "./Toolbar";

describe("Toolbar", () => {
  const defaultProps = {
    colorMode: "light" as const,
    onColorModeChange: vi.fn(),
    onLogout: vi.fn(),
    connectionInfo: { url: "https://unifi.local", username: "admin", source: "runtime" as const },
    aiInfo: { configured: false, provider: "", model: "" },
  };

  function renderToolbar(overrides = {}) {
    return render(<Toolbar {...defaultProps} {...overrides} />);
  }

  it("renders the title", () => {
    renderToolbar();
    expect(screen.getByText("UniFi Homelab Ops")).toBeInTheDocument();
  });

  it("shows 'Dark' button when colorMode is light", () => {
    renderToolbar({ colorMode: "light" });
    expect(screen.getByRole("button", { name: "Dark" })).toBeInTheDocument();
  });

  it("shows 'Light' button when colorMode is dark", () => {
    renderToolbar({ colorMode: "dark" });
    expect(screen.getByRole("button", { name: "Light" })).toBeInTheDocument();
  });

  it("calls onColorModeChange with 'dark' when clicking Dark button", () => {
    const handler = vi.fn();
    renderToolbar({ colorMode: "light", onColorModeChange: handler });
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(handler).toHaveBeenCalledWith("dark");
  });

  it("calls onColorModeChange with 'light' when clicking Light button", () => {
    const handler = vi.fn();
    renderToolbar({ colorMode: "dark", onColorModeChange: handler });
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(handler).toHaveBeenCalledWith("light");
  });

  it("renders Disconnect button", () => {
    renderToolbar();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
  });

  it("calls onLogout when Disconnect is clicked", () => {
    const handler = vi.fn();
    renderToolbar({ onLogout: handler });
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("shows connected Controller badge with tooltip", () => {
    renderToolbar({ connectionInfo: { url: "https://unifi.local", username: "admin", source: "runtime" as const } });
    expect(screen.getByText("Controller")).toBeInTheDocument();
    expect(screen.getByText(/Connected to: https:\/\/unifi\.local/)).toBeInTheDocument();
    expect(screen.getByText(/As: admin/)).toBeInTheDocument();
    expect(screen.getByText(/Config from: runtime/)).toBeInTheDocument();
  });

  it("shows disconnected Controller badge when connectionInfo is null", () => {
    renderToolbar({ connectionInfo: null });
    expect(screen.getByText("Controller")).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
  });

  it("shows active AI badge with provider and model tooltip", () => {
    renderToolbar({ aiInfo: { configured: true, provider: "anthropic", model: "claude-sonnet-4-20250514" } });
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText(/AI LLM: anthropic/)).toBeInTheDocument();
    expect(screen.getByText(/Model: claude-sonnet-4-20250514/)).toBeInTheDocument();
  });

  it("shows inactive AI badge when not configured", () => {
    renderToolbar({ aiInfo: { configured: false, provider: "", model: "" } });
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("Not configured")).toBeInTheDocument();
  });

  it("does not render Settings or Refresh buttons", () => {
    renderToolbar();
    expect(screen.queryByRole("button", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
  });
});
