import { describe, it, expect, vi } from "vitest";
import { formatRelativeTime } from "./format";

describe("formatRelativeTime", () => {
  it("returns 'just now' for times less than 1 minute ago", () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe("just now");
  });

  it("returns minutes ago for times less than 1 hour", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:05:00Z"));
    expect(formatRelativeTime("2026-01-01T12:00:00Z")).toBe("5m ago");
    vi.useRealTimers();
  });

  it("returns hours ago for times less than 1 day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T15:00:00Z"));
    expect(formatRelativeTime("2026-01-01T12:00:00Z")).toBe("3h ago");
    vi.useRealTimers();
  });

  it("returns days ago for times 1 day or more", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-03T12:00:00Z"));
    expect(formatRelativeTime("2026-01-01T12:00:00Z")).toBe("2d ago");
    vi.useRealTimers();
  });
});
