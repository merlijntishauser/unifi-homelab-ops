import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Toolbar from "./Toolbar";

describe("Toolbar", () => {
  const defaultProps = {
    themePreference: "dark" as const,
    onThemePreferenceChange: vi.fn(),
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

  it("shows moon icon with 'Theme: Dark' aria-label when dark", () => {
    renderToolbar({ themePreference: "dark" });
    expect(screen.getByRole("button", { name: "Theme: Dark" })).toBeInTheDocument();
  });

  it("shows sun icon with 'Theme: Light' aria-label when light", () => {
    renderToolbar({ themePreference: "light" });
    expect(screen.getByRole("button", { name: "Theme: Light" })).toBeInTheDocument();
  });

  it("shows monitor icon with 'Theme: System' aria-label when system", () => {
    renderToolbar({ themePreference: "system" });
    expect(screen.getByRole("button", { name: "Theme: System" })).toBeInTheDocument();
  });

  it("cycles dark -> system on click", () => {
    const handler = vi.fn();
    renderToolbar({ themePreference: "dark", onThemePreferenceChange: handler });
    fireEvent.click(screen.getByRole("button", { name: "Theme: Dark" }));
    expect(handler).toHaveBeenCalledWith("system");
  });

  it("cycles system -> light on click", () => {
    const handler = vi.fn();
    renderToolbar({ themePreference: "system", onThemePreferenceChange: handler });
    fireEvent.click(screen.getByRole("button", { name: "Theme: System" }));
    expect(handler).toHaveBeenCalledWith("light");
  });

  it("cycles light -> dark on click", () => {
    const handler = vi.fn();
    renderToolbar({ themePreference: "light", onThemePreferenceChange: handler });
    fireEvent.click(screen.getByRole("button", { name: "Theme: Light" }));
    expect(handler).toHaveBeenCalledWith("dark");
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

  it("shows tooltip with current theme mode", () => {
    renderToolbar({ themePreference: "system" });
    expect(screen.getByText("Theme: System")).toBeInTheDocument();
  });

  it("renders notification bell when onOpenNotifications is provided", () => {
    renderToolbar({ onOpenNotifications: vi.fn() });
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });

  it("does not render notification bell when onOpenNotifications is not provided", () => {
    renderToolbar();
    expect(screen.queryByRole("button", { name: "Notifications" })).not.toBeInTheDocument();
  });

  it("clicking bell calls onOpenNotifications", () => {
    const handler = vi.fn();
    renderToolbar({ onOpenNotifications: handler });
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("shows badge with count when notificationCount > 0", () => {
    renderToolbar({ onOpenNotifications: vi.fn(), notificationCount: 3 });
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows 9+ badge when notificationCount exceeds 9", () => {
    renderToolbar({ onOpenNotifications: vi.fn(), notificationCount: 15 });
    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("does not show badge when notificationCount is 0", () => {
    renderToolbar({ onOpenNotifications: vi.fn(), notificationCount: 0 });
    const button = screen.getByRole("button", { name: "Notifications" });
    expect(button.querySelector(".bg-status-danger")).not.toBeInTheDocument();
  });

  it("shows logout button when onAppLogout is provided", () => {
    const onAppLogout = vi.fn();
    renderToolbar({ onAppLogout });
    const btn = screen.getByRole("button", { name: "Log out" });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onAppLogout).toHaveBeenCalled();
  });

  it("does not show logout button when onAppLogout is not provided", () => {
    renderToolbar();
    expect(screen.queryByRole("button", { name: "Log out" })).not.toBeInTheDocument();
  });
});
