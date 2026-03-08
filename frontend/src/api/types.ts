export interface Network {
  id: string;
  name: string;
  vlan_id: number | null;
  subnet: string | null;
}

export interface Zone {
  id: string;
  name: string;
  networks: Network[];
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  action: "ALLOW" | "BLOCK" | "REJECT";
  source_zone_id: string;
  destination_zone_id: string;
  protocol: string;
  port_ranges: string[];
  ip_ranges: string[];
  index: number;
  predefined: boolean;
}

export interface ZonePair {
  source_zone_id: string;
  destination_zone_id: string;
  rules: Rule[];
  allow_count: number;
  block_count: number;
}

export interface SimulateRequest {
  src_ip: string;
  dst_ip: string;
  protocol: string;
  port: number | null;
}

export interface RuleEvaluation {
  rule_id: string;
  rule_name: string;
  matched: boolean;
  reason: string;
  skipped_disabled: boolean;
}

export interface SimulateResponse {
  source_zone_id: string | null;
  source_zone_name: string | null;
  destination_zone_id: string | null;
  destination_zone_name: string | null;
  verdict: string | null;
  matched_rule_id: string | null;
  matched_rule_name: string | null;
  default_policy_used: boolean;
  evaluations: RuleEvaluation[];
}

export interface AuthStatus {
  configured: boolean;
  source: "env" | "runtime" | "none";
  url: string;
}
