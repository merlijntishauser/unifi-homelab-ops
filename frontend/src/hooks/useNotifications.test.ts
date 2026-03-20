import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNotificationState } from "./useNotifications";

const mutateFn = vi.fn();

vi.mock("./queries", () => ({
  useNotifications: (enabled: boolean) => ({
    data: enabled
      ? [
          { id: 1, device_mac: "aa", check_id: "c", severity: "high", title: "Active", message: "", created_at: "", resolved_at: null, dismissed: false },
          { id: 2, device_mac: "bb", check_id: "c", severity: "low", title: "Resolved", message: "", created_at: "", resolved_at: "2026-01-01", dismissed: false },
          { id: 3, device_mac: "cc", check_id: "c", severity: "low", title: "Dismissed", message: "", created_at: "", resolved_at: null, dismissed: true },
        ]
      : undefined,
    isLoading: false,
  }),
  useDismissNotification: () => ({ mutate: mutateFn }),
}));

describe("useNotificationState", () => {
  it("returns empty state when disabled", () => {
    const { result } = renderHook(() => useNotificationState(false));
    expect(result.current.notifications).toEqual([]);
    expect(result.current.activeCount).toBe(0);
  });

  it("counts only active (non-dismissed, non-resolved) notifications", () => {
    const { result } = renderHook(() => useNotificationState(true));
    expect(result.current.notifications).toHaveLength(3);
    expect(result.current.activeCount).toBe(1);
  });

  it("dismiss calls mutate with the notification id", () => {
    mutateFn.mockClear();
    const { result } = renderHook(() => useNotificationState(true));
    act(() => result.current.dismiss(1));
    expect(mutateFn).toHaveBeenCalledWith(1);
  });

  it("dismissAll calls mutate for every notification", () => {
    mutateFn.mockClear();
    const { result } = renderHook(() => useNotificationState(true));
    act(() => result.current.dismissAll());
    expect(mutateFn).toHaveBeenCalledTimes(3);
    expect(mutateFn).toHaveBeenCalledWith(1);
    expect(mutateFn).toHaveBeenCalledWith(2);
    expect(mutateFn).toHaveBeenCalledWith(3);
  });
});
