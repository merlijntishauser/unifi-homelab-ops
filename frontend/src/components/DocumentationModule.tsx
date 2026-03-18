import { useState, useCallback, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";
import DOMPurify from "dompurify";
import { useAppContext } from "../hooks/useAppContext";
import { useDocSections } from "../hooks/queries";
import { api } from "../api/client";
import type { DocumentationSection } from "../api/types";

let mermaidIdCounter = 0;

const MERMAID_DARK = {
  background: "#0b0e14", primaryColor: "#1e2430", primaryTextColor: "#f0f2f5",
  primaryBorderColor: "#3d4455", secondaryColor: "#141820", tertiaryColor: "#1a1f2b",
  lineColor: "#006fff", textColor: "#f0f2f5", mainBkg: "#1e2430",
  nodeBorder: "#3d4455", nodeTextColor: "#f0f2f5", clusterBkg: "#141820",
  edgeLabelBackground: "#141820", fontSize: "14px",
  noteBkgColor: "#1e2430", noteTextColor: "#f0f2f5", noteBorderColor: "#3d4455",
};

const MERMAID_LIGHT = {
  background: "#f7f8fa", primaryColor: "#dbeafe", primaryTextColor: "#1a1d23",
  primaryBorderColor: "#93c5fd", secondaryColor: "#f0f2f5", tertiaryColor: "#ffffff",
  lineColor: "#006fff", textColor: "#1a1d23", mainBkg: "#dbeafe",
  nodeBorder: "#93c5fd", nodeTextColor: "#1a1d23", clusterBkg: "#f0f2f5",
  edgeLabelBackground: "#ffffff", fontSize: "14px",
  noteBkgColor: "#dbeafe", noteTextColor: "#1a1d23", noteBorderColor: "#93c5fd",
};

async function renderMermaidSvg(code: string, isDark: boolean): Promise<string> {
  mermaid.initialize({
    startOnLoad: false, theme: "base", securityLevel: "loose",
    themeVariables: isDark ? MERMAID_DARK : MERMAID_LIGHT,
  });
  const id = `mermaid-${++mermaidIdCounter}`;
  const { svg } = await mermaid.render(id, code);
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ["foreignObject"],
  });
}

function MermaidDiagram({ code, isDark }: { code: string; isDark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svgHtml, setSvgHtml] = useState<string | null>(null);

  useEffect(() => {
    renderMermaidSvg(code, isDark).then(setSvgHtml).catch(() => setSvgHtml(null));
  }, [code, isDark]);

  useEffect(() => {
    if (ref.current && svgHtml) {
      ref.current.replaceChildren();
      ref.current.insertAdjacentHTML("afterbegin", svgHtml);
    }
  }, [svgHtml]);

  if (!svgHtml) {
    return (
      <pre className="overflow-x-auto text-xs font-mono bg-ui-raised dark:bg-noc-raised p-4 rounded-lg">
        <code>{code}</code>
      </pre>
    );
  }

  return <div ref={ref} className="overflow-x-auto [&_svg]:max-w-full" />;
}

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

const SECTION_BTN = "px-2 py-1 text-xs rounded border border-ui-border dark:border-noc-border text-ui-text-secondary dark:text-noc-text-secondary hover:bg-ui-raised dark:hover:bg-noc-raised cursor-pointer transition-colors";

function downloadFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {});
}

function downloadSvgAsPng(containerRef: React.RefObject<HTMLDivElement | null>, filename: string): void {
  const svg = containerRef.current?.querySelector("svg");
  if (!svg) return;
  const svgData = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const pngUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(pngUrl);
    }, "image/png");
  };
  img.src = url;
}

function SectionActions({ section, diagramRef }: { section: DocumentationSection; diagramRef?: React.RefObject<HTMLDivElement | null> }) {
  const slug = section.id;
  const jsonStr = section.data ? JSON.stringify(section.data, null, 2) : null;
  const isMermaid = section.id === "mermaid-topology";

  return (
    <div className="flex items-center gap-1.5 mt-3 mb-2">
      <button className={SECTION_BTN} onClick={() => copyToClipboard(section.content)}>Copy MD</button>
      <button className={SECTION_BTN} onClick={() => downloadFile(section.content, `${slug}.md`, "text/markdown")}>Download MD</button>
      {jsonStr && (
        <>
          <button className={SECTION_BTN} onClick={() => copyToClipboard(jsonStr)}>Copy JSON</button>
          <button className={SECTION_BTN} onClick={() => downloadFile(jsonStr, `${slug}.json`, "application/json")}>Download JSON</button>
        </>
      )}
      {isMermaid && diagramRef && (
        <>
          <button className={SECTION_BTN} onClick={() => {
            const svg = diagramRef.current?.querySelector("svg");
            if (!svg) return;
            const svgData = new XMLSerializer().serializeToString(svg);
            downloadFile(svgData, "network-topology.svg", "image/svg+xml");
          }}>Download SVG</button>
          <button className={SECTION_BTN} onClick={() => downloadSvgAsPng(diagramRef, "network-topology.png")}>Download PNG</button>
        </>
      )}
    </div>
  );
}

interface SectionCardProps {
  section: DocumentationSection;
  expanded: boolean;
  onToggle: () => void;
  isDark: boolean;
}

function SectionCard({ section, expanded, onToggle, isDark }: SectionCardProps) {
  const contentRef = useRef<HTMLDivElement>(null);
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
          <SectionActions section={section} diagramRef={contentRef} />
          <div ref={contentRef} className="prose prose-sm dark:prose-invert max-w-none mt-3 text-ui-text-secondary dark:text-noc-text-secondary [&_h1]:text-ui-text [&_h1]:dark:text-noc-text [&_h2]:text-ui-text [&_h2]:dark:text-noc-text [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:pt-6 [&_h2]:border-t [&_h2]:border-ui-border/50 [&_h2]:dark:border-noc-border/50 [&_h3]:text-ui-text [&_h3]:dark:text-noc-text [&_h3]:mt-6 [&_h3]:mb-2 [&_h4]:mt-3 [&_h4]:mb-1 [&_strong]:text-ui-text [&_strong]:dark:text-noc-text [&_code]:text-ub-blue [&_code]:bg-ui-raised [&_code]:dark:bg-noc-raised [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_table]:w-full [&_table]:mb-4 [&_th]:text-left [&_th]:text-ui-text-secondary [&_th]:dark:text-noc-text-secondary [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:py-2 [&_th]:px-3 [&_th]:border-b [&_th]:border-ui-border [&_th]:dark:border-noc-border [&_td]:py-2 [&_td]:px-3 [&_td]:text-sm [&_td]:border-b [&_td]:border-ui-border/50 [&_td]:dark:border-noc-border/50">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
              code({ className, children }) {
                if (className === "language-mermaid") {
                  return <MermaidDiagram code={String(children).trim()} isDark={isDark} />;
                }
                return <code className={className}>{children}</code>;
              },
              pre({ children }) {
                return <>{children}</>;
              },
            }}>{section.content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionsList({ sections, expandedIds, onToggle, isDark }: { sections: DocumentationSection[]; expandedIds: Set<string>; onToggle: (id: string) => void; isDark: boolean }) {
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
          isDark={isDark}
        />
      ))}
    </div>
  );
}

export default function DocumentationModule() {
  const { connectionInfo, colorMode } = useAppContext();
  const authed = connectionInfo !== null;
  const isDark = colorMode === "dark";

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
          <SectionsList sections={sections} expandedIds={expandedIds} onToggle={handleToggle} isDark={isDark} />
        )}
      </div>
    </div>
  );
}
