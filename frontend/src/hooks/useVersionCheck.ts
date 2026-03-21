import { useEffect, useState } from "react";

interface BuildInfo {
  version: string;
  commit: string;
  date: string;
  isDev: boolean;
  label: string;
}

interface VersionState {
  build: BuildInfo;
  updateAvailable: string | null;
}

/* v8 ignore start -- only exercised with real build metadata */
function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}
/* v8 ignore stop */

/* v8 ignore start -- only exercised with real build metadata, not in dev/test */
function buildLabel(version: string, commit: string, date: string): string {
  if (version === "dev" || !version) return "dev";
  const tag = version.startsWith("v") ? version : `v${version}`;
  const shortCommit = commit ? commit.slice(0, 7) : "";
  const formatted = formatDate(date);
  const parts = [tag];
  if (shortCommit) parts.push(shortCommit);
  if (formatted) parts.push(formatted);
  return parts.length > 1 ? `${parts[0]} (${parts.slice(1).join(", ")})` : parts[0];
}
/* v8 ignore stop */

const build: BuildInfo = {
  version: __BUILD_VERSION__,
  commit: __BUILD_COMMIT__,
  date: __BUILD_DATE__,
  isDev: __BUILD_VERSION__ === "dev" || !__BUILD_VERSION__,
  label: buildLabel(__BUILD_VERSION__, __BUILD_COMMIT__, __BUILD_DATE__),
};

const DOCKER_HUB_TAGS_URL = "https://hub.docker.com/v2/repositories/merlijntishauser/unifi-homelab-ops/tags?page_size=10&ordering=last_updated";
const CHECK_INTERVAL = 1000 * 60 * 60; // 1 hour

/* v8 ignore start -- semver comparison and Docker Hub API check */
function parseSemver(tag: string): number[] | null {
  const m = tag.replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)$/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function isNewer(remote: string, local: string): boolean {
  const r = parseSemver(remote);
  const l = parseSemver(local);
  if (!r || !l) return false;
  for (let i = 0; i < 3; i++) {
    if (r[i] > l[i]) return true;
    if (r[i] < l[i]) return false;
  }
  return false;
}

async function checkForUpdate(currentVersion: string): Promise<string | null> {
  try {
    const resp = await fetch(DOCKER_HUB_TAGS_URL);
    if (!resp.ok) return null;
    const data = await resp.json();
    const tags: string[] = (data.results ?? [])
      .map((r: { name: string }) => r.name)
      .filter((t: string) => parseSemver(t) !== null);
    for (const tag of tags) {
      if (isNewer(tag, currentVersion)) return tag;
    }
  } catch {
    // Silently ignore network errors
  }
  return null;
}
/* v8 ignore stop */

export function useVersionCheck(): VersionState {
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);

  useEffect(() => {
    if (build.isDev) return;
    /* v8 ignore start -- only runs in production builds */
    let cancelled = false;
    const check = () => {
      checkForUpdate(build.version).then((tag) => {
        if (!cancelled && tag) setUpdateAvailable(tag);
      });
    };
    check();
    const interval = setInterval(check, CHECK_INTERVAL);
    return () => { cancelled = true; clearInterval(interval); };
    /* v8 ignore stop */
  }, []);

  return { build, updateAvailable };
}
