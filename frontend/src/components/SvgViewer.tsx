import { useCallback, useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";

interface SvgViewerProps {
  svgContent: string;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.1;

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** Zoom and pan are one viewport: a wheel zoom derives the pan from the zoom it
 *  just computed, so they must be updated together to stay consistent. */
interface View {
  zoom: number;
  x: number;
  y: number;
}

const INITIAL_VIEW: View = { zoom: 1, x: 0, y: 0 };

export default function SvgViewer({ svgContent }: SvgViewerProps) {
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const [dragging, setDragging] = useState(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      // svgContent is generated server-side by unifi-topology (trusted), but
      // sanitize at the DOM sink as defense-in-depth before injecting it.
      svgRef.current.innerHTML = DOMPurify.sanitize(svgContent, {
        USE_PROFILES: { svg: true, svgFilters: true },
        ADD_TAGS: ["foreignObject"],
      });
    }
  }, [svgContent]);

  // Registered natively rather than via React's onWheel: React attaches wheel
  // listeners as passive, where preventDefault() does nothing but log
  // "Unable to preventDefault inside passive event listener invocation" -- so
  // the page scrolled behind the diagram on every zoom.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = container!.getBoundingClientRect();
      if (!rect) return;
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const direction = e.deltaY < 0 ? 1 : -1;

      // Functional update: wheel events arrive faster than React re-renders, so
      // reading zoom from the closure made a fast scroll compound off a stale
      // value and under-zoom.
      setView((prev) => {
        const zoom = clampZoom(prev.zoom + direction * ZOOM_STEP * prev.zoom);
        const scale = zoom / prev.zoom;
        return {
          zoom,
          x: cursorX - scale * (cursorX - prev.x),
          y: cursorY - scale * (cursorY - prev.y),
        };
      });
    }

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setDragging(true);
    lastPointer.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    setView((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  }, [dragging]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  const resetView = useCallback(() => setView(INITIAL_VIEW), []);

  const zoomIn = useCallback(
    () => setView((v) => ({ ...v, zoom: clampZoom(v.zoom + ZOOM_STEP * v.zoom) })), []);
  const zoomOut = useCallback(
    () => setView((v) => ({ ...v, zoom: clampZoom(v.zoom - ZOOM_STEP * v.zoom) })), []);

  return (
    <div className="relative flex-1 overflow-hidden bg-ui-bg dark:bg-noc-bg">
      <div
        ref={containerRef}
        className={`size-full ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        data-testid="svg-viewer"
      >
        <div
          ref={svgRef}
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
            transformOrigin: "0 0",
          }}
        />
      </div>
      <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-lg bg-ui-surface dark:bg-noc-surface border border-ui-border dark:border-noc-border shadow-sm overflow-hidden">
        <button type="button" onClick={zoomOut} className="px-2 py-1 text-sm text-ui-text-secondary dark:text-noc-text-secondary hover:bg-ui-raised dark:hover:bg-noc-raised transition-colors" aria-label="Zoom out">-</button>
        <button type="button" onClick={resetView} className="px-2 py-1 text-xs text-ui-text-secondary dark:text-noc-text-dim hover:bg-ui-raised dark:hover:bg-noc-raised transition-colors min-w-[3rem] text-center" aria-label="Reset zoom">
          {Math.round(view.zoom * 100)}%
        </button>
        <button type="button" onClick={zoomIn} className="px-2 py-1 text-sm text-ui-text-secondary dark:text-noc-text-secondary hover:bg-ui-raised dark:hover:bg-noc-raised transition-colors" aria-label="Zoom in">+</button>
      </div>
    </div>
  );
}
