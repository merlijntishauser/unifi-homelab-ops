import { describe, it, expect } from "vitest";
import { deriveCellSummary } from "./matrixUtils";
import type { ZonePair, Rule } from "../api/types";

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: "r1", name: "Rule", description: "", enabled: true,
    action: "ALLOW", source_zone_id: "z1", destination_zone_id: "z2",
    protocol: "", port_ranges: [], ip_ranges: [], index: 1, predefined: false,
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

function makePair(overrides: Partial<ZonePair> = {}): ZonePair {
  return {
    source_zone_id: "z1", destination_zone_id: "z2",
    rules: [], allow_count: 0, block_count: 0, analysis: null,
    ...overrides,
  };
}

describe("deriveCellSummary", () => {
  it("returns null actionLabel for empty pair", () => {
    const result = deriveCellSummary(makePair());
    expect(result).toEqual({ actionLabel: null, userRuleCount: 0, predefinedRuleCount: 0 });
  });

  it("returns Allow All for predefined allow rule without connection state", () => {
    const result = deriveCellSummary(makePair({
      rules: [makeRule({ predefined: true, action: "ALLOW" })],
      allow_count: 1,
    }));
    expect(result.actionLabel).toBe("Allow All");
    expect(result.predefinedRuleCount).toBe(1);
    expect(result.userRuleCount).toBe(0);
  });

  it("returns Allow Return for predefined allow with established state", () => {
    const result = deriveCellSummary(makePair({
      rules: [makeRule({ predefined: true, action: "ALLOW", connection_state_type: "established" })],
      allow_count: 1,
    }));
    expect(result.actionLabel).toBe("Allow Return");
  });

  it("returns Allow Return for predefined allow with ESTABLISHED (case-insensitive)", () => {
    const result = deriveCellSummary(makePair({
      rules: [makeRule({ predefined: true, action: "ALLOW", connection_state_type: "ESTABLISHED" })],
      allow_count: 1,
    }));
    expect(result.actionLabel).toBe("Allow Return");
  });

  it("returns Block All for predefined block rule", () => {
    const result = deriveCellSummary(makePair({
      rules: [makeRule({ predefined: true, action: "BLOCK" })],
      block_count: 1,
    }));
    expect(result.actionLabel).toBe("Block All");
  });

  it("returns Block All for predefined reject rule", () => {
    const result = deriveCellSummary(makePair({
      rules: [makeRule({ predefined: true, action: "REJECT" })],
      block_count: 1,
    }));
    expect(result.actionLabel).toBe("Block All");
  });

  it("returns Mixed for predefined with both allow and block", () => {
    const result = deriveCellSummary(makePair({
      rules: [
        makeRule({ id: "r1", predefined: true, action: "ALLOW" }),
        makeRule({ id: "r2", predefined: true, action: "BLOCK" }),
      ],
      allow_count: 1, block_count: 1,
    }));
    expect(result.actionLabel).toBe("Mixed");
  });

  it("returns Mixed when all predefined rules are disabled", () => {
    const result = deriveCellSummary(makePair({
      rules: [makeRule({ predefined: true, enabled: false })],
    }));
    expect(result.actionLabel).toBe("Mixed");
  });

  it("counts user and predefined rules separately", () => {
    const result = deriveCellSummary(makePair({
      rules: [
        makeRule({ id: "r1", predefined: true, action: "ALLOW" }),
        makeRule({ id: "r2", predefined: false }),
        makeRule({ id: "r3", predefined: false }),
      ],
      allow_count: 3,
    }));
    expect(result.userRuleCount).toBe(2);
    expect(result.predefinedRuleCount).toBe(1);
  });

  it("derives Allow All from counts when no predefined rules", () => {
    const result = deriveCellSummary(makePair({
      rules: [makeRule()],
      allow_count: 1, block_count: 0,
    }));
    expect(result.actionLabel).toBe("Allow All");
  });

  it("derives Block All from counts when no predefined rules", () => {
    const result = deriveCellSummary(makePair({
      rules: [makeRule({ action: "BLOCK" })],
      allow_count: 0, block_count: 1,
    }));
    expect(result.actionLabel).toBe("Block All");
  });

  it("derives Mixed from counts when no predefined rules", () => {
    const result = deriveCellSummary(makePair({
      rules: [
        makeRule({ id: "r1", action: "ALLOW" }),
        makeRule({ id: "r2", action: "BLOCK" }),
      ],
      allow_count: 1, block_count: 1,
    }));
    expect(result.actionLabel).toBe("Mixed");
  });
});
