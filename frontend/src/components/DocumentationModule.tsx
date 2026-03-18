import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { useAppContext } from "../hooks/useAppContext";
import { useDocSections } from "../hooks/queries";
import { api } from "../api/client";
import type { DocumentationSection } from "../api/types";

const BTN =
  "rounded-lg border border-ui-border dark:border-noc-border px-3 py-1.5 min-h-[44px] text-sm text-ui-text-secondary dark:text-noc-text-secondary hover:bg-ui-raised dark:hover:bg-noc-raised hover:text-ui-text dark:hover:text-noc-text hover:border-ui-border-hover dark:hover:border-noc-border-hover cursor-pointer transition-all";

function LoadingSpinner({ message }: { message: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <div className="h-6 w-6 rounded-full border-2 border-ui-border dark:border-noc-border border-t-ub-blue animate-spin" />
      <p className="text-sm text-ui-text-secondary dark:text-noc-text-secondary">{message}</p>
    </div>
  );
}

function ErrorMessage({ error, fallback }: { error: Error | null; fallback: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <p className="text-sm text-status-danger">
        {error instanceof Error && error.message ? error.message : fallback}
      </p>
    </div>
  );
}

interface SectionCardProps {
  section: DocumentationSection;
  expanded: boolean;
  onToggle: () => void;
}

function SectionCard({ section, expanded, onToggle }: SectionCardProps) {
  return (
    <div className="bg-ui-surface dark:bg-noc-surface rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-ui-raised dark:hover:bg-noc-raised transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`w-4 h-4 shrink-0 text-ui-text-dim dark:text-noc-text-dim transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="text-sm font-semibold text-ui-text dark:text-noc-text">{section.title}</span>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-ui-raised dark:bg-noc-raised text-ui-text-dim dark:text-noc-text-dim">
          {section.item_count}
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-ui-border dark:border-noc-border">
          <div className="prose prose-sm dark:prose-invert max-w-none mt-3 text-ui-text-secondary dark:text-noc-text-secondary [&_h1]:text-ui-text [&_h1]:dark:text-noc-text [&_h2]:text-ui-text [&_h2]:dark:text-noc-text [&_h3]:text-ui-text [&_h3]:dark:text-noc-text [&_strong]:text-ui-text [&_strong]:dark:text-noc-text [&_code]:text-ub-blue [&_code]:bg-ui-raised [&_code]:dark:bg-noc-raised [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_table]:w-full [&_th]:text-left [&_th]:text-ui-text-secondary [&_th]:dark:text-noc-text-secondary [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:py-2 [&_th]:px-3 [&_th]:border-b [&_th]:border-ui-border [&_th]:dark:border-noc-border [&_td]:py-2 [&_td]:px-3 [&_td]:text-sm [&_td]:border-b [&_td]:border-ui-border/50 [&_td]:dark:border-noc-border/50">
            <ReactMarkdown>{section.content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionsList({ sections, expandedIds, onToggle }: { sections: DocumentationSection[]; expandedIds: Set<string>; onToggle: (id: string) => void }) {
  if (sections.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-ui-text-secondary dark:text-noc-text-secondary">No documentation sections available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sections.map((section) => (
        <SectionCard
          key={section.id}
          section={section}
          expanded={expandedIds.has(section.id)}
          onToggle={() => onToggle(section.id)}
        />
      ))}
    </div>
  );
}

export default function DocumentationModule() {
  const { connectionInfo } = useAppContext();
  const authed = connectionInfo !== null;

  const sectionsQuery = useDocSections(authed);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const markdown = await api.getDocExport();
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "network-documentation.md";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Export failed silently -- the user will notice nothing downloaded
    } finally {
      setExporting(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    void sectionsQuery.refetch();
  }, [sectionsQuery]);

  const sections = sectionsQuery.data?.sections ?? [];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-3 lg:px-4 py-2 border-b border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-surface shrink-0">
        <button onClick={handleExport} disabled={exporting} className={BTN}>
          {exporting ? "Exporting..." : "Export Markdown"}
        </button>
        <button onClick={handleRefresh} disabled={sectionsQuery.isLoading} className={BTN}>
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {sectionsQuery.isLoading && !sectionsQuery.data ? (
          <LoadingSpinner message="Loading documentation..." />
        ) : sectionsQuery.error ? (
          <ErrorMessage error={sectionsQuery.error} fallback="Failed to load documentation" />
        ) : (
          <SectionsList sections={sections} expandedIds={expandedIds} onToggle={handleToggle} />
        )}
      </div>
    </div>
  );
}
