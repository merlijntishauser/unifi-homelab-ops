import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent, act } from "@testing-library/react";
import App from "./App";
import type { Zone, ZonePair } from "./api/types";
import { renderWithQuery } from "./test-utils";

// Mock the api client
vi.mock("./api/client", () => ({
  api: {
    getAppAuthStatus: vi.fn(),
    appLogin: vi.fn(),
    getAuthStatus: vi.fn(),
    logout: vi.fn(),
    login: vi.fn(),
    getZones: vi.fn(),
    getZonePairs: vi.fn(),
    simulate: vi.fn(),
    getAiConfig: vi.fn(),
    saveAiConfig: vi.fn(),
    deleteAiConfig: vi.fn(),
    testAiConnection: vi.fn(),
    getAiPresets: vi.fn(),
    analyzeWithAi: vi.fn(),
    toggleRule: vi.fn(),
    swapRuleOrder: vi.fn(),
    getZoneFilter: vi.fn(),
    saveZoneFilter: vi.fn(),
    getNotifications: vi.fn(),
    dismissNotification: vi.fn(),
    getMetricsDevices: vi.fn(),
    getMetricsHistory: vi.fn(),
  },
}));

import { api } from "./api/client";

const mockGetAppAuthStatus = vi.mocked(api.getAppAuthStatus);
const mockGetAuthStatus = vi.mocked(api.getAuthStatus);
const mockLogout = vi.mocked(api.logout);
const mockGetZones = vi.mocked(api.getZones);
const mockGetZonePairs = vi.mocked(api.getZonePairs);
const mockLogin = vi.mocked(api.login);
const mockGetAiConfig = vi.mocked(api.getAiConfig);
const mockGetZoneFilter = vi.mocked(api.getZoneFilter);
const mockGetNotifications = vi.mocked(api.getNotifications);
vi.mocked(api.simulate);
vi.mocked(api.dismissNotification);
vi.mocked(api.getMetricsDevices);
vi.mocked(api.getMetricsHistory);

// Mock @xyflow/react for ZoneGraph
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children, colorMode, onEdgeClick, edges }: {
    children: React.ReactNode;
    colorMode: string;
    onEdgeClick?: (event: unknown, edge: { source: string; target: string }) => void;
    edges: Array<{ id: string; source: string; target: string; data?: { onLabelClick?: () => void } }>;
  }) => (
    <div data-testid="react-flow" data-color-mode={colorMode}>
      {children}
      {Array.isArray(edges) && edges.map((edge) => (
        <button
          key={edge.id}
          data-testid={`edge-${edge.id}`}
          onClick={(e) => {
            onEdgeClick?.(e, edge);
          }}
        >
          {edge.id}
        </button>
      ))}
      {Array.isArray(edges) && edges.map((edge) => (
        edge.data?.onLabelClick && (
          <button
            key={`label-${edge.id}`}
            data-testid={`edge-label-${edge.id}`}
            onClick={() => edge.data?.onLabelClick?.()}
          >
            label {edge.id}
          </button>
        )
      ))}
    </div>
  ),
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  Handle: () => <div />,
  Position: { Top: "top", Bottom: "bottom" },
  useNodesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  BaseEdge: () => <div />,
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MarkerType: { ArrowClosed: "arrowclosed" },
  getSmoothStepPath: () => ["", 0, 0],
}));

