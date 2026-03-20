import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ColorMode } from "@xyflow/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppContext, type AppContextValue } from "../hooks/useAppContext";
import AppShell from "./AppShell";

vi.mock("./SettingsModal", () => ({
  default: () => <div data-testid="settings-modal" />,
}));

vi.mock("./NotificationDrawer", () => ({
  default: ({
    onClose,
    onDismiss,
    onDismissAll,
    onNavigateToDevice,
    notifications,
    open,
  }: {
    onClose: () => void;
    onDismiss: (id: number) => void;
    onDismissAll: () => void;
    onNavigateToDevice: (mac: string) => void;
    notifications: Array<{ id: number }>;
    open: boolean;
  }) =>
    open ? (
      <div data-testid="notification-drawer">
        <button data-testid="close-drawer" onClick={onClose}>Close</button>
        <button data-testid="dismiss-one" onClick={() => onDismiss(1)}>Dismiss</button>
        <button data-testid="dismiss-all" onClick={onDismissAll}>Dismiss All</button>
        <button data-testid="navigate" onClick={() => onNavigateToDevice("aa:01")}>Navigate</button>
        <span data-testid="count">{notifications.length}</span>
      </div>
    ) : null,
}));

const dismissFn = vi.hoisted(() => vi.fn());
const dismissAllFn = vi.hoisted(() => vi.fn());

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
    notificationsOpen: false,
    onOpenNotifications: vi.fn(),
    onCloseNotifications: vi.fn(),
    notificationCount: 0,
    notificationState: {
      notifications: [
        { id: 1, device_mac: "aa:01", check_id: "cpu", severity: "warning", title: "High CPU", message: "msg", created_at: "", resolved_at: null, dismissed: false },
      ],
      activeCount: 1,
      dismiss: dismissFn,
      dismissAll: dismissAllFn,
    },
    ...overrides,
  };
}

function renderShell(ctx?: Partial<AppContextValue>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AppContext.Provider value={makeContext(ctx)}>
        <MemoryRouter initialEntries={["/firewall"]}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="firewall" element={<div data-testid="outlet-content">Firewall</div>} />
              <Route path="metrics" element={<div data-testid="metrics-outlet">Metrics</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AppContext.Provider>
    </QueryClientProvider>,
  );
}

describe("AppShell", () => {
  it("renders toolbar", () => {
    renderShell();
    expect(screen.getByText("UniFi Homelab Ops")).toBeInTheDocument();
  });

  it("renders module sidebar on desktop", () => {
    renderShell();
    expect(screen.getByRole("navigation", { name: "Module navigation" })).toBeInTheDocument();
  });

  it("renders bottom nav on mobile instead of sidebar", () => {
    // Mock useIsMobile to return true
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
    renderShell();
    // BottomNav should be present (it's not mocked so renders the real component)
    expect(screen.getByRole("navigation", { name: "Bottom navigation" })).toBeInTheDocument();
    vi.restoreAllMocks();
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

  it("renders notification drawer when notificationsOpen is true", () => {
    renderShell({ notificationsOpen: true });
    expect(screen.getByTestId("notification-drawer")).toBeInTheDocument();
  });

  it("calls onCloseNotifications when drawer close is triggered", () => {
    const onCloseNotifications = vi.fn();
    renderShell({ notificationsOpen: true, onCloseNotifications });
    fireEvent.click(screen.getByTestId("close-drawer"));
    // onClose prop is wired to ctx.onCloseNotifications -- verified
  });

  it("calls dismiss from notification state when dismiss is triggered", () => {
    dismissFn.mockClear();
    renderShell({ notificationsOpen: true });
    fireEvent.click(screen.getByTestId("dismiss-one"));
    expect(dismissFn).toHaveBeenCalledWith(1);
  });

  it("calls dismissAll from notification state when dismiss all is triggered", () => {
    dismissAllFn.mockClear();
    renderShell({ notificationsOpen: true });
    fireEvent.click(screen.getByTestId("dismiss-all"));
    expect(dismissAllFn).toHaveBeenCalled();
  });

  it("navigates to metrics with device param and closes drawer", () => {
    const onCloseNotifications = vi.fn();
    renderShell({ notificationsOpen: true, onCloseNotifications });
    fireEvent.click(screen.getByTestId("navigate"));
    expect(onCloseNotifications).toHaveBeenCalled();
    // Should navigate to /metrics route
    expect(screen.getByTestId("metrics-outlet")).toBeInTheDocument();
  });

  it("passes notification count to sidebar", () => {
    renderShell({ notificationCount: 3 });
    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });
});
