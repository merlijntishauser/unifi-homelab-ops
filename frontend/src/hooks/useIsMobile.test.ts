import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useIsMobile, useIsPhone } from "./useIsMobile";

function createMockMatchMedia(initialMatches: boolean) {
  let listener: ((e: MediaQueryListEvent) => void) | null = null;
  const mql = {
    matches: initialMatches,
    addEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) => {
      listener = cb;
    }),
    removeEventListener: vi.fn(),
  };
  const trigger = (matches: boolean) => {
    mql.matches = matches;
    if (listener) listener({ matches } as MediaQueryListEvent);
  };
  return { mql, trigger };
}

describe("useIsMobile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when viewport is below 1024px", () => {
    const { mql } = createMockMatchMedia(true);
    vi.spyOn(window, "matchMedia").mockReturnValue(mql as unknown as MediaQueryList);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("returns false when viewport is at or above 1024px", () => {
    const { mql } = createMockMatchMedia(false);
    vi.spyOn(window, "matchMedia").mockReturnValue(mql as unknown as MediaQueryList);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("updates when viewport changes", () => {
    const { mql, trigger } = createMockMatchMedia(false);
    vi.spyOn(window, "matchMedia").mockReturnValue(mql as unknown as MediaQueryList);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    act(() => trigger(true));
    expect(result.current).toBe(true);
  });

  it("removes listener on unmount", () => {
    const { mql } = createMockMatchMedia(false);
    vi.spyOn(window, "matchMedia").mockReturnValue(mql as unknown as MediaQueryList);
    const { unmount } = renderHook(() => useIsMobile());
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});

describe("useIsPhone", () => {
  it("returns true when viewport is below 768px", () => {
    const { mql } = createMockMatchMedia(true);
    vi.spyOn(window, "matchMedia").mockReturnValue(mql as unknown as MediaQueryList);
    const { result } = renderHook(() => useIsPhone());
    expect(result.current).toBe(true);
  });

  it("returns false when viewport is at or above 768px", () => {
    const { mql } = createMockMatchMedia(false);
    vi.spyOn(window, "matchMedia").mockReturnValue(mql as unknown as MediaQueryList);
    const { result } = renderHook(() => useIsPhone());
    expect(result.current).toBe(false);
  });
});
