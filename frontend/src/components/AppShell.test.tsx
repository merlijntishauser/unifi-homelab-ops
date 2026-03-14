import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ColorMode } from "@xyflow/react";
import { AppContext, type AppContextValue } from "../hooks/useAppContext";
import AppShell from "./AppShell";

vi.mock("./SettingsModal", () => ({
  default: () => <div data-testid="settings-modal" />,
}));

function makeContext(overrides?: Partial<AppContextValue>): AppContextValue {
  return {
    colorMode: "dark" as ColorMode,
    themePreference: "dark",
    onThemePreferenceChange: vi.fn(),
    showHidden: false,
    onShowHiddenChange: vi.fn(),
    hasHiddenZones: false,
    hasDisabledRules: false,
    onRefresh: vi.fn(),
    dataLoading: false,
    onLogout: vi.fn(),
    onOpenSettings: vi.fn(),
    onCloseSettings: vi.fn(),
    settingsOpen: false,
    connectionInfo: { url: "https://unifi.local", username: "admin", source: "env" as const },
    aiInfo: { configured: false, provider: "", model: "" },
    aiConfigured: false,
    zones: [],
    zonePairs: [],
    filteredZonePairs: [],
    visibleZones: [],
    hiddenZoneIds: new Set<string>(),
    onToggleZone: vi.fn(),
    dataError: null,
    ...overrides,
  };
}

function renderShell(ctx?: Partial<AppContextValue>) {
  return render(
    <AppContext.Provider value={makeContext(ctx)}>
      <MemoryRouter initialEntries={["/firewall"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="firewall" element={<div data-testid="outlet-content">Firewall</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppContext.Provider>,
  );
}

describe("AppShell", () => {
  it("renders toolbar", () => {
    renderShell();
    expect(screen.getByText("UniFi Homelab Ops")).toBeInTheDocument();
  });

  it("renders module sidebar", () => {
    renderShell();
    expect(screen.getByRole("navigation", { name: "Module navigation" })).toBeInTheDocument();
  });

  it("renders outlet content", () => {
    renderShell();
    expect(screen.getByTestId("outlet-content")).toBeInTheDocument();
  });

  it("renders settings modal when settingsOpen is true", () => {
    renderShell({ settingsOpen: true });
    expect(screen.getByTestId("settings-modal")).toBeInTheDocument();
  });

  it("does not render settings modal when settingsOpen is false", () => {
    renderShell({ settingsOpen: false });
    expect(screen.queryByTestId("settings-modal")).not.toBeInTheDocument();
  });
});
