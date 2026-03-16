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

  return (
    <div className="h-full w-full overflow-hidden flex flex-col bg-ui-bg dark:bg-noc-bg">
      {/* Destination header -- full-width bar across the top */}
      {size > 0 && (
        <div className="shrink-0 flex items-center justify-center py-2 border-b border-ui-border dark:border-noc-border bg-ui-surface/50 dark:bg-noc-surface/50">
          <span className="text-xs font-sans font-medium text-ui-text-secondary dark:text-noc-text-secondary tracking-wide uppercase">
            Destination
          </span>
        </div>
      )}

      {/* Main area: Source label left + scrollable grid */}
      <div className="flex-1 flex min-h-0">
        {/* Source header -- full-height bar down the left */}
        {!isMobile && size > 0 && (
          <div
            className="shrink-0 flex items-center justify-center border-r border-ui-border dark:border-noc-border bg-ui-surface/50 dark:bg-noc-surface/50"
            style={{ width: 28 }}
            data-testid="source-label"
          >
            <span
              className="text-xs font-sans font-medium text-ui-text-secondary dark:text-noc-text-secondary tracking-wide uppercase"
              style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
            >
              Source
            </span>
          </div>
        )}

        {/* Scrollable grid -- constrained to remaining space */}
        <div className="flex-1 min-w-0 min-h-0 overflow-auto">
          <div
            className="grid gap-1 p-4 lg:p-6"
            style={{
              gridTemplateColumns: `max-content repeat(${size}, minmax(${cellMin}, 160px))`,
              gridTemplateRows: `auto repeat(${size}, minmax(38px, 52px))`,
              width: "max-content",
            }}
          >
            {/* Row 1: corner spacer + column headers */}
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
                  className="sticky left-0 z-10 bg-ui-bg dark:bg-noc-bg text-xs font-sans font-medium text-ui-text-secondary dark:text-noc-text-secondary whitespace-nowrap px-3 flex items-center justify-end hover:text-ub-blue cursor-pointer transition-colors"
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
      </div>
    </div>
  );
}
