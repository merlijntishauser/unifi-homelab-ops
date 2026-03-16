import { Fragment } from "react";
import type { Zone, ZonePair } from "../api/types";
import MatrixCell from "./MatrixCell";
import { deriveCellSummary } from "../utils/matrixUtils";
import { useIsMobile } from "../hooks/useIsMobile";

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
  const isMobile = useIsMobile();
  const cellMin = isMobile ? "100px" : "130px";

  // Mobile: no Source label column -- row headers are col 1
  // Desktop: Source label (col 1) | row headers (col 2) | cells (col 3+)
  // Row headers are always sticky left-0; on desktop they cover the Source label when scrolled.
  const gridTemplateColumns = isMobile
    ? `max-content repeat(${size}, minmax(${cellMin}, 160px))`
    : `36px max-content repeat(${size}, minmax(${cellMin}, 160px))`;

  // Column where data cells start
  const cellStart = isMobile ? 2 : 3;

  return (
    <div className="h-full flex items-start justify-center p-3 lg:p-8 overflow-auto bg-ui-bg dark:bg-noc-bg">
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns,
          gridTemplateRows: `auto auto repeat(${size}, minmax(38px, 52px))`,
        }}
      >
        {/* Row 1: corner cell(s) + "Destination" label */}
        {!isMobile && <div className="sticky top-0 left-0 z-30 bg-ui-bg dark:bg-noc-bg" />}
        <div className="sticky top-0 left-0 z-30 bg-ui-bg dark:bg-noc-bg" />
        {size > 0 && (
          <div
            className="sticky top-0 z-20 bg-ui-surface dark:bg-noc-surface border border-ui-border dark:border-noc-border rounded-lg flex items-center justify-center px-3 py-2 text-xs font-sans font-medium text-ui-text-secondary dark:text-noc-text-secondary"
            style={{ gridColumn: `${cellStart} / span ${size}` }}
          >
            Destination
          </div>
        )}

        {/* Row 2: Source label (desktop, sticky but lower z than row headers) + spacer + column headers */}
        {!isMobile && (
          <div
            className="sticky left-0 z-10 bg-ui-surface dark:bg-noc-surface border border-ui-border dark:border-noc-border rounded-lg flex items-center justify-center px-1 py-1 text-xs font-sans font-medium text-ui-text-secondary dark:text-noc-text-secondary"
            style={{ gridRow: `2 / span ${size + 1}`, writingMode: "vertical-lr", transform: "rotate(180deg)" }}
            data-testid="source-label"
          >
            {size > 0 ? "Source" : ""}
          </div>
        )}
        <div className="sticky top-0 left-0 z-20 bg-ui-bg dark:bg-noc-bg" />
        {zones.map((zone) => (
          <button
            key={`col-${zone.id}`}
            data-testid={`col-header-${zone.id}`}
            onClick={() => onZoneClick(zone.id)}
            className="sticky top-0 z-10 bg-ui-bg dark:bg-noc-bg text-xs font-sans font-medium text-ui-text-secondary dark:text-noc-text-secondary truncate px-2 pb-2 hover:text-ub-blue cursor-pointer text-center transition-colors"
          >
            {zone.name}
          </button>
        ))}

        {/* Data rows */}
        {zones.map((srcZone) => (
          <Fragment key={srcZone.id}>
            <button
              data-testid={`row-header-${srcZone.id}`}
              onClick={() => onZoneClick(srcZone.id)}
              className="sticky left-0 z-20 bg-ui-bg dark:bg-noc-bg text-xs font-sans font-medium text-ui-text-secondary dark:text-noc-text-secondary whitespace-nowrap px-3 flex items-center justify-end hover:text-ub-blue cursor-pointer transition-colors"
            >
              {srcZone.name}
            </button>

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
