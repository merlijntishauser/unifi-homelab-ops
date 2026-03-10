import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";
import { getActionColor, getEdgeColor } from "../utils/edgeColor";

export interface RuleSummary {
  name: string;
  action: string;
  protocol: string;
  portRanges: string[];
  enabled: boolean;
}

export interface RuleEdgeData {
  rules: RuleSummary[];
  allowCount: number;
  blockCount: number;
  onLabelClick?: () => void;
  [key: string]: unknown;
}

export type RuleEdge = Edge<RuleEdgeData, "rule">;

const MAX_VISIBLE = 4;

const DATA_DEFAULTS: Omit<RuleEdgeData, "onLabelClick"> = {
  rules: [],
  allowCount: 0,
  blockCount: 0,
};

function resolveData(data: RuleEdgeData | undefined): RuleEdgeData {
  if (!data) return { ...DATA_DEFAULTS };
  return data;
}

function formatPortLabel(protocol: string, portRanges: string[]): string | null {
  if (portRanges.length > 0) return `${protocol}:${portRanges.join(",")}`;
  return protocol || null;
}

export default function RuleEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<RuleEdge>) {
  const { rules, allowCount, blockCount, onLabelClick } = resolveData(data);
  const color = getEdgeColor(allowCount, blockCount);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const visibleRules = rules.slice(0, MAX_VISIBLE);
  const overflow = Math.max(0, rules.length - MAX_VISIBLE);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: selected ? 3 : 2,
        }}
      />
      <EdgeLabelRenderer>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLabelClick?.();
          }}
          className="nopan nodrag rounded-lg border border-l-[3px] px-2 py-1.5 cursor-pointer min-w-[120px] max-w-[240px] bg-white dark:bg-noc-raised border-gray-200 dark:border-noc-border shadow-sm dark:shadow-lg hover:shadow-md dark:hover:shadow-xl transition-shadow"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
            borderLeftColor: color,
          }}
        >
          {visibleRules.map((rule, i) => {
            const portLabel = formatPortLabel(rule.protocol, rule.portRanges);
            return (
              <div
                key={i}
                className={`flex items-center gap-1.5 py-0.5 ${rule.enabled ? "" : "opacity-40"}`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: getActionColor(rule.action) }}
                />
                <span className="text-[11px] font-medium text-gray-700 dark:text-noc-text truncate flex-1 text-left">
                  {rule.name}
                </span>
                {portLabel && (
                  <span className="text-[9px] font-mono text-gray-500 dark:text-noc-text-secondary bg-gray-100 dark:bg-noc-input px-1 rounded shrink-0">
                    {portLabel}
                  </span>
                )}
              </div>
            );
          })}
          {overflow > 0 && (
            <div className="text-[10px] text-gray-400 dark:text-noc-text-dim pt-0.5 text-left">
              +{overflow} more
            </div>
          )}
          {rules.length === 0 && (
            <div className="text-[10px] text-gray-400 dark:text-noc-text-dim py-0.5 text-left">
              No active rules
            </div>
          )}
        </button>
      </EdgeLabelRenderer>
    </>
  );
}
