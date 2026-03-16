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
    <div className="h-full flex items-center justify-center bg-ui-bg dark:bg-noc-bg p-3 lg:p-8">
      {/* Outer frame: Source label left, Destination label top, scrollable grid */}
      <div className="flex max-h-full max-w-full">
        {/* Source axis label -- outside scroll area */}
        {!isMobile && size > 0 && (
          <div className="flex items-center justify-center shrink-0 mr-1" data-testid="source-label">
            <span
              className="text-xs font-sans font-medium text-ui-text-secondary dark:text-noc-text-secondary bg-ui-surface dark:bg-noc-surface border border-ui-border dark:border-noc-border rounded-lg px-2 py-3"
              style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
            >
              Source
            </span>
          </div>
        )}

        <div className="flex flex-col min-w-0 min-h-0 flex-1">
          {/* Destination axis label -- outside scroll area */}
          {size > 0 && (
            <div className="flex justify-center shrink-0 mb-1 ml-20">
              <span className="text-xs font-sans font-medium text-ui-text-secondary dark:text-noc-text-secondary bg-ui-surface dark:bg-noc-surface border border-ui-border dark:border-noc-border rounded-lg px-4 py-2">
                Destination
              </span>
            </div>
          )}

          {/* Scrollable grid */}
          <div className="overflow-auto flex-1">
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `max-content repeat(${size}, minmax(${cellMin}, 160px))`,
                gridTemplateRows: `auto repeat(${size}, minmax(38px, 52px))`,
              }}
            >
              {/* Row 1: corner spacer (sticky both axes) + column headers (sticky top) */}
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

              {/* Data rows: row header (sticky left) + cells */}
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
    </div>
  );
}
