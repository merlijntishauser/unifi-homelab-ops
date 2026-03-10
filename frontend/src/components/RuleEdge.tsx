import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";

export interface RuleEdgeData {
  allowCount: number;
  blockCount: number;
  totalRules: number;
  onLabelClick?: () => void;
  [key: string]: unknown;
}

export type RuleEdge = Edge<RuleEdgeData, "rule">;

function getEdgeColor(allowCount: number, blockCount: number): string {
  if (allowCount > 0 && blockCount === 0) return "#00d68f";
  if (blockCount > 0 && allowCount === 0) return "#ff4d5e";
  return "#ffaa2c";
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
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const color = getEdgeColor(data?.allowCount ?? 0, data?.blockCount ?? 0);
  const totalRules = data?.totalRules ?? 0;

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
            data?.onLabelClick?.();
          }}
          className="nopan nodrag"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
            background: color,
            color: "white",
            fontSize: "10px",
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            padding: "2px 8px",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            letterSpacing: "0.02em",
          }}
        >
          {totalRules} {totalRules === 1 ? "rule" : "rules"}
        </button>
      </EdgeLabelRenderer>
    </>
  );
}
