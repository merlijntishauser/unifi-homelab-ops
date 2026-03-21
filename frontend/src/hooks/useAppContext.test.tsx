import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAppContext } from "./useAppContext";

describe("useAppContext", () => {
  it("throws when used outside AppContext.Provider", () => {
    expect(() => renderHook(() => useAppContext())).toThrow(
      "useAppContext must be used within AppContext.Provider",
    );
  });
});
