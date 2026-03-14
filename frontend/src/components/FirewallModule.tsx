import { useCallback, useEffect, useMemo, useState } from "react";
import type { ZonePair } from "../api/types";
import { useAppContext } from "../hooks/useAppContext";
import MatrixSidebar from "./MatrixSidebar";
import ZoneGraph from "./ZoneGraph";
import ZoneMatrix from "./ZoneMatrix";
import RulePanel from "./RulePanel";

interface SelectedPairKey {
  sourceZoneId: string;
  destZoneId: string;
}

function formatError(error: Error | null): string | null {
  if (!error) return null;
  return error instanceof Error ? error.message : String(error);
}

export default function FirewallModule() {
  const ctx = useAppContext();
  const {
    zones, filteredZonePairs, visibleZones, colorMode, hiddenZoneIds,
    showHidden, onToggleZone, aiConfigured, onRefresh, dataLoading, dataError,
    zonePairs,
  } = ctx;

  const [selectedPairKey, setSelectedPairKey] = useState<SelectedPairKey | null>(null);
  const [focusZoneIds, setFocusZoneIds] = useState<string[] | null>(null);

  // Derive selectedPair from zonePairs so it auto-syncs on refresh
  const selectedPair = useMemo(() => {
    if (!selectedPairKey) return null;
    return zonePairs.find(
      (zp) => zp.source_zone_id === selectedPairKey.sourceZoneId && zp.destination_zone_id === selectedPairKey.destZoneId,
    ) ?? null;
  }, [zonePairs, selectedPairKey]);

  const getZoneName = useMemo(() => {
    const map = new Map<string, string>();
    for (const z of zones) {
      map.set(z.id, z.name);
    }
    return (id: string) => map.get(id) ?? "Unknown";
  }, [zones]);

  const handleEdgeSelect = useCallback((pair: ZonePair) => {
    setSelectedPairKey({ sourceZoneId: pair.source_zone_id, destZoneId: pair.destination_zone_id });
  }, []);

  const handleCellClick = useCallback((pair: ZonePair) => {
    setFocusZoneIds([pair.source_zone_id, pair.destination_zone_id]);
    setSelectedPairKey({ sourceZoneId: pair.source_zone_id, destZoneId: pair.destination_zone_id });
    history.pushState({ view: "graph" }, "");
  }, []);

  const handleZoneClick = useCallback((zoneId: string) => {
    setFocusZoneIds([zoneId]);
    setSelectedPairKey(null);
    history.pushState({ view: "graph" }, "");
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setFocusZoneIds(null);
      setSelectedPairKey(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const showLoadingOverlay = dataLoading && zones.length === 0;
  const errorMessage = formatError(dataError);

  return (
    <>
      {errorMessage && (
        <div className="absolute top-0 left-0 right-0 bg-red-50 dark:bg-status-danger-dim border-b border-red-200 dark:border-status-danger/20 px-4 py-2 text-sm text-red-700 dark:text-status-danger z-10">
          {errorMessage}
        </div>
      )}
      {showLoadingOverlay ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="h-6 w-6 rounded-full border-2 border-gray-300 dark:border-noc-border border-t-ub-blue animate-spin" />
          <p className="text-sm text-gray-500 dark:text-noc-text-secondary font-body animate-pulse">
            Connecting to controller...
          </p>
        </div>
      ) : focusZoneIds ? (
        <div className="flex-1 relative">
          <button
            onClick={() => history.back()}
            className="absolute top-3 left-3 z-10 rounded-lg bg-white dark:bg-noc-surface border border-gray-300 dark:border-noc-border px-3 py-1.5 text-sm text-gray-700 dark:text-noc-text-secondary hover:bg-gray-100 dark:hover:bg-noc-raised hover:dark:text-noc-text shadow-sm dark:shadow-lg cursor-pointer transition-all"
          >
            Back to matrix
          </button>
          <ZoneGraph
            zones={zones}
            zonePairs={filteredZonePairs}
            colorMode={colorMode}
            onEdgeSelect={handleEdgeSelect}
            focusZoneIds={focusZoneIds}
            hiddenZoneIds={hiddenZoneIds}
            showHidden={showHidden}
          />
        </div>
      ) : (
        <>
          <MatrixSidebar
            zones={zones}
            hiddenZoneIds={hiddenZoneIds}
            onToggleZone={onToggleZone}
          />
          <ZoneMatrix
            zones={visibleZones}
            zonePairs={filteredZonePairs}
            onCellClick={handleCellClick}
            onZoneClick={handleZoneClick}
          />
        </>
      )}
      {selectedPair && (
        <RulePanel
          key={`${selectedPair.source_zone_id}-${selectedPair.destination_zone_id}`}
          pair={selectedPair}
          sourceZoneName={getZoneName(selectedPair.source_zone_id)}
          destZoneName={getZoneName(selectedPair.destination_zone_id)}
          aiConfigured={aiConfigured}
          onClose={() => setSelectedPairKey(null)}
          onRuleUpdated={onRefresh}
        />
      )}
    </>
  );
}
