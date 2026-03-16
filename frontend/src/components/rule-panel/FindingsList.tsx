import { useMemo, useState } from "react";
import type { Finding } from "../../api/types";

function severityBadge(severity: string): string {
  switch (severity) {
    case "high":
      return "bg-red-100 dark:bg-status-danger-dim text-red-700 dark:text-status-danger";
    case "medium":
      return "bg-amber-100 dark:bg-status-warning-dim text-amber-700 dark:text-status-warning";
    case "low":
      return "bg-blue-100 dark:bg-ub-blue-dim text-blue-700 dark:text-ub-blue";
    default:
      return "bg-ui-raised dark:bg-noc-raised text-ui-text-secondary dark:text-noc-text-secondary";
  }
}

const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function FindingCard({ finding }: { finding: Finding }) {
  const [showDetails, setShowDetails] = useState(false);
  const hasDetails = !!(finding.rationale || finding.recommended_action);
  return (
    <div className="rounded-lg border border-ui-border dark:border-noc-border p-2.5 text-xs bg-ui-raised dark:bg-noc-raised/50">
      <div className="flex items-center gap-1.5">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${severityBadge(finding.severity)}`}>
          {finding.severity}
        </span>
        {finding.source === "ai" && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-ub-blue-dim text-ub-blue dark:text-ub-blue-light">
            AI
          </span>
        )}
        {finding.confidence && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-ui-raised dark:bg-noc-raised text-ui-text-secondary dark:text-noc-text-dim">
            {finding.confidence}
          </span>
        )}
        <span className="font-medium text-ui-text dark:text-noc-text">{finding.title}</span>
      </div>
      <p className="mt-1 text-ui-text-secondary dark:text-noc-text-secondary">{finding.description}</p>
      {hasDetails && (
        <>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="mt-1 text-[10px] font-medium text-ub-blue hover:text-ub-blue-light cursor-pointer transition-colors"
          >
            {showDetails ? "Hide details" : "Details"}
          </button>
          {showDetails && (
            <div className="mt-1 pl-2 border-l-2 border-ub-blue/30 text-[11px] animate-fade-in space-y-1">
              {finding.rationale && (
                <p className="text-ui-text-secondary dark:text-noc-text-secondary">{finding.rationale}</p>
              )}
              {finding.recommended_action && (
                <p className="text-ui-text-secondary dark:text-noc-text-secondary">
                  <span className="font-medium">Action:</span> {finding.recommended_action}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function FindingsList({ findings }: { findings: Finding[] }) {
  const sorted = useMemo(() => {
    return [...findings].sort(
      (a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3)
    );
  }, [findings]);

  return (
    <div className="space-y-1.5">
      <h3 className="text-[10px] font-semibold text-ui-text-dim dark:text-noc-text-dim uppercase tracking-widest">
        Findings ({findings.length})
      </h3>
      {sorted.map((finding, idx) => (
        <FindingCard key={finding.id ?? idx} finding={finding} />
      ))}
    </div>
  );
}
