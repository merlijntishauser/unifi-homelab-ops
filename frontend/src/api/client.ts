import type {
  AiAnalysisSettings,
  AiAnalyzeRequest,
  AiAnalyzeResponse,
  AiConfig,
  DeviceSpec,
  AiConfigInput,
  AiPreset,
  AppAuthStatus,
  AppNotification,
  AuthStatus,
  BomResponse,
  DocumentationResponse,
  HealthAnalysisResult,
  HealthSummaryResponse,
  MetricsDevicesResponse,
  MetricsHistoryResponse,
  Rack,
  RackInput,
  RackItem,
  RackItemInput,
  RackSummary,
  Rule,
  SimulateRequest,
  SimulateResponse,
  TopologyDevicesResponse,
  TopologySvgResponse,
  Zone,
  ZoneFilter,
  ZonePair,
} from "./types";

const BASE = "/api";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  getAppAuthStatus: () => fetchJson<AppAuthStatus>("/auth/app-status"),
  appLogin: (password: string) =>
    fetchJson("/auth/app-login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  appLogout: () => fetchJson("/auth/app-logout", { method: "POST" }),
  getAuthStatus: () => fetchJson<AuthStatus>("/auth/status"),
  login: (
    url: string,
    username: string,
    password: string,
    site: string,
    verifySsl: boolean,
  ) =>
    fetchJson("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        url,
        username,
        password,
        site,
        verify_ssl: verifySsl,
      }),
    }),
  logout: () => fetchJson("/auth/logout", { method: "POST" }),
  getZones: () => fetchJson<Zone[]>("/firewall/zones"),
  getRules: () => fetchJson<Rule[]>("/firewall/rules"),
  getZonePairs: () => fetchJson<ZonePair[]>("/firewall/zone-pairs"),
  simulate: (req: SimulateRequest) =>
    fetchJson<SimulateResponse>("/firewall/simulate", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  getAiConfig: () => fetchJson<AiConfig>("/settings/ai"),
  saveAiConfig: (config: AiConfigInput) =>
    fetchJson("/settings/ai", {
      method: "PUT",
      body: JSON.stringify(config),
    }),
  deleteAiConfig: () => fetchJson("/settings/ai", { method: "DELETE" }),
  testAiConnection: (config?: AiConfigInput) =>
    fetchJson<{ status: string }>("/settings/ai/test", {
      method: "POST",
      body: config ? JSON.stringify(config) : undefined,
    }),
  getAiPresets: () => fetchJson<AiPreset[]>("/settings/ai/presets"),
  getAiAnalysisSettings: () =>
    fetchJson<AiAnalysisSettings>("/settings/ai-analysis"),
  saveAiAnalysisSettings: (settings: AiAnalysisSettings) =>
    fetchJson("/settings/ai-analysis", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
  analyzeWithAi: (req: AiAnalyzeRequest) =>
    fetchJson<AiAnalyzeResponse>("/firewall/analyze", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  getZoneFilter: () => fetchJson<ZoneFilter>("/firewall/zone-filter"),
  saveZoneFilter: (hiddenZoneIds: string[]) =>
    fetchJson("/firewall/zone-filter", {
      method: "PUT",
      body: JSON.stringify({ hidden_zone_ids: hiddenZoneIds }),
    }),
  toggleRule: (ruleId: string, enabled: boolean) =>
    fetchJson(`/firewall/rules/${ruleId}/toggle`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }),
  swapRuleOrder: (policyIdA: string, policyIdB: string) =>
    fetchJson("/firewall/rules/reorder", {
      method: "PUT",
      body: JSON.stringify({ policy_id_a: policyIdA, policy_id_b: policyIdB }),
    }),
  getTopologySvg: (colorMode: string, projection: string) =>
    fetchJson<TopologySvgResponse>(
      `/topology/svg?color_mode=${encodeURIComponent(colorMode)}&projection=${encodeURIComponent(projection)}`,
    ),
  getTopologyDevices: () => fetchJson<TopologyDevicesResponse>("/topology/devices"),
  getMetricsDevices: () => fetchJson<MetricsDevicesResponse>("/metrics/devices"),
  getMetricsHistory: (mac: string) =>
    fetchJson<MetricsHistoryResponse>(`/metrics/devices/${encodeURIComponent(mac)}/history`),
  getNotifications: () => fetchJson<AppNotification[]>("/metrics/notifications"),
  dismissNotification: (id: number) =>
    fetchJson(`/metrics/notifications/${id}/dismiss`, { method: "POST" }),
  getHealthSummary: () => fetchJson<HealthSummaryResponse>("/health/summary"),
  analyzeHealth: () =>
    fetchJson<HealthAnalysisResult>("/health/analyze", { method: "POST" }),
  getDocSections: () => fetchJson<DocumentationResponse>("/docs/sections"),
  getDocExport: async () => {
    const res = await fetch(`${BASE}/docs/export`);
    if (!res.ok) throw new Error("Export failed");
    return res.text();
  },
  getRacks: () => fetchJson<RackSummary[]>("/racks"),
  getRack: (id: number) => fetchJson<Rack>(`/racks/${id}`),
  createRack: (data: RackInput) =>
    fetchJson<Rack>("/racks", { method: "POST", body: JSON.stringify(data) }),
  updateRack: (id: number, data: RackInput) =>
    fetchJson<Rack>(`/racks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteRack: (id: number) =>
    fetchJson<void>(`/racks/${id}`, { method: "DELETE" }),
  addRackItem: (rackId: number, data: RackItemInput) =>
    fetchJson<RackItem>(`/racks/${rackId}/items`, { method: "POST", body: JSON.stringify(data) }),
  updateRackItem: (rackId: number, itemId: number, data: RackItemInput) =>
    fetchJson<RackItem>(`/racks/${rackId}/items/${itemId}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteRackItem: (rackId: number, itemId: number) =>
    fetchJson<void>(`/racks/${rackId}/items/${itemId}`, { method: "DELETE" }),
  moveRackItem: (rackId: number, itemId: number, positionU: number, positionX?: number) =>
    fetchJson<RackItem>(`/racks/${rackId}/items/${itemId}/move`, {
      method: "PATCH",
      body: JSON.stringify({ position_u: positionU, position_x: positionX ?? 0.0 }),
    }),
  getRackBom: (id: number) => fetchJson<BomResponse>(`/racks/${id}/bom`),
  getAvailableDevices: (rackId: number) =>
    fetchJson<{ mac: string; name: string; model: string; type: string }[]>(`/racks/${rackId}/available-devices`),
  importRackFromTopology: (id: number) =>
    fetchJson<RackItem[]>(`/racks/${id}/import`, { method: "POST" }),
  getDeviceSpecs: () => fetchJson<DeviceSpec[]>("/racks/device-specs"),
};
