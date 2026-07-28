import { useCallback, useEffect, useRef, useState } from "react";
import type { DiagramTheme, IconSet, TopologyDevice, TopologyDevicesResponse, TopologySvgResponse } from "../api/types";
import { useAppContext } from "../hooks/useAppContext";
import { useTopologySvg, useTopologyDevices, useTopologyPositions, useSaveTopologyPositions, useResetTopologyPositions } from "../hooks/queries";
import { downloadSvg, downloadPng } from "../utils/export";
import SvgViewer from "./SvgViewer";
import DeviceMap from "./DeviceMap";
import DevicePanel from "./DevicePanel";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ColorMode } from "@xyflow/react";

/** Icon sets bundled by unifi-topology. "unifi" covers every node type with
 *  original artwork; the others fall back to generic shapes for some devices. */
const ICON_SETS = [
  { value: "unifi", label: "UniFi icons" },
  { value: "isometric", label: "Isometric icons" },
  { value: "modern", label: "Modern icons" },
] as const satisfies readonly { value: IconSet; label: string }[];

/** "auto" pairs the diagram with the app's light/dark mode; blueprint has no
 *  light/dark variant of its own, so choosing it overrides that pairing. */
const DIAGRAM_THEMES = [
  { value: "auto", label: "Match app theme" },
  { value: "blueprint", label: "Blueprint" },
] as const satisfies readonly { value: DiagramTheme; label: string }[];

function readStorage<T extends string>(key: string, fallback: T, valid: readonly T[]): T {
  try {
    const value = localStorage.getItem(key);
    if (value !== null && (valid as readonly string[]).includes(value)) return value as T;
    return fallback;
  } catch {
    return fallback;
  }
}

function LoadingSpinner({ message }: { message: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <div className="size-6 rounded-full border-2 border-ui-border dark:border-noc-border border-t-ub-blue animate-spin" />
      <p className="text-sm text-ui-text-secondary dark:text-noc-text-secondary">{message}</p>
    </div>
  );
}

function ErrorMessage({ error, fallback }: { error: Error | null; fallback: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <p className="text-sm text-status-danger">
        {error instanceof Error ? error.message : fallback}
      </p>
    </div>
  );
}

function MapContent({
  query,
  colorMode,
  selectedDevice,
  onDeviceSelect,
  onClosePanel,
  onNodeDragEnd,
}: {
  query: UseQueryResult<TopologyDevicesResponse>;
  colorMode: ColorMode;
  selectedDevice: TopologyDevice | null;
  onDeviceSelect: (d: TopologyDevice) => void;
  onClosePanel: () => void;
  onNodeDragEnd: (mac: string, x: number, y: number) => void;
}) {
  const positionsQuery = useTopologyPositions();
  if (query.isLoading || positionsQuery.isLoading) return <LoadingSpinner message="Loading devices…" />;
  if (query.error) return <ErrorMessage error={query.error as Error} fallback="Failed to load devices" />;
  const devices = query.data?.devices ?? [];
  const edges = query.data?.edges ?? [];
  return (
    <>
      <div className="flex-1">
        <DeviceMap
          devices={devices}
          edges={edges}
          colorMode={colorMode}
          onDeviceSelect={onDeviceSelect}
          selectedMac={selectedDevice?.mac ?? null}
          savedPositions={positionsQuery.data}
          onNodeDragEnd={onNodeDragEnd}
        />
      </div>
      {selectedDevice && (
        <DevicePanel key={selectedDevice.mac} device={selectedDevice} onClose={onClosePanel} />
      )}
    </>
  );
}

function DiagramContent({ query }: { query: UseQueryResult<TopologySvgResponse> }) {
  if (query.isLoading) return <LoadingSpinner message="Rendering topology..." />;
  if (query.error) return <ErrorMessage error={query.error as Error} fallback="Failed to render topology" />;
  if (query.data) return <SvgViewer svgContent={query.data.svg} />;
  return null;
}

const dlIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const BTN = "inline-flex items-center gap-1.5 rounded-lg border border-ui-border dark:border-noc-border px-3 py-1.5 min-h-[36px] text-sm text-ui-text-secondary dark:text-noc-text-secondary hover:bg-ui-raised dark:hover:bg-noc-raised hover:text-ui-text dark:hover:text-noc-text hover:border-ui-border-hover dark:hover:border-noc-border-hover cursor-pointer transition-colors";
const BTN_ACTIVE = "inline-flex items-center gap-1.5 rounded-lg border border-ub-blue px-3 py-1.5 min-h-[36px] text-sm text-ub-blue bg-blue-50 dark:bg-ub-blue-dim cursor-pointer transition-colors";

const segmentClass = (active: boolean, isFirst: boolean) =>
  `px-3 py-1.5 min-h-[36px] text-sm transition-colors ${!isFirst ? "border-l border-ui-border dark:border-noc-border" : ""} ${
    active ? "bg-blue-50 dark:bg-ub-blue-dim text-ub-blue font-medium" : "text-ui-text-secondary dark:text-noc-text-secondary hover:bg-ui-raised dark:hover:bg-noc-raised"
  }`;

export default function TopologyModule() {
  const { colorMode, connectionInfo } = useAppContext();
  const authed = connectionInfo !== null;

  const [subView, setSubView] = useState<"map" | "diagram">(() =>
    readStorage("topologySubView", "map", ["map", "diagram"] as const),
  );
  const [projection, setProjection] = useState<"orthogonal" | "isometric">(() =>
    readStorage("topologyProjection", "isometric", ["orthogonal", "isometric"] as const),
  );
  const [iconSet, setIconSet] = useState<IconSet>(() =>
    readStorage("topologyIconSet", "unifi", ICON_SETS.map((s) => s.value)),
  );
  const [diagramTheme, setDiagramTheme] = useState<DiagramTheme>(() =>
    readStorage("topologyDiagramTheme", "auto", DIAGRAM_THEMES.map((s) => s.value)),
  );
  const [showGrid, setShowGrid] = useState<boolean>(() =>
    readStorage("topologyShowGrid", "on", ["on", "off"] as const) === "on",
  );
  const deepLinkDevice = useRef<string | null>(null);
  if (deepLinkDevice.current === null) {
    deepLinkDevice.current = new URLSearchParams(window.location.search).get("device");
  }
  const [selectedDevice, setSelectedDevice] = useState<TopologyDevice | null>(null);

  const svgQuery = useTopologySvg(
    colorMode === "dark" ? "dark" : "light", projection, iconSet,
    diagramTheme, showGrid, authed && subView === "diagram",
  );
  const devicesQuery = useTopologyDevices(authed);

  // Deep-link: ?device=mac -- resolve once device data is available
  useEffect(() => {
    if (!deepLinkDevice.current || !devicesQuery.data) return;
    const mac = deepLinkDevice.current;
    deepLinkDevice.current = null;
    const device = devicesQuery.data.devices.find((d) => d.mac === mac);
    if (!device) return;
    setSelectedDevice(device);
    window.history.replaceState({}, "", window.location.pathname);
  }, [devicesQuery.data]);

  const handleSubViewChange = useCallback((view: "map" | "diagram") => {
    setSubView(view);
    try { localStorage.setItem("topologySubView", view); } catch { /* noop */ }
  }, []);

  const handleIconSetChange = useCallback((next: IconSet) => {
    setIconSet(next);
    try { localStorage.setItem("topologyIconSet", next); } catch { /* noop */ }
  }, []);

  const handleDiagramThemeChange = useCallback((next: DiagramTheme) => {
    setDiagramTheme(next);
    try { localStorage.setItem("topologyDiagramTheme", next); } catch { /* noop */ }
  }, []);

  const handleGridToggle = useCallback(() => {
    // Derive next outside the updater: StrictMode double-invokes updaters, so a
    // write in there runs twice. Same shape as handleProjectionChange.
    const next = !showGrid;
    setShowGrid(next);
    try { localStorage.setItem("topologyShowGrid", next ? "on" : "off"); } catch { /* noop */ }
  }, [showGrid]);

  const handleProjectionChange = useCallback(() => {
    const next = projection === "isometric" ? "orthogonal" : "isometric";
    setProjection(next);
    try { localStorage.setItem("topologyProjection", next); } catch { /* noop */ }
  }, [projection]);

  const savePositionsMutation = useSaveTopologyPositions();
  const resetPositionsMutation = useResetTopologyPositions();
  const pendingPositions = useRef<Map<string, { x: number; y: number }> | null>(null);
  if (pendingPositions.current == null) {
    pendingPositions.current = new Map();
  }
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const ref = debounceTimer;
    return () => clearTimeout(ref.current);
  }, []);

  const handleNodeDragEnd = useCallback((mac: string, x: number, y: number) => {
    pendingPositions.current!.set(mac, { x, y });
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const positions = Array.from(pendingPositions.current!.entries()).map(
        ([m, pos]) => ({ mac: m, x: pos.x, y: pos.y }),
      );
      pendingPositions.current!.clear();
      savePositionsMutation.mutate(positions);
    }, 500);
  }, [savePositionsMutation]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-3 lg:px-4 py-2.5 border-b border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-surface shrink-0">
        <div className="flex rounded-lg border border-ui-border dark:border-noc-border overflow-hidden">
          <button type="button" onClick={() => handleSubViewChange("map")} className={segmentClass(subView === "map", true)}>Map</button>
          <button type="button" onClick={() => handleSubViewChange("diagram")} className={segmentClass(subView === "diagram", false)}>Diagram</button>
        </div>
        {subView === "map" && (
          <button type="button"
            onClick={() => resetPositionsMutation.mutate(undefined)}
            disabled={resetPositionsMutation.isPending}
            className={BTN}
          >
            Reset Layout
          </button>
        )}
        {subView === "diagram" && (
          <>
            <button type="button" onClick={handleProjectionChange} className={projection === "isometric" ? BTN_ACTIVE : BTN}>Isometric</button>
            <select
              value={iconSet}
              onChange={(e) => handleIconSetChange(e.target.value as IconSet)}
              aria-label="Icon set"
              className={`${BTN} pr-7 appearance-none bg-[length:14px_14px] bg-[position:right_6px_center] bg-no-repeat`}
              data-testid="icon-set-select"
            >
              {ICON_SETS.map((set) => (
                <option key={set.value} value={set.value}>{set.label}</option>
              ))}
            </select>
            <select
              value={diagramTheme}
              onChange={(e) => handleDiagramThemeChange(e.target.value as DiagramTheme)}
              aria-label="Diagram style"
              className={`${BTN} pr-7 appearance-none bg-[length:14px_14px] bg-[position:right_6px_center] bg-no-repeat`}
              data-testid="diagram-theme-select"
            >
              {DIAGRAM_THEMES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            {/* Isometric-only: the grid is the floor the tiles stand on, and
                the orthogonal renderer draws no grid to hide. */}
            {projection === "isometric" && (
              <button type="button"
                onClick={handleGridToggle}
                aria-pressed={showGrid}
                data-testid="grid-toggle"
                className={showGrid ? BTN_ACTIVE : BTN}
              >
                Grid
              </button>
            )}
            {svgQuery.data && (
              <>
                <button type="button" onClick={() => downloadSvg(svgQuery.data.svg)} className={`${BTN} hidden md:flex`} aria-label="Download SVG">{dlIcon} SVG</button>
                <button type="button" onClick={() => downloadPng(svgQuery.data.svg)} className={`${BTN} hidden md:flex`} aria-label="Download PNG">{dlIcon} PNG</button>
              </>
            )}
          </>
        )}
      </div>
      <div className="flex-1 flex overflow-hidden relative">
        {subView === "map" ? (
          <MapContent
            query={devicesQuery}
            colorMode={colorMode}
            selectedDevice={selectedDevice}
            onDeviceSelect={setSelectedDevice}
            onClosePanel={() => setSelectedDevice(null)}
            onNodeDragEnd={handleNodeDragEnd}
          />
        ) : (
          <DiagramContent query={svgQuery} />
        )}
      </div>
    </div>
  );
}
