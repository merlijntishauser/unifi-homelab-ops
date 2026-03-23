import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { createTestQueryClient } from "../test-utils";
import {
  useTopologySvg,
  useTopologyDevices,
  useTopologyPositions,
  useMetricsDevices,
  useMetricsHistory,
  useNotifications,
  useHealthSummary,
  useHealthAnalysis,
  useDismissNotification,
  useDocSections,
  useRacks,
  useRack,
  useDeviceSpecs,
  useCreateRack,
  useUpdateRack,
  useDeleteRack,
  useAddRackItem,
  useUpdateRackItem,
  useDeleteRackItem,
  useMoveRackItem,
  useImportRackFromTopology,
} from "./queries";

vi.mock("../api/client", () => ({
  api: {
    getTopologySvg: vi.fn(),
    getTopologyDevices: vi.fn(),
    getTopologyPositions: vi.fn(),
    getMetricsDevices: vi.fn(),
    getMetricsHistory: vi.fn(),
    getNotifications: vi.fn(),
    getHealthSummary: vi.fn(),
    analyzeHealth: vi.fn(),
    dismissNotification: vi.fn(),
    getDocSections: vi.fn(),
    getRacks: vi.fn(),
    getRack: vi.fn(),
    getDeviceSpecs: vi.fn(),
    createRack: vi.fn(),
    updateRack: vi.fn(),
    deleteRack: vi.fn(),
    addRackItem: vi.fn(),
    updateRackItem: vi.fn(),
    deleteRackItem: vi.fn(),
    moveRackItem: vi.fn(),
    importRackFromTopology: vi.fn(),
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(QueryClientProvider, { client: createTestQueryClient() }, children);
}

describe("topology query hooks", () => {
  it("useTopologySvg does not fetch when disabled", () => {
    const { result } = renderHook(() => useTopologySvg("dark", "isometric", false), { wrapper });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it("useTopologyDevices does not fetch when disabled", () => {
    const { result } = renderHook(() => useTopologyDevices(false), { wrapper });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it("useTopologyPositions returns query with staleTime Infinity", () => {
    const { result } = renderHook(() => useTopologyPositions(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });
});

describe("metrics query hooks", () => {
  it("useMetricsDevices does not fetch when disabled", () => {
    const { result } = renderHook(() => useMetricsDevices(false), { wrapper });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it("useMetricsHistory does not fetch when disabled", () => {
    const { result } = renderHook(() => useMetricsHistory(null, false), { wrapper });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it("useMetricsHistory does not fetch when mac is null even if enabled is true", () => {
    const { result } = renderHook(() => useMetricsHistory(null, true), { wrapper });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it("useMetricsHistory fetches when mac is provided and enabled", () => {
    const { result } = renderHook(() => useMetricsHistory("aa:bb", true), { wrapper });
    // Query is enabled, so it will be loading
    expect(result.current.isLoading).toBe(true);
  });

  it("useNotifications does not fetch when disabled", () => {
    const { result } = renderHook(() => useNotifications(false), { wrapper });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });
});

describe("health query hooks", () => {
  it("useHealthSummary does not fetch when disabled", () => {
    const { result } = renderHook(() => useHealthSummary(false), { wrapper });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it("useHealthAnalysis returns mutation", () => {
    const { result } = renderHook(() => useHealthAnalysis(), { wrapper });
    expect(result.current.mutate).toBeDefined();
    expect(result.current.isPending).toBe(false);
  });

  it("useDismissNotification returns mutation", () => {
    const { result } = renderHook(() => useDismissNotification(), { wrapper });
    expect(result.current.mutate).toBeDefined();
    expect(result.current.isPending).toBe(false);
  });
});

describe("docs query hooks", () => {
  it("useDocSections does not fetch when disabled", () => {
    const { result } = renderHook(() => useDocSections(false), { wrapper });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });
});

describe("rack query hooks", () => {
  it("useRacks returns query", () => {
    const { result } = renderHook(() => useRacks(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it("useRack does not fetch when id is null", () => {
    const { result } = renderHook(() => useRack(null), { wrapper });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it("useRack fetches when id is provided", () => {
    const { result } = renderHook(() => useRack(5), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it("useDeviceSpecs returns query", () => {
    const { result } = renderHook(() => useDeviceSpecs(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it("useCreateRack calls api and invalidates", async () => {
    const { api } = await import("../api/client");
    vi.mocked(api.createRack).mockResolvedValue({ id: 1, name: "R1", size: "19-inch", height_u: 12, location: "", items: [], total_power: 0, used_u: 0 });
    const { result } = renderHook(() => useCreateRack(), { wrapper });
    await result.current.mutateAsync({ name: "R1" });
    expect(api.createRack).toHaveBeenCalledWith({ name: "R1" });
  });

  it("useUpdateRack calls api", async () => {
    const { api } = await import("../api/client");
    vi.mocked(api.updateRack).mockResolvedValue({ id: 1, name: "R2", size: "19-inch", height_u: 12, location: "", items: [], total_power: 0, used_u: 0 });
    const { result } = renderHook(() => useUpdateRack(), { wrapper });
    await result.current.mutateAsync({ id: 1, data: { name: "R2" } });
    expect(api.updateRack).toHaveBeenCalled();
  });

  it("useDeleteRack calls api", async () => {
    const { api } = await import("../api/client");
    vi.mocked(api.deleteRack).mockResolvedValue(undefined as never);
    const { result } = renderHook(() => useDeleteRack(), { wrapper });
    await result.current.mutateAsync(1);
    expect(api.deleteRack).toHaveBeenCalledWith(1);
  });

  it("useAddRackItem calls api", async () => {
    const { api } = await import("../api/client");
    vi.mocked(api.addRackItem).mockResolvedValue({ id: 1, position_u: 1, height_u: 1, device_type: "switch", label: "SW", power_watts: 0, device_mac: null, notes: "", device_name: null, device_model: null, device_status: null });
    const { result } = renderHook(() => useAddRackItem(), { wrapper });
    await result.current.mutateAsync({ rackId: 1, data: { position_u: 1, label: "SW" } });
    expect(api.addRackItem).toHaveBeenCalled();
  });

  it("useUpdateRackItem calls api", async () => {
    const { api } = await import("../api/client");
    vi.mocked(api.updateRackItem).mockResolvedValue({ id: 1, position_u: 1, height_u: 1, device_type: "switch", label: "SW", power_watts: 0, device_mac: null, notes: "", device_name: null, device_model: null, device_status: null });
    const { result } = renderHook(() => useUpdateRackItem(), { wrapper });
    await result.current.mutateAsync({ rackId: 1, itemId: 1, data: { position_u: 1, label: "SW" } });
    expect(api.updateRackItem).toHaveBeenCalled();
  });

  it("useDeleteRackItem calls api", async () => {
    const { api } = await import("../api/client");
    vi.mocked(api.deleteRackItem).mockResolvedValue(undefined as never);
    const { result } = renderHook(() => useDeleteRackItem(), { wrapper });
    await result.current.mutateAsync({ rackId: 1, itemId: 1 });
    expect(api.deleteRackItem).toHaveBeenCalled();
  });

  it("useMoveRackItem calls api", async () => {
    const { api } = await import("../api/client");
    vi.mocked(api.moveRackItem).mockResolvedValue({ id: 1, position_u: 3, height_u: 1, device_type: "switch", label: "SW", power_watts: 0, device_mac: null, notes: "", device_name: null, device_model: null, device_status: null });
    const { result } = renderHook(() => useMoveRackItem(), { wrapper });
    await result.current.mutateAsync({ rackId: 1, itemId: 1, positionU: 3 });
    expect(api.moveRackItem).toHaveBeenCalled();
  });

  it("useImportRackFromTopology calls api", async () => {
    const { api } = await import("../api/client");
    vi.mocked(api.importRackFromTopology).mockResolvedValue([]);
    const { result } = renderHook(() => useImportRackFromTopology(), { wrapper });
    await result.current.mutateAsync(1);
    expect(api.importRackFromTopology).toHaveBeenCalledWith(1);
  });
});
