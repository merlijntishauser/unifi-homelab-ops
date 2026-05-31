import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SnoozedDevicesSection from "./SnoozedDevicesSection";

const devices = [
  { mac: "aa:bb", name: "Switch", model: "USW", snoozed_at: "2026-05-31T10:00:00Z" },
];

describe("SnoozedDevicesSection", () => {
  it("renders nothing when there are no snoozed devices", () => {
    const { container } = render(<SnoozedDevicesSection devices={[]} onUnsnooze={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the count and expands to list devices", () => {
    render(<SnoozedDevicesSection devices={devices} onUnsnooze={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Snoozed devices \(1\)/ }));
    expect(screen.getByText("Switch")).toBeInTheDocument();
  });

  it("calls onUnsnooze with the mac", () => {
    const onUnsnooze = vi.fn();
    render(<SnoozedDevicesSection devices={devices} onUnsnooze={onUnsnooze} defaultOpen />);
    fireEvent.click(screen.getByRole("button", { name: "Unsnooze Switch" }));
    expect(onUnsnooze).toHaveBeenCalledWith("aa:bb");
  });
});
