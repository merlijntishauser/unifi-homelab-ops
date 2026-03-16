import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ZoneMatrix from "./ZoneMatrix";
import type { Zone, ZonePair, Rule } from "../api/types";

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: "r1", name: "Allow HTTP", description: "", enabled: true,
    action: "ALLOW", source_zone_id: "z1", destination_zone_id: "z2",
    protocol: "TCP", port_ranges: ["80"], ip_ranges: [], index: 1, predefined: false,
    source_ip_ranges: [], source_mac_addresses: [], source_port_ranges: [],
    source_network_id: "", destination_mac_addresses: [], destination_network_id: "",
    source_port_group: "", source_port_group_members: [],
    destination_port_group: "", destination_port_group_members: [],
    source_address_group: "", source_address_group_members: [],
    destination_address_group: "", destination_address_group_members: [],
    connection_state_type: "", connection_logging: false, schedule: "", match_ip_sec: "",
    ...overrides,
  };
}

// Mock MatrixCell to simplify testing
vi.mock("./MatrixCell", () => ({
  default: ({ actionLabel, userRuleCount, grade, onClick, isSelfPair }: {
    actionLabel: string | null;
    userRuleCount: number;
    grade: string | null;
    onClick: () => void;
    isSelfPair: boolean;
  }) => (
    <button
      data-testid="matrix-cell"
      data-action={actionLabel ?? ""}
      data-user-rules={userRuleCount}
      data-self-pair={isSelfPair ? "true" : "false"}
      data-grade={grade ?? ""}
      onClick={onClick}
    >
      {actionLabel ?? "empty"}
    </button>
  ),
}));

const zones: Zone[] = [
  { id: "z1", name: "External", networks: [] },
  { id: "z2", name: "Internal", networks: [] },
];

const zonePairs: ZonePair[] = [
  {
    source_zone_id: "z1",
    destination_zone_id: "z2",
    rules: [makeRule({ predefined: true, action: "ALLOW" })],
    allow_count: 1,
    block_count: 0,
    analysis: { score: 85, grade: "B", findings: [] },
  },
];

describe("ZoneMatrix", () => {
  const onCellClick = vi.fn();
  const onZoneClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders zone names as row headers", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={zonePairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    expect(screen.getByTestId("row-header-z1")).toHaveTextContent("External");
    expect(screen.getByTestId("row-header-z2")).toHaveTextContent("Internal");
  });

  it("renders zone names as horizontal column headers", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={zonePairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    const colHeader = screen.getByTestId("col-header-z1");
    expect(colHeader).toHaveTextContent("External");
    expect(colHeader.style.writingMode).toBeFalsy();
  });

  it("renders Destination axis label", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={zonePairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    expect(screen.getByText("Destination")).toBeInTheDocument();
  });

  it("renders Source axis label", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={zonePairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    expect(screen.getByTestId("source-label")).toHaveTextContent("Source");
  });

  it("passes derived action label to cells", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={zonePairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    const cells = screen.getAllByTestId("matrix-cell");
    const allowCell = cells.find((c) => c.getAttribute("data-action") === "Allow All");
    expect(allowCell).toBeDefined();
  });

  it("calls onCellClick with the matching ZonePair when a cell is clicked", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={zonePairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    const cells = screen.getAllByTestId("matrix-cell");
    const allowCell = cells.find((c) => c.getAttribute("data-action") === "Allow All");
    fireEvent.click(allowCell!);
    expect(onCellClick).toHaveBeenCalledWith(zonePairs[0]);
  });

  it("calls onZoneClick with zone ID when a row header is clicked", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={zonePairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    fireEvent.click(screen.getByTestId("row-header-z1"));
    expect(onZoneClick).toHaveBeenCalledWith("z1");
  });

  it("calls onZoneClick with zone ID when a column header is clicked", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={zonePairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    fireEvent.click(screen.getByTestId("col-header-z1"));
    expect(onZoneClick).toHaveBeenCalledWith("z1");
  });

  it("marks diagonal cells as self-pair", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={[]} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    const allCells = screen.getAllByTestId("matrix-cell");
    const selfPairCells = allCells.filter((c) => c.getAttribute("data-self-pair") === "true");
    expect(selfPairCells.length).toBe(2); // z1->z1, z2->z2
  });

  it("does not call onCellClick when clicking a self-pair cell", () => {
    const selfPairs: ZonePair[] = [
      {
        source_zone_id: "z1", destination_zone_id: "z1",
        rules: [makeRule({ predefined: true, source_zone_id: "z1", destination_zone_id: "z1" })],
        allow_count: 1, block_count: 0, analysis: null,
      },
    ];
    render(
      <ZoneMatrix zones={zones} zonePairs={selfPairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    const selfCells = screen.getAllByTestId("matrix-cell").filter((c) => c.getAttribute("data-self-pair") === "true");
    fireEvent.click(selfCells[0]);
    expect(onCellClick).not.toHaveBeenCalled();
  });

  it("renders empty cells for zone pairs without rules", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={[]} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    const allCells = screen.getAllByTestId("matrix-cell");
    allCells.forEach((cell) => {
      expect(cell).toHaveTextContent("empty");
    });
  });

  it("does not call onCellClick when clicking a cell with no matching pair", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={zonePairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    const emptyCells = screen.getAllByTestId("matrix-cell").filter((c) => c.getAttribute("data-action") === "");
    fireEvent.click(emptyCells[0]);
    expect(onCellClick).not.toHaveBeenCalled();
  });

  it("renders nothing when zones is empty", () => {
    render(
      <ZoneMatrix zones={[]} zonePairs={[]} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    expect(screen.queryByTestId("row-header-z1")).not.toBeInTheDocument();
  });

  it("applies sticky classes to column headers", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={zonePairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    const colHeader = screen.getByTestId("col-header-z1");
    expect(colHeader.className).toContain("sticky");
    expect(colHeader.className).toContain("top-0");
    expect(colHeader.className).toContain("z-10");
  });

  it("applies sticky left-0 to row headers", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={zonePairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    const rowHeader = screen.getByTestId("row-header-z1");
    expect(rowHeader.className).toContain("sticky");
    expect(rowHeader.className).toContain("left-0");
  });

  it("shows Source label on desktop", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={zonePairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    expect(screen.getByTestId("source-label")).toBeInTheDocument();
  });

  it("hides Source label on mobile", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);
    render(
      <ZoneMatrix zones={zones} zonePairs={zonePairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    expect(screen.queryByTestId("source-label")).not.toBeInTheDocument();
  });
});
