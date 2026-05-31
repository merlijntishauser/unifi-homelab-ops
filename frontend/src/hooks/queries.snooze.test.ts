import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { createTestQueryClient } from "../test-utils";
import { useSnoozedDevices, useSnoozeDevices, useUnsnoozeDevice } from "./queries";

vi.mock("../api/client", () => ({
  api: {
    getSnoozedDevices: vi.fn().mockResolvedValue({ devices: [] }),
    snoozeDevices: vi.fn().mockResolvedValue({ devices: [] }),
    unsnoozeDevice: vi.fn().mockResolvedValue({ devices: [] }),
  },
}));
import { api } from "../api/client";

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(QueryClientProvider, { client: createTestQueryClient() }, children);
}

describe("snooze hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches snoozed devices when enabled", async () => {
    renderHook(() => useSnoozedDevices(true), { wrapper });
    await waitFor(() => expect(api.getSnoozedDevices).toHaveBeenCalled());
  });

  it("snoozes devices", async () => {
    const { result } = renderHook(() => useSnoozeDevices(), { wrapper });
    result.current.mutate([{ mac: "aa:bb", name: "A", model: "m" }]);
    await waitFor(() => expect(api.snoozeDevices).toHaveBeenCalledWith([{ mac: "aa:bb", name: "A", model: "m" }]));
  });

  it("unsnoozes a device", async () => {
    const { result } = renderHook(() => useUnsnoozeDevice(), { wrapper });
    result.current.mutate("aa:bb");
    await waitFor(() => expect(api.unsnoozeDevice).toHaveBeenCalledWith("aa:bb"));
  });
});