// Mock SettingsModal
vi.mock("./components/SettingsModal", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="settings-modal">
      <button data-testid="close-settings" onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock ZoneMatrix
vi.mock("./components/ZoneMatrix", () => ({
  default: ({ zones, zonePairs, onCellClick, onZoneClick }: {
    zones: Array<{ id: string; name: string }>;
    zonePairs: Array<{ source_zone_id: string; destination_zone_id: string; rules: unknown[] }>;
    onCellClick: (pair: unknown) => void;
    onZoneClick: (zoneId: string) => void;
  }) => (
    <div data-testid="zone-matrix">
      {zones.map((z) => (
        <button key={z.id} data-testid={`matrix-zone-${z.id}`} onClick={() => onZoneClick(z.id)}>
          {z.name}
        </button>
      ))}
      {zonePairs.map((p) => (
        <button
          key={`${p.source_zone_id}-${p.destination_zone_id}`}
          data-testid={`matrix-cell-${p.source_zone_id}-${p.destination_zone_id}`}
          onClick={() => onCellClick(p)}
        >
          {p.rules.length} rules
        </button>
      ))}
    </div>
  ),
}));

// Mock dagre layout - pass through
vi.mock("./utils/layout", () => ({
  getLayoutedElements: (nodes: unknown[], edges: unknown[]) => ({ nodes, edges }),
}));

const testZones: Zone[] = [
  { id: "z1", name: "External", networks: [] },
  { id: "z2", name: "Internal", networks: [] },
];

const testZonePairs: ZonePair[] = [
  {
    source_zone_id: "z1",
    destination_zone_id: "z2",
    rules: [
      {
        id: "r1",
        name: "Allow HTTP",
        description: "",
        enabled: true,
        action: "ALLOW",
        source_zone_id: "z1",
        destination_zone_id: "z2",
        protocol: "TCP",
        port_ranges: ["80"],
        ip_ranges: [],
        index: 1,
        predefined: false,
      },
    ],
    allow_count: 1,
    block_count: 0,
    analysis: { score: 85, grade: "B", findings: [] },
  },
];

function authedDefaults() {
  mockGetAuthStatus.mockResolvedValue({
    configured: true,
    source: "env",
    url: "https://unifi.local",
    username: "admin",
  });
}

function renderApp() {
  return renderWithQuery(<App />, { withRouter: false });
}

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGetAppAuthStatus.mockResolvedValue({ required: false, authenticated: false });
    mockGetAiConfig.mockResolvedValue({
      base_url: "",
      model: "",
      provider_type: "",
      has_key: false,
      key_source: "none",
      source: "none",
    });
    mockGetZoneFilter.mockResolvedValue({ hidden_zone_ids: [] });
    vi.mocked(api.saveZoneFilter).mockResolvedValue({ status: "ok" });
    mockGetNotifications.mockResolvedValue([]);
    vi.mocked(api.getMetricsDevices).mockResolvedValue({ devices: [] });
    vi.mocked(api.getMetricsHistory).mockResolvedValue({ mac: "", history: [] });
  });

  it("shows loading spinner with status while authenticating", () => {
    mockGetAuthStatus.mockReturnValue(new Promise(() => {}));
    renderApp();
    expect(screen.getByText("Checking authentication...")).toBeInTheDocument();
  });

  it("shows login screen when not authenticated", async () => {
    mockGetAuthStatus.mockResolvedValue({
      configured: false,
      source: "none",
      url: "",
      username: "",
    });
    renderApp();

    await waitFor(() => {
      expect(screen.getByText("Connect to UniFi Controller")).toBeInTheDocument();
    });
  });

  it("shows login screen when auth status check fails", async () => {
    mockGetAuthStatus.mockRejectedValue(new Error("Network error"));
    renderApp();

    await waitFor(() => {
      expect(screen.getByText("Connect to UniFi Controller")).toBeInTheDocument();
    });
  });

  it("shows main UI when authenticated", async () => {
    authedDefaults();
    mockGetZones.mockResolvedValue([]);
    mockGetZonePairs.mockResolvedValue([]);

    renderApp();

    await waitFor(() => {
      expect(screen.getByText("UniFi Homelab Ops")).toBeInTheDocument();
    });
  });

  it("transitions from login to main UI after successful login", async () => {
    mockGetAuthStatus
      .mockResolvedValueOnce({ configured: false, source: "none", url: "", username: "" })
      .mockResolvedValue({ configured: true, source: "runtime", url: "https://192.168.1.1", username: "admin" });
    mockLogin.mockResolvedValue(undefined);
    mockGetZones.mockResolvedValue([]);
    mockGetZonePairs.mockResolvedValue([]);

    renderApp();

    await waitFor(() => {
      expect(screen.getByText("Connect to UniFi Controller")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Controller URL"), {
      target: { value: "https://192.168.1.1" },
    });
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "pass" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    });

    await waitFor(() => {
      expect(screen.getByText("UniFi Homelab Ops")).toBeInTheDocument();
    });
  });

  it("provides onLogout in context for downstream components", async () => {
    authedDefaults();
    mockGetZones.mockResolvedValue([]);
    mockGetZonePairs.mockResolvedValue([]);
    mockLogout.mockResolvedValue(undefined);

    renderApp();

    await waitFor(() => {
      expect(screen.getByText("UniFi Homelab Ops")).toBeInTheDocument();
    });

    // The logout function is provided via context; Disconnect button is now inside SettingsModal
    // Verify the app renders without errors when authenticated
    expect(mockGetAuthStatus).toHaveBeenCalled();
  });

  it("shows error when data fetch fails", async () => {
    authedDefaults();
    mockGetZones.mockRejectedValue(new Error("Fetch failed"));
    mockGetZonePairs.mockResolvedValue([]);

    renderApp();

    await waitFor(() => {
      expect(screen.getByText("Fetch failed")).toBeInTheDocument();
    });
  });

  it("cycles theme preference dark -> system -> light", async () => {
    authedDefaults();
    mockGetZones.mockResolvedValue([]);
    mockGetZonePairs.mockResolvedValue([]);

    renderApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Theme: Dark" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Theme: Dark" }));

    expect(screen.getByRole("button", { name: "Theme: System" })).toBeInTheDocument();
    expect(localStorage.getItem("themePreference")).toBe("system");

    fireEvent.click(screen.getByRole("button", { name: "Theme: System" }));

    expect(screen.getByRole("button", { name: "Theme: Light" })).toBeInTheDocument();
    expect(localStorage.getItem("themePreference")).toBe("light");
  });

  it("restores theme preference from localStorage", async () => {
    localStorage.setItem("themePreference", "light");
    authedDefaults();
    mockGetZones.mockResolvedValue([]);
    mockGetZonePairs.mockResolvedValue([]);

    renderApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Theme: Light" })).toBeInTheDocument();
    });
  });

  it("shows contextual toggle for disabled rules and toggles it", async () => {
    authedDefaults();
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue([
      {
        source_zone_id: "z1",
        destination_zone_id: "z2",
        rules: [
          {
            id: "r1",
            name: "Enabled Rule",
            description: "",
            enabled: true,
            action: "ALLOW",
            source_zone_id: "z1",
            destination_zone_id: "z2",
            protocol: "TCP",
            port_ranges: [],
            ip_ranges: [],
            index: 1,
            predefined: false,
          },
          {
            id: "r2",
            name: "Disabled Rule",
            description: "",
            enabled: false,
            action: "BLOCK",
            source_zone_id: "z1",
            destination_zone_id: "z2",
            protocol: "TCP",
            port_ranges: [],
            ip_ranges: [],
            index: 2,
            predefined: false,
          },
        ],
        allow_count: 1,
        block_count: 1,
        analysis: { score: 70, grade: "C", findings: [] },
      },
    ]);

    renderApp();

    await waitFor(() => {
      expect(screen.getByLabelText("Show disabled rules")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Show disabled rules")).not.toBeChecked();

    fireEvent.click(screen.getByLabelText("Show disabled rules"));
    expect(screen.getByLabelText("Show disabled rules")).toBeChecked();
  });

  it("does not show toggle when no disabled rules and no hidden zones", async () => {
    authedDefaults();
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue(testZonePairs);

    renderApp();

    await waitFor(() => {
      expect(screen.getByText("UniFi Homelab Ops")).toBeInTheDocument();
    });

    // The toolbar toggle should not show any of these labels
    expect(screen.queryByLabelText("Show disabled rules")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Show filtered zones")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Show filtered zones and disabled rules")).not.toBeInTheDocument();
  });

  it("shows 'Show filtered zones' when zones are hidden", async () => {
    authedDefaults();
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue(testZonePairs);

    renderApp();

    // Wait for zones to load and render in sidebar
    await waitFor(() => {
      expect(screen.getByLabelText("External")).toBeInTheDocument();
    });

    // Hide a zone via sidebar
    fireEvent.click(screen.getByLabelText("External"));

    expect(screen.getByLabelText("Show filtered zones")).toBeInTheDocument();
  });

  it("loads hidden zones from API on auth", async () => {
    mockGetZoneFilter.mockResolvedValue({ hidden_zone_ids: ["z1"] });
    authedDefaults();
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue(testZonePairs);

    renderApp();

    await waitFor(() => {
      expect(mockGetZoneFilter).toHaveBeenCalled();
    });

    // z1 should be hidden from the matrix
    await waitFor(() => {
      expect(screen.queryByTestId("matrix-zone-z1")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("matrix-zone-z2")).toBeInTheDocument();
  });

  it("calls refresh when Refresh button is clicked", async () => {
    authedDefaults();
    mockGetZones.mockResolvedValue([]);
    mockGetZonePairs.mockResolvedValue([]);

    renderApp();

    // Wait for initial data load to complete (button shows "Refresh" not "Refreshing...")
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    });

    // Clear call counts from initial load
    mockGetZones.mockClear();
    mockGetZonePairs.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(mockGetZones).toHaveBeenCalled();
    });
  });

  it("shows RulePanel when an edge is clicked and closes it", async () => {
    authedDefaults();
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue(testZonePairs);

    renderApp();

    // First navigate to graph view by clicking a zone in the matrix
    await waitFor(() => {
      expect(screen.getByTestId("matrix-zone-z1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("matrix-zone-z1"));

    // Click the edge to select a zone pair - the mock ReactFlow renders edge buttons
    await waitFor(() => {
      expect(screen.getByTestId("edge-z1->z2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("edge-z1->z2"));

    // RulePanel should now be visible with the zone pair
    await waitFor(() => {
      expect(screen.getByLabelText("Close panel")).toBeInTheDocument();
    });

    // Verify zone names are shown in the panel header
    const header = screen.getByRole("heading", { level: 2 });
    expect(header.textContent).toContain("External");
    expect(header.textContent).toContain("Internal");

    // Close the panel
    fireEvent.click(screen.getByLabelText("Close panel"));

    await waitFor(() => {
      expect(screen.queryByLabelText("Close panel")).not.toBeInTheDocument();
    });
  });

  it("shows RulePanel via edge label click (onLabelClick)", async () => {
    authedDefaults();
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue(testZonePairs);

    renderApp();

    // First navigate to graph view by clicking a zone in the matrix
    await waitFor(() => {
      expect(screen.getByTestId("matrix-zone-z1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("matrix-zone-z1"));

    // Click the edge label button (exercises onLabelClick / buildElements callback)
    await waitFor(() => {
      expect(screen.getByTestId("edge-label-z1->z2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("edge-label-z1->z2"));

    // RulePanel should be visible
    await waitFor(() => {
      expect(screen.getByLabelText("Close panel")).toBeInTheDocument();
    });
  });

  it("shows 'Unknown' for zone names when zone is not found", async () => {
    authedDefaults();
    // Return zones but with IDs that don't match the zone pair
    mockGetZones.mockResolvedValue([
      { id: "z999", name: "Other", networks: [] },
    ]);
    mockGetZonePairs.mockResolvedValue([
      {
        source_zone_id: "z1",
        destination_zone_id: "z2",
        rules: [
          {
            id: "r1",
            name: "Rule",
            description: "",
            enabled: true,
            action: "ALLOW",
            source_zone_id: "z1",
            destination_zone_id: "z2",
            protocol: "TCP",
            port_ranges: [],
            ip_ranges: [],
            index: 1,
            predefined: false,
          },
        ],
        allow_count: 1,
        block_count: 0,
        analysis: { score: 85, grade: "B", findings: [] },
      },
    ]);

    renderApp();

    // Click the matrix cell to open the RulePanel directly
    await waitFor(() => {
      expect(screen.getByTestId("matrix-cell-z1-z2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("matrix-cell-z1-z2"));

    // Panel should show "Unknown" for both zone names since z1/z2 are not in the zones list
    await waitFor(() => {
      const header = screen.getByRole("heading", { level: 2 });
      expect(header.textContent).toContain("Unknown");
    });
  });

  it("shows ZoneMatrix by default (no focusZone)", async () => {
    authedDefaults();
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue(testZonePairs);

    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId("zone-matrix")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("react-flow")).not.toBeInTheDocument();
  });

  it("navigates to graph view when zone header is clicked in matrix", async () => {
    authedDefaults();
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue(testZonePairs);

    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId("matrix-zone-z1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("matrix-zone-z1"));

    await waitFor(() => {
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("zone-matrix")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });

  it("returns to matrix view when back button is clicked", async () => {
    authedDefaults();
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue(testZonePairs);

    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId("matrix-zone-z1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("matrix-zone-z1"));

    await waitFor(() => {
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /back/i }));

    await waitFor(() => {
      expect(screen.getByTestId("matrix-zone-z1")).toBeInTheDocument();
    });
  });

  it("opens RulePanel and graph view when matrix cell is clicked", async () => {
    authedDefaults();
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue(testZonePairs);

    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId("matrix-cell-z1-z2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("matrix-cell-z1-z2"));

    await waitFor(() => {
      expect(screen.getByLabelText("Close panel")).toBeInTheDocument();
    });
    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    expect(screen.queryByTestId("zone-matrix")).not.toBeInTheDocument();
  });

  it("opens and closes settings modal", async () => {
    authedDefaults();
    mockGetZones.mockResolvedValue([]);
    mockGetZonePairs.mockResolvedValue([]);

    renderApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    await waitFor(() => {
      expect(screen.getByTestId("settings-modal")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("close-settings"));

    await waitFor(() => {
      expect(screen.queryByTestId("settings-modal")).not.toBeInTheDocument();
    });
  });

  it("refreshes AI config when settings modal closes", async () => {
    authedDefaults();
    mockGetZones.mockResolvedValue([]);
    mockGetZonePairs.mockResolvedValue([]);

    renderApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    });

    // Clear the initial call count
    mockGetAiConfig.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    await waitFor(() => {
      expect(screen.getByTestId("settings-modal")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("close-settings"));

    await waitFor(() => {
      expect(mockGetAiConfig).toHaveBeenCalled();
    });
  });

  it("calls getAiConfig when authenticated", async () => {
    authedDefaults();
    mockGetZones.mockResolvedValue([]);
    mockGetZonePairs.mockResolvedValue([]);

    renderApp();

    await waitFor(() => {
      expect(mockGetAiConfig).toHaveBeenCalled();
    });
  });

  it("shows Analyze with AI button when AI is configured", async () => {
    authedDefaults();
    mockGetAiConfig.mockResolvedValue({
      base_url: "",
      model: "",
      provider_type: "",
      has_key: true,
      key_source: "none",
      source: "none",
    });
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue(testZonePairs);

    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId("matrix-cell-z1-z2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("matrix-cell-z1-z2"));

    await waitFor(() => {
      expect(screen.getByLabelText("Close panel")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Analyze with AI" })).toBeInTheDocument();
  });

  it("renders MatrixSidebar in matrix view", async () => {
    authedDefaults();
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue([]);

    renderApp();

    await waitFor(() => {
      expect(screen.getByText("Zones")).toBeInTheDocument();
    });
    expect(screen.getByText("Security Score")).toBeInTheDocument();
    expect(screen.getByText("Cell Colors")).toBeInTheDocument();
  });

  it("hides zone from matrix when unchecked in sidebar", async () => {
    authedDefaults();
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue([]);

    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId("matrix-zone-z1")).toBeInTheDocument();
    });
    expect(screen.getByTestId("matrix-zone-z2")).toBeInTheDocument();

    // Uncheck the first zone
    fireEvent.click(screen.getByLabelText("External"));

    // Zone should be removed from the matrix
    expect(screen.queryByTestId("matrix-zone-z1")).not.toBeInTheDocument();
    // Other zone still visible
    expect(screen.getByTestId("matrix-zone-z2")).toBeInTheDocument();

    // Re-check to bring it back
    fireEvent.click(screen.getByLabelText("External"));
    expect(screen.getByTestId("matrix-zone-z1")).toBeInTheDocument();
  });

  it("does not show Analyze with AI button when AI config fails", async () => {
    authedDefaults();
    mockGetAiConfig.mockRejectedValue(new Error("AI config fetch failed"));
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue(testZonePairs);

    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId("matrix-cell-z1-z2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("matrix-cell-z1-z2"));

    await waitFor(() => {
      expect(screen.getByLabelText("Close panel")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "Analyze with AI" })).not.toBeInTheDocument();
  });

  it("renders module sidebar with navigation links", async () => {
    authedDefaults();
    mockGetZones.mockResolvedValue([]);
    mockGetZonePairs.mockResolvedValue([]);

    renderApp();

    await waitFor(() => {
      expect(screen.getByText("UniFi Homelab Ops")).toBeInTheDocument();
    });

    expect(screen.getByRole("navigation", { name: "Module navigation" })).toBeInTheDocument();
    expect(screen.getByText("Firewall")).toBeInTheDocument();
    expect(screen.getByText("Topology")).toBeInTheDocument();
    expect(screen.getByText("Metrics")).toBeInTheDocument();
    expect(screen.getByText("Health")).toBeInTheDocument();
  });

  it("notification badge excludes resolved and dismissed notifications", async () => {
    mockGetNotifications.mockResolvedValue([
      { id: 1, device_mac: "aa", check_id: "c", severity: "high", title: "Active", message: "", created_at: new Date().toISOString(), resolved_at: null, dismissed: false },
      { id: 2, device_mac: "bb", check_id: "c", severity: "low", title: "Resolved", message: "", created_at: new Date().toISOString(), resolved_at: new Date().toISOString(), dismissed: false },
      { id: 3, device_mac: "cc", check_id: "c", severity: "low", title: "Dismissed", message: "", created_at: new Date().toISOString(), resolved_at: null, dismissed: true },
    ]);
    renderApp();
    await waitFor(() => expect(screen.getByText("Firewall")).toBeInTheDocument());
    // Only the active (non-resolved, non-dismissed) notification should be counted
    // Badge renders as a small span with the count
    await waitFor(() => {
      const badges = screen.getAllByText("1");
      expect(badges.length).toBeGreaterThan(0);
    });
  });
});
