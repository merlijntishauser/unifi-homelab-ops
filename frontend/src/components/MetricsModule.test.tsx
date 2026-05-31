import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ColorMode } from "@xyflow/react";
import { AppContext, type AppContextValue } from "../hooks/useAppContext";
import MetricsModule from "./MetricsModule";

vi.mock("./DeviceMetricCard", () => ({
  default: ({ device, onClick }: { device: { mac: string; name: string }; onClick: () => void }) => (
    <div data-testid={`device-card-${device.mac}`}>
      <button type="button" onClick={onClick}>{device.name}</button>
    </div>
  ),
}));

vi.mock("./MetricsDetailView", () => ({
  default: ({ device, onBack }: { device: { name: string }; onBack: () => void }) => (
    <div data-testid="detail-view">
      <span>{device.name}</span>
      <button type="button" onClick={onBack}>Back to overview</button>
    </div>
  ),
}));

vi.mock("./SnoozedDevicesSection", () => ({
  default: ({ devices, onUnsnooze }: { devices: Array<{ mac: string; name: string }>; onUnsnooze: (mac: string) => void }) => (
    <div data-testid="snoozed-devices-section">
      {devices.map((d) => (
        <button key={d.mac} type="button" onClick={() => onUnsnooze(d.mac)}>
          Unsnooze {d.name}
        </button>
      ))}
    </div>
  ),
}));

const devicesMock = vi.hoisted(() => ({
  data: {
    devices: [
      { mac: "aa:01", name: "Gateway", model: "UDM-Pro", type: "gateway", cpu: 12, mem: 45, temperature: 52, uptime: 86400, tx_bytes: 1024, rx_bytes: 2048, num_sta: 5, version: "4.0.6", poe_consumption: null, status: "online" },
      { mac: "aa:02", name: "Switch", model: "USW-24", type: "switch", cpu: 8, mem: 30, temperature: null, uptime: 43200, tx_bytes: 512, rx_bytes: 768, num_sta: 10, version: "7.1.0", poe_consumption: 45.2, status: "online" },
    ],
  } as { devices: Array<Record<string, unknown>> } | undefined,
  isLoading: false,
  error: null as Error | null,
}));

const historyMock = vi.hoisted(() => ({
  data: { mac: "aa:01", history: [] } as { mac: string; history: Array<Record<string, unknown>> } | undefined,
  isLoading: false,
  error: null as Error | null,
}));

const notificationsMock = vi.hoisted(() => ({
  data: [] as Array<Record<string, unknown>> | undefined,
  isLoading: false,
  error: null as Error | null,
}));

const snoozedDevicesMock = vi.hoisted(() => ({
  data: { devices: [] as Array<Record<string, unknown>> },
  isLoading: false,
  error: null as Error | null,
}));

const snoozeMutateMock = vi.hoisted(() => vi.fn());
const unsnoozeMutateMock = vi.hoisted(() => vi.fn());

const snoozeMutationMock = vi.hoisted(() => ({
  mutate: snoozeMutateMock,
  isPending: false,
}));

const unsnoozeMutationMock = vi.hoisted(() => ({
  mutate: unsnoozeMutateMock,
  isPending: false,
}));

vi.mock("../hooks/queries", async () => {
  const actual = await vi.importActual("../hooks/queries");
  return {
    ...actual,
    useMetricsDevices: () => devicesMock,
    useMetricsHistory: () => historyMock,
    useNotifications: () => notificationsMock,
    useSnoozedDevices: () => snoozedDevicesMock,
    useSnoozeDevices: () => snoozeMutationMock,
    useUnsnoozeDevice: () => unsnoozeMutationMock,
  };
});

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
    connectionInfo: { url: "https://unifi.local", username: "admin", source: "runtime" as const },
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
    onAppLogout: null,
    notificationState: { notifications: [], activeCount: 0, dismiss: vi.fn(), dismissAll: vi.fn() },
    ...overrides,
  };
}

function renderModule(ctx?: Partial<AppContextValue>) {
  return render(
    <AppContext.Provider value={makeContext(ctx)}>
      <MemoryRouter>
        <MetricsModule />
      </MemoryRouter>
    </AppContext.Provider>,
  );
}

