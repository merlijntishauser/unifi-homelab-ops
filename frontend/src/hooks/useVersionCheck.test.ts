import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";

describe("useVersionCheck", () => {
  it("build info shows dev in test environment", async () => {
    const { useVersionCheck } = await import("./useVersionCheck");
    const { result } = renderHook(() => useVersionCheck());
    expect(result.current.build.isDev).toBe(true);
    expect(result.current.build.label).toBe("dev");
    expect(result.current.build.version).toBe("dev");
    expect(result.current.build.commit).toBe("");
    expect(result.current.build.date).toBe("");
    expect(result.current.updateAvailable).toBeNull();
  });
});
