import { Fragment } from "react";
import type { Zone, ZonePair } from "../api/types";
import MatrixCell from "./MatrixCell";
import { deriveCellSummary } from "../utils/matrixUtils";

interface ZoneMatrixProps {
  zones: Zone[];
  zonePairs: ZonePair[];
  onCellClick: (pair: ZonePair) => void;
  onZoneClick: (zoneId: string) => void;
}

function findPair(zonePairs: ZonePair[], srcId: string, dstId: string): ZonePair | undefined {
  return zonePairs.find((p) => p.source_zone_id === srcId && p.destination_zone_id === dstId);
}

export default function ZoneMatrix({ zones, zonePairs, onCellClick, onZoneClick }: ZoneMatrixProps) {
  const size = zones.length;

  return (
    <div className="h-full flex items-start justify-center p-8 overflow-auto bg-gray-50 dark:bg-noc-bg">
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `minmax(80px, max-content) auto repeat(${size}, minmax(130px, 160px))`,
          gridTemplateRows: `auto auto repeat(${size}, minmax(38px, 52px))`,
        }}
      >
        {/* Row 1: empty corner cells + "Destination" label spanning columns */}
        <div className="sticky top-0 left-0 z-30 bg-gray-50 dark:bg-noc-bg" />
        <div className="sticky top-0 left-0 z-30 bg-gray-50 dark:bg-noc-bg" />
        {size > 0 && (
          <div
            className="sticky top-0 z-20 bg-white dark:bg-noc-surface border border-gray-200 dark:border-noc-border rounded-lg flex items-center justify-center px-3 py-2 text-xs font-display font-medium text-gray-500 dark:text-noc-text-secondary"
            style={{ gridColumn: `3 / span ${size}` }}
          >
            Destination
          </div>
        )}

        {/* Row 2: "Source" label cell + empty cell + column headers */}
        <div
          className="sticky left-0 z-20 bg-white dark:bg-noc-surface border border-gray-200 dark:border-noc-border rounded-lg flex items-center justify-center px-3 py-2 text-xs font-display font-medium text-gray-500 dark:text-noc-text-secondary"
          style={{ gridRow: `2 / span ${size + 1}`, writingMode: "vertical-lr", transform: "rotate(180deg)" }}
          data-testid="source-label"
        >
          {size > 0 ? "Source" : ""}
        </div>
        <div className="sticky top-0 z-20 bg-gray-50 dark:bg-noc-bg" />
        {zones.map((zone) => (
          <button
            key={`col-${zone.id}`}
            data-testid={`col-header-${zone.id}`}
            onClick={() => onZoneClick(zone.id)}
            className="sticky top-0 z-10 bg-gray-50 dark:bg-noc-bg text-xs font-display font-medium text-gray-600 dark:text-noc-text-secondary truncate px-2 pb-2 hover:text-ub-blue cursor-pointer text-center transition-colors"
          >
            {zone.name}
          </button>
        ))}

        {/* Data rows */}
        {zones.map((srcZone) => (
          <Fragment key={srcZone.id}>
            {/* Row header */}
            <button
              data-testid={`row-header-${srcZone.id}`}
              onClick={() => onZoneClick(srcZone.id)}
              className="sticky left-0 z-10 bg-gray-50 dark:bg-noc-bg text-xs font-display font-medium text-gray-600 dark:text-noc-text-secondary whitespace-nowrap pr-3 flex items-center justify-end hover:text-ub-blue cursor-pointer transition-colors"
            >
              {srcZone.name}
            </button>

            {/* Cells */}
            {zones.map((dstZone) => {
              const pair = findPair(zonePairs, srcZone.id, dstZone.id);
              const isSelf = srcZone.id === dstZone.id;
              const summary = pair ? deriveCellSummary(pair) : null;

              return (
                <MatrixCell
                  key={`${srcZone.id}-${dstZone.id}`}
                  actionLabel={summary?.actionLabel ?? null}
                  userRuleCount={summary?.userRuleCount ?? 0}
                  predefinedRuleCount={summary?.predefinedRuleCount ?? 0}
                  grade={pair?.analysis?.grade ?? null}
                  onClick={() => {
                    if (pair && !isSelf) {
                      onCellClick(pair);
                    }
                  }}
                  isSelfPair={isSelf}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
