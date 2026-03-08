import type {
  AuthStatus,
  Rule,
  SimulateRequest,
  SimulateResponse,
  Zone,
  ZonePair,
} from "./types";

const BASE = "/api";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json();
}

export const api = {
  getAuthStatus: () => fetchJson<AuthStatus>("/auth/status"),
  login: (
    url: string,
    username: string,
    password: string,
    site: string,
    verifySsl: boolean,
  ) =>
    fetchJson("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        url,
        username,
        password,
        site,
        verify_ssl: verifySsl,
      }),
    }),
  logout: () => fetchJson("/auth/logout", { method: "POST" }),
  getZones: () => fetchJson<Zone[]>("/zones"),
  getRules: () => fetchJson<Rule[]>("/rules"),
  getZonePairs: () => fetchJson<ZonePair[]>("/zone-pairs"),
  simulate: (req: SimulateRequest) =>
    fetchJson<SimulateResponse>("/simulate", {
      method: "POST",
      body: JSON.stringify(req),
    }),
};