beforeEach(() => {
  devicesMock.data = {
    devices: [
      { mac: "aa:01", name: "Gateway", model: "UDM-Pro", type: "gateway", cpu: 12, mem: 45, temperature: 52, uptime: 86400, tx_bytes: 1024, rx_bytes: 2048, num_sta: 5, version: "4.0.6", poe_consumption: null, status: "online" },
      { mac: "aa:02", name: "Switch", model: "USW-24", type: "switch", cpu: 8, mem: 30, temperature: null, uptime: 43200, tx_bytes: 512, rx_bytes: 768, num_sta: 10, version: "7.1.0", poe_consumption: 45.2, status: "online" },
    ],
  };
  devicesMock.isLoading = false;
  devicesMock.error = null;
  historyMock.data = { mac: "aa:01", history: [] };
  historyMock.isLoading = false;
  historyMock.error = null;
  notificationsMock.data = [
    { id: 1, device_mac: "aa:01", check_id: "cpu_high", severity: "warning", title: "High CPU", message: "CPU above 80%", created_at: "2026-01-01T00:00:00Z", resolved_at: null, dismissed: false },
  ];
  notificationsMock.isLoading = false;
  notificationsMock.error = null;
  snoozedDevicesMock.data = { devices: [] };
  snoozedDevicesMock.isLoading = false;
  snoozedDevicesMock.error = null;
  snoozeMutateMock.mockClear();
  unsnoozeMutateMock.mockClear();
});

describe("MetricsModule", () => {
  it("renders device cards in grid view", () => {
    renderModule();
    expect(screen.getByTestId("device-card-aa:01")).toBeInTheDocument();
    expect(screen.getByTestId("device-card-aa:02")).toBeInTheDocument();
  });

  it("shows auto-refresh label in toolbar", () => {
    renderModule();
    expect(screen.getByText("Auto-refreshes every 30s")).toBeInTheDocument();
  });

  it("shows loading state when devices are loading", () => {
    devicesMock.data = undefined;
    devicesMock.isLoading = true;
    renderModule();
    expect(screen.getByText("Loading devices…")).toBeInTheDocument();
  });

  it("shows error state when devices query fails", () => {
    devicesMock.data = undefined;
    devicesMock.error = new Error("Connection refused");
    renderModule();
    expect(screen.getByText("Connection refused")).toBeInTheDocument();
  });

  it("shows empty state when no devices found", () => {
    devicesMock.data = { devices: [] };
    renderModule();
    expect(screen.getByText("No devices found")).toBeInTheDocument();
  });

  it("navigates to detail view when device card is clicked", async () => {
    renderModule();
    fireEvent.click(screen.getByText("Gateway"));
    await waitFor(() => {
      expect(screen.getByTestId("detail-view")).toBeInTheDocument();
    });
    expect(screen.getByText("Gateway")).toBeInTheDocument();
  });

  it("returns to grid view when back is clicked in detail view", async () => {
    renderModule();
    fireEvent.click(screen.getByText("Gateway"));
    await waitFor(() => {
      expect(screen.getByTestId("detail-view")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Back to overview"));
    expect(screen.getByTestId("device-card-aa:01")).toBeInTheDocument();
  });

  it("shows error fallback for non-Error objects", () => {
    devicesMock.data = undefined;
    devicesMock.error = { message: "" } as Error;
    renderModule();
    expect(screen.getByText("Failed to load devices")).toBeInTheDocument();
  });

  it("falls back to grid when deep-linked device is not found", () => {
    window.history.replaceState({}, "", "?device=nonexistent");
    renderModule();
    // Should show grid, not detail view
    expect(screen.getByTestId("device-card-aa:01")).toBeInTheDocument();
    expect(screen.queryByTestId("detail-view")).not.toBeInTheDocument();
  });

  it("deep-links to device from URL search param", async () => {
    window.history.replaceState({}, "", "?device=aa:01");
    renderModule();
    await waitFor(() => {
      expect(screen.getByTestId("detail-view")).toBeInTheDocument();
    });
    expect(screen.getByText("Gateway")).toBeInTheDocument();
    // URL should be cleaned
    expect(window.location.search).toBe("");
  });

  it("falls back to null when selectedMac set but device not in devices list", async () => {
    // Click to select a device, then change the devices list so it no longer contains it
    renderModule();
    // Select device aa:01
    fireEvent.click(screen.getByText("Gateway"));
    await waitFor(() => {
      expect(screen.getByTestId("detail-view")).toBeInTheDocument();
    });
    // Now remove the device from the list -- selectedMac is still "aa:01" but find returns undefined
    devicesMock.data = {
      devices: [
        { mac: "aa:02", name: "Switch", model: "USW-24", type: "switch", cpu: 8, mem: 30, temperature: null, uptime: 43200, tx_bytes: 512, rx_bytes: 768, num_sta: 10, version: "7.1.0", poe_consumption: 45.2, status: "online" },
      ],
    };
    // Re-render to pick up new devices list
    fireEvent.click(screen.getByText("Back to overview"));
    expect(screen.getByTestId("device-card-aa:02")).toBeInTheDocument();
  });

  it("shows 'Snooze offline (N)' button when there are offline devices", () => {
    devicesMock.data = {
      devices: [
        { mac: "aa:01", name: "Gateway", model: "UDM-Pro", type: "gateway", cpu: 12, mem: 45, temperature: 52, uptime: 86400, tx_bytes: 1024, rx_bytes: 2048, num_sta: 5, version: "4.0.6", poe_consumption: null, status: "offline" },
        { mac: "aa:02", name: "Switch", model: "USW-24", type: "switch", cpu: 8, mem: 30, temperature: null, uptime: 43200, tx_bytes: 512, rx_bytes: 768, num_sta: 10, version: "7.1.0", poe_consumption: 45.2, status: "online" },
      ],
    };
    renderModule();
    expect(screen.getByRole("button", { name: "Snooze offline (1)" })).toBeInTheDocument();
  });

  it("bulk snooze button calls mutate with all offline devices", () => {
    devicesMock.data = {
      devices: [
        { mac: "aa:01", name: "Gateway", model: "UDM-Pro", type: "gateway", cpu: 12, mem: 45, temperature: 52, uptime: 86400, tx_bytes: 1024, rx_bytes: 2048, num_sta: 5, version: "4.0.6", poe_consumption: null, status: "offline" },
        { mac: "aa:02", name: "Switch", model: "USW-24", type: "switch", cpu: 8, mem: 30, temperature: null, uptime: 43200, tx_bytes: 512, rx_bytes: 768, num_sta: 10, version: "7.1.0", poe_consumption: 45.2, status: "online" },
      ],
    };
    renderModule();
    fireEvent.click(screen.getByRole("button", { name: "Snooze offline (1)" }));
    expect(snoozeMutateMock).toHaveBeenCalledWith([{ mac: "aa:01", name: "Gateway", model: "UDM-Pro" }]);
  });

  it("does not show bulk snooze button when all devices are online", () => {
    renderModule();
    expect(screen.queryByRole("button", { name: /Snooze offline/ })).not.toBeInTheDocument();
  });

  it("shows per-card snooze button for offline devices", () => {
    devicesMock.data = {
      devices: [
        { mac: "aa:01", name: "Gateway", model: "UDM-Pro", type: "gateway", cpu: 12, mem: 45, temperature: 52, uptime: 86400, tx_bytes: 1024, rx_bytes: 2048, num_sta: 5, version: "4.0.6", poe_consumption: null, status: "offline" },
        { mac: "aa:02", name: "Switch", model: "USW-24", type: "switch", cpu: 8, mem: 30, temperature: null, uptime: 43200, tx_bytes: 512, rx_bytes: 768, num_sta: 10, version: "7.1.0", poe_consumption: 45.2, status: "online" },
      ],
    };
    renderModule();
    expect(screen.getByRole("button", { name: "Snooze Gateway" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Snooze Switch" })).not.toBeInTheDocument();
  });

  it("per-card snooze button calls mutate with that device", () => {
    devicesMock.data = {
      devices: [
        { mac: "aa:01", name: "Gateway", model: "UDM-Pro", type: "gateway", cpu: 12, mem: 45, temperature: 52, uptime: 86400, tx_bytes: 1024, rx_bytes: 2048, num_sta: 5, version: "4.0.6", poe_consumption: null, status: "offline" },
        { mac: "aa:02", name: "Switch", model: "USW-24", type: "switch", cpu: 8, mem: 30, temperature: null, uptime: 43200, tx_bytes: 512, rx_bytes: 768, num_sta: 10, version: "7.1.0", poe_consumption: 45.2, status: "online" },
      ],
    };
    renderModule();
    fireEvent.click(screen.getByRole("button", { name: "Snooze Gateway" }));
    expect(snoozeMutateMock).toHaveBeenCalledWith([{ mac: "aa:01", name: "Gateway", model: "UDM-Pro" }]);
  });

  it("renders SnoozedDevicesSection with snoozed devices", () => {
    snoozedDevicesMock.data = {
      devices: [
        { mac: "bb:01", name: "OldAP", model: "UAP-AC", snoozed_at: "2026-01-01T00:00:00Z" },
      ],
    };
    renderModule();
    expect(screen.getByTestId("snoozed-devices-section")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unsnooze OldAP" })).toBeInTheDocument();
  });

  it("unsnooze calls unsnoozeMutate with device mac", () => {
    snoozedDevicesMock.data = {
      devices: [
        { mac: "bb:01", name: "OldAP", model: "UAP-AC", snoozed_at: "2026-01-01T00:00:00Z" },
      ],
    };
    renderModule();
    fireEvent.click(screen.getByRole("button", { name: "Unsnooze OldAP" }));
    expect(unsnoozeMutateMock).toHaveBeenCalledWith("bb:01");
  });

  it("per-card snooze uses mac as label fallback when name is empty", () => {
    devicesMock.data = {
      devices: [
        { mac: "aa:01", name: "", model: "UDM-Pro", type: "gateway", cpu: 12, mem: 45, temperature: 52, uptime: 86400, tx_bytes: 1024, rx_bytes: 2048, num_sta: 5, version: "4.0.6", poe_consumption: null, status: "offline" },
      ],
    };
    renderModule();
    expect(screen.getByRole("button", { name: "Snooze aa:01" })).toBeInTheDocument();
  });
});
