import { useCallback, useMemo, useReducer, useState } from "react";
import type { CableRun, CableRunInput, PatchPanel, PatchPanelInput } from "../api/types";
import { INPUT_CLASS, SELECT_CLASS, BACKDROP_CLASS, CLOSE_BUTTON_CLASS } from "./ui";
import {
  useCables,
  usePatchPanels,
  useCreateCable,
  useUpdateCable,
  useDeleteCable,
  useSyncCables,
  useCreatePatchPanel,
  useUpdatePatchPanel,
  useDeletePatchPanel,
} from "../hooks/queries";

// --- Shared button styles ---

const btnClass =
  "inline-flex items-center rounded-lg border border-ui-border dark:border-noc-border px-3 py-1.5 min-h-[36px] text-sm text-ui-text-secondary dark:text-noc-text-secondary hover:bg-ui-raised dark:hover:bg-noc-raised hover:text-ui-text dark:hover:text-noc-text hover:border-ui-border-hover dark:hover:border-noc-border-hover cursor-pointer transition-all";

const btnPrimaryClass =
  "inline-flex items-center rounded-lg border border-ub-blue bg-ub-blue px-3 py-1.5 min-h-[36px] text-sm text-white hover:bg-ub-blue-light cursor-pointer transition-all";

const btnDangerClass =
  "inline-flex items-center rounded-lg border border-status-danger bg-status-danger px-3 py-1.5 min-h-[36px] text-sm text-white hover:opacity-90 cursor-pointer transition-all";

const labelClass = "block text-xs text-ui-text-dim dark:text-noc-text-dim mb-1";

// --- Status helpers ---

const STATUS_OPTIONS = ["active", "spare", "faulty", "disconnected"] as const;

const STATUS_COLORS: Record<string, string> = {
  active: "bg-status-success",
  spare: "bg-gray-400 dark:bg-gray-500",
  faulty: "bg-status-danger",
  disconnected: "bg-status-warning",
};

function StatusDot({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "bg-gray-400";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} title={status} />;
}

// --- Cable type / sort helpers ---

const CABLE_TYPE_OPTIONS = ["cat5e", "cat6", "cat6a", "fiber-om3", "fiber-os2", "dac"] as const;

type SortField = "label" | "source" | "destination" | "type" | "length" | "speed" | "status";

function formatSpeed(speed: number | null): string {
  if (speed === null) return "--";
  if (speed >= 1000) return `${speed / 1000}G`;
  return `${speed}M`;
}

function formatLength(m: number | null): string {
  if (m === null) return "--";
  return `${m}m`;
}

function getCableSortValue(cable: CableRun, field: SortField): string | number {
  switch (field) {
    case "label": return cable.label.toLowerCase();
    case "source": return (cable.source_device_name ?? cable.source_device_mac ?? "").toLowerCase();
    case "destination": return (cable.dest_device_name ?? cable.dest_label ?? "").toLowerCase();
    case "type": return cable.cable_type;
    case "length": return cable.length_m ?? 0;
    case "speed": return cable.speed ?? 0;
    case "status": return cable.status;
  }
}

// --- Form init helpers (extracted to reduce per-function complexity) ---

function buildCableFormDefaults(cable: CableRun | null): CableRunInput {
  if (!cable) {
    return {
      source_device_mac: null, source_port: null, dest_device_mac: null, dest_port: null,
      dest_label: "", patch_panel_id: null, patch_panel_port: null, cable_type: "cat6",
      length_m: null, color: "", label: "", speed: null, poe: false, status: "active", notes: "",
    };
  }
  return {
    source_device_mac: cable.source_device_mac, source_port: cable.source_port,
    dest_device_mac: cable.dest_device_mac, dest_port: cable.dest_port,
    dest_label: cable.dest_label, patch_panel_id: cable.patch_panel_id,
    patch_panel_port: cable.patch_panel_port, cable_type: cable.cable_type,
    length_m: cable.length_m, color: cable.color, label: cable.label,
    speed: cable.speed, poe: cable.poe, status: cable.status, notes: cable.notes,
  };
}

function buildPanelFormDefaults(panel: PatchPanel | null): PatchPanelInput {
  if (!panel) {
    return { name: "", port_count: 24, panel_type: "keystone", rack_mounted: false, rack_item_id: null, location: "", notes: "" };
  }
  return {
    name: panel.name, port_count: panel.port_count, panel_type: panel.panel_type,
    rack_mounted: panel.rack_mounted, rack_item_id: panel.rack_item_id,
    location: panel.location, notes: panel.notes,
  };
}

// --- Shared slide panel shell ---

interface SlidePanelProps {
  title: string;
  testId: string;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}

function SlidePanel({ title, testId, onClose, footer, children }: SlidePanelProps) {
  return (
    <>
      <div className={BACKDROP_CLASS} role="presentation" onClick={onClose} />
      <aside
        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-ui-surface dark:bg-noc-surface border-l border-ui-border dark:border-noc-border shadow-xl z-50 flex flex-col overflow-hidden"
        role="dialog"
        aria-label={title}
        data-testid={testId}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-ui-border dark:border-noc-border shrink-0">
          <h3 className="text-sm font-semibold text-ui-text dark:text-noc-text flex-1">{title}</h3>
          <button onClick={onClose} className={CLOSE_BUTTON_CLASS} aria-label="Close">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        <div className="flex items-center gap-2 px-4 py-3 border-t border-ui-border dark:border-noc-border shrink-0">
          {footer}
        </div>
      </aside>
    </>
  );
}

// --- CableFormFields ---

interface CableFormFieldsProps {
  form: CableRunInput;
  update: (patch: Partial<CableRunInput>) => void;
  panels: PatchPanel[];
}

function CableFormFields({ form, update, panels }: CableFormFieldsProps) {
  const parseOptionalFloat = (v: string) => v ? parseFloat(v) : null;
  const parseOptionalInt = (v: string) => v ? parseInt(v) : null;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label htmlFor="cable-label" className={labelClass}>Label</label>
        <input id="cable-label" type="text" value={form.label} onChange={(e) => update({ label: e.target.value })} placeholder="e.g. C-001" className={INPUT_CLASS} />
      </div>
      <div>
        <label htmlFor="cable-type" className={labelClass}>Cable Type</label>
        <select id="cable-type" value={form.cable_type} onChange={(e) => update({ cable_type: e.target.value })} className={SELECT_CLASS}>
          {CABLE_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="cable-status" className={labelClass}>Status</label>
        <select id="cable-status" value={form.status} onChange={(e) => update({ status: e.target.value })} className={SELECT_CLASS}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="cable-length" className={labelClass}>Length (m)</label>
        <input id="cable-length" type="number" value={form.length_m ?? ""} onChange={(e) => update({ length_m: parseOptionalFloat(e.target.value) })} min={0} step={0.1} className={INPUT_CLASS} />
      </div>
      <div>
        <label htmlFor="cable-speed" className={labelClass}>Speed (Mbps)</label>
        <input id="cable-speed" type="number" value={form.speed ?? ""} onChange={(e) => update({ speed: parseOptionalInt(e.target.value) })} min={0} className={INPUT_CLASS} />
      </div>
      <div>
        <label htmlFor="cable-color" className={labelClass}>Color</label>
        <input id="cable-color" type="text" value={form.color} onChange={(e) => update({ color: e.target.value })} placeholder="e.g. blue" className={INPUT_CLASS} />
      </div>
      <div>
        <label htmlFor="cable-poe" className={labelClass}>PoE</label>
        <select id="cable-poe" value={form.poe ? "true" : "false"} onChange={(e) => update({ poe: e.target.value === "true" })} className={SELECT_CLASS}>
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>
      </div>
      <div>
        <label htmlFor="cable-dest-label" className={labelClass}>Dest Label</label>
        <input id="cable-dest-label" type="text" value={form.dest_label} onChange={(e) => update({ dest_label: e.target.value })} placeholder="e.g. Office 201-A" className={INPUT_CLASS} />
      </div>
      <div>
        <label htmlFor="cable-panel" className={labelClass}>Patch Panel</label>
        <select id="cable-panel" value={form.patch_panel_id ?? ""} onChange={(e) => update({ patch_panel_id: parseOptionalInt(e.target.value) })} className={SELECT_CLASS}>
          <option value="">None</option>
          {panels.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="cable-panel-port" className={labelClass}>Panel Port</label>
        <input id="cable-panel-port" type="number" value={form.patch_panel_port ?? ""} onChange={(e) => update({ patch_panel_port: parseOptionalInt(e.target.value) })} min={1} className={INPUT_CLASS} />
      </div>
      <div className="col-span-2">
        <label htmlFor="cable-notes" className={labelClass}>Notes</label>
        <input id="cable-notes" type="text" value={form.notes} onChange={(e) => update({ notes: e.target.value })} className={INPUT_CLASS} />
      </div>
    </div>
  );
}

// --- CableEditPanel ---

interface CableEditPanelProps {
  cable: CableRun | null;
  panels: PatchPanel[];
  onSave: (data: CableRunInput) => void;
  onDelete?: () => void;
  onClose: () => void;
  title: string;
}

function CableEditPanel({ cable, panels, onSave, onDelete, onClose, title }: CableEditPanelProps) {
  const [form, setForm] = useState<CableRunInput>(() => buildCableFormDefaults(cable));
  const update = (patch: Partial<CableRunInput>) => setForm((prev) => ({ ...prev, ...patch }));

  return (
    <SlidePanel title={title} testId="cable-edit-panel" onClose={onClose} footer={
      <>
        <button onClick={() => onSave(form)} className={btnPrimaryClass} data-testid="cable-save-button">Save</button>
        {onDelete && <button onClick={onDelete} className={btnDangerClass} data-testid="cable-delete-button">Delete</button>}
        <button onClick={onClose} className={btnClass}>Cancel</button>
      </>
    }>
      <CableFormFields form={form} update={update} panels={panels} />
    </SlidePanel>
  );
}

// --- PanelFormFields ---

interface PanelFormFieldsProps {
  form: PatchPanelInput;
  update: (patch: Partial<PatchPanelInput>) => void;
}

function PanelFormFields({ form, update }: PanelFormFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label htmlFor="panel-name" className={labelClass}>Name</label>
        <input id="panel-name" type="text" value={form.name} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. PP-01 Meterkast" className={INPUT_CLASS} />
      </div>
      <div>
        <label htmlFor="panel-port-count" className={labelClass}>Port Count</label>
        <input id="panel-port-count" type="number" value={form.port_count ?? 24} onChange={(e) => update({ port_count: parseInt(e.target.value) || 24 })} min={1} className={INPUT_CLASS} />
      </div>
      <div>
        <label htmlFor="panel-type" className={labelClass}>Type</label>
        <select id="panel-type" value={form.panel_type} onChange={(e) => update({ panel_type: e.target.value })} className={SELECT_CLASS}>
          <option value="keystone">Keystone</option>
          <option value="fixed">Fixed</option>
          <option value="fiber">Fiber</option>
        </select>
      </div>
      <div className="col-span-2">
        <label htmlFor="panel-location" className={labelClass}>Location</label>
        <input id="panel-location" type="text" value={form.location} onChange={(e) => update({ location: e.target.value })} placeholder="e.g. Server room" className={INPUT_CLASS} />
      </div>
      <div className="col-span-2">
        <label htmlFor="panel-notes" className={labelClass}>Notes</label>
        <input id="panel-notes" type="text" value={form.notes} onChange={(e) => update({ notes: e.target.value })} className={INPUT_CLASS} />
      </div>
    </div>
  );
}

// --- PanelEditPanel ---

interface PanelEditPanelProps {
  panel: PatchPanel | null;
  onSave: (data: PatchPanelInput) => void;
  onDelete?: () => void;
  onClose: () => void;
  title: string;
}

function PanelEditPanel({ panel, onSave, onDelete, onClose, title }: PanelEditPanelProps) {
  const [form, setForm] = useState<PatchPanelInput>(() => buildPanelFormDefaults(panel));
  const update = (patch: Partial<PatchPanelInput>) => setForm((prev) => ({ ...prev, ...patch }));

  return (
    <SlidePanel title={title} testId="panel-edit-panel" onClose={onClose} footer={
      <>
        <button onClick={() => onSave(form)} disabled={!form.name.trim()} className={`${btnPrimaryClass} disabled:opacity-40 disabled:cursor-not-allowed`} data-testid="panel-save-button">Save</button>
        {onDelete && <button onClick={onDelete} className={btnDangerClass} data-testid="panel-delete-button">Delete</button>}
        <button onClick={onClose} className={btnClass}>Cancel</button>
      </>
    }>
      <PanelFormFields form={form} update={update} />
    </SlidePanel>
  );
}

// --- Port grid for PatchPanelCard ---

function PortGrid({ panel, portMap }: { panel: PatchPanel; portMap: Map<number, CableRun> }) {
  return (
    <div className="mt-2 border-t border-ui-border dark:border-noc-border pt-2" data-testid={`panel-ports-${panel.id}`}>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1">
        {Array.from({ length: panel.port_count }, (_, i) => {
          const portNum = i + 1;
          const cable = portMap.get(portNum);
          const portTitle = cable
            ? `${cable.label} - ${cable.source_device_name ?? cable.source_device_mac ?? "?"} -> ${cable.dest_device_name ?? cable.dest_label ?? "?"}`
            : `Port ${portNum} (empty)`;
          return (
            <div
              key={portNum}
              className={`text-center p-1 rounded text-[10px] font-mono ${cable ? "bg-ub-blue-dim text-ub-blue" : "bg-ui-raised dark:bg-noc-input text-ui-text-dim dark:text-noc-text-dim"}`}
              title={portTitle}
            >
              {portNum}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- PatchPanelCard ---

interface PatchPanelCardProps {
  panel: PatchPanel;
  cables: CableRun[];
  onEdit: () => void;
}

function PatchPanelCard({ panel, cables, onEdit }: PatchPanelCardProps) {
  const [expanded, setExpanded] = useState(false);

  const panelCables = useMemo(
    () => cables.filter((c) => c.patch_panel_id === panel.id),
    [cables, panel.id],
  );

  const portMap = useMemo(() => {
    const map = new Map<number, CableRun>();
    for (const cable of panelCables) {
      if (cable.patch_panel_port !== null) {
        map.set(cable.patch_panel_port, cable);
      }
    }
    return map;
  }, [panelCables]);

  const fillPercent = panel.port_count > 0 ? Math.min(Math.round((panel.assigned_ports / panel.port_count) * 100), 100) : 0;

  return (
    <div
      className="rounded-lg border border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-raised p-4 cursor-pointer hover:border-ui-border-hover dark:hover:border-noc-border-hover hover:shadow-md transition-all"
      data-testid={`panel-card-${panel.id}`}
    >
      <div
        className="flex items-center gap-2 mb-1"
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpanded((v) => !v); }}
      >
        <span className="font-sans font-semibold text-sm text-ui-text dark:text-noc-text truncate flex-1">{panel.name}</span>
        <span className="text-xs font-mono text-ui-text-secondary dark:text-noc-text-secondary">{panel.assigned_ports}/{panel.port_count}</span>
      </div>

      <p className="text-xs text-ui-text-dim dark:text-noc-text-dim mb-2">
        {panel.panel_type}
        {panel.location && <span> / {panel.location}</span>}
      </p>

      <div className="mb-2">
        <div className="h-1.5 rounded-full bg-ui-raised dark:bg-noc-input overflow-hidden">
          <div className="h-full rounded-full bg-ub-blue" style={{ width: `${fillPercent}%` }} />
        </div>
      </div>

      <button onClick={onEdit} className={`${btnClass} text-xs mb-2`} data-testid={`panel-edit-${panel.id}`}>Edit</button>

      {expanded && <PortGrid panel={panel} portMap={portMap} />}
    </div>
  );
}

// --- CableRow ---

function CableRow({ cable, panelName, onClick }: { cable: CableRun; panelName: string; onClick: () => void }) {
  const tdClass = "px-3 py-2 text-sm text-ui-text dark:text-noc-text-secondary";

  return (
    <tr
      className="border-b border-ui-border/50 dark:border-noc-border/50 hover:bg-ui-raised dark:hover:bg-noc-raised cursor-pointer transition-colors"
      onClick={onClick}
      data-testid={`cable-row-${cable.id}`}
    >
      <td className={`${tdClass} font-mono font-medium`}>{cable.label || "--"}</td>
      <td className={tdClass}>
        {cable.source_device_name ?? cable.source_device_mac ?? "--"}
        {cable.source_port !== null && <span className="text-ui-text-dim dark:text-noc-text-dim"> :{cable.source_port}</span>}
      </td>
      <td className={tdClass}>
        {cable.dest_device_name ?? (cable.dest_label || "--")}
        {cable.dest_port !== null && <span className="text-ui-text-dim dark:text-noc-text-dim"> :{cable.dest_port}</span>}
      </td>
      <td className={tdClass}>{panelName}</td>
      <td className={tdClass}>{cable.cable_type}</td>
      <td className={`${tdClass} font-mono`}>{formatLength(cable.length_m)}</td>
      <td className={`${tdClass} font-mono`}>{formatSpeed(cable.speed)}</td>
      <td className={tdClass}>
        <span className="inline-flex items-center gap-1.5">
          <StatusDot status={cable.status} />
          <span className="text-xs">{cable.status}</span>
        </span>
      </td>
    </tr>
  );
}

// --- CableTable ---

interface CableTableProps {
  cables: CableRun[];
  panels: PatchPanel[];
  onEditCable: (cable: CableRun) => void;
  onAddCable: () => void;
  onSync: () => void;
  isSyncing: boolean;
}

function getPanelDisplay(cable: CableRun, panels: PatchPanel[]): string {
  if (!cable.patch_panel_id) return "--";
  const name = cable.patch_panel_name ?? panels.find((p) => p.id === cable.patch_panel_id)?.name ?? `Panel ${cable.patch_panel_id}`;
  return cable.patch_panel_port !== null ? `${name} #${cable.patch_panel_port}` : name;
}

function CableTable({ cables, panels, onEditCable, onAddCable, onSync, isSyncing }: CableTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("label");
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  }, [sortField]);

  const filtered = useMemo(() => {
    let result = cables;
    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter);
    }
    return [...result].sort((a, b) => {
      const va = getCableSortValue(a, sortField);
      const vb = getCableSortValue(b, sortField);
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortAsc ? cmp : -cmp;
    });
  }, [cables, statusFilter, sortField, sortAsc]);

  const thClass = "text-left px-3 py-2 text-xs font-semibold text-ui-text-dim dark:text-noc-text-dim cursor-pointer select-none hover:text-ui-text dark:hover:text-noc-text transition-colors";

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return "";
    return sortAsc ? " \u2191" : " \u2193";
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-3 lg:px-4 py-2.5 border-b border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-surface shrink-0">
        <span className="text-sm text-ui-text-dim dark:text-noc-text-dim hidden sm:block">Cables</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-ui-border dark:border-noc-border bg-ui-input dark:bg-noc-input px-2 py-1 text-xs text-ui-text dark:text-noc-text"
          data-testid="status-filter"
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="ml-auto" />
        <button onClick={onSync} disabled={isSyncing} className={btnClass} data-testid="sync-button">
          {isSyncing ? "Syncing..." : "Sync from Topology"}
        </button>
        <button onClick={onAddCable} className={btnClass} data-testid="add-cable-button">Add Cable</button>
      </div>
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
            <p className="text-sm text-ui-text-secondary dark:text-noc-text-secondary">No cables found</p>
          </div>
        ) : (
          <table className="w-full min-w-[700px]" data-testid="cable-table">
            <thead className="border-b border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-surface sticky top-0">
              <tr>
                <th className={thClass} onClick={() => handleSort("label")}>Label{sortIndicator("label")}</th>
                <th className={thClass} onClick={() => handleSort("source")}>Source{sortIndicator("source")}</th>
                <th className={thClass} onClick={() => handleSort("destination")}>Destination{sortIndicator("destination")}</th>
                <th className={thClass}>Via</th>
                <th className={thClass} onClick={() => handleSort("type")}>Type{sortIndicator("type")}</th>
                <th className={thClass} onClick={() => handleSort("length")}>Length{sortIndicator("length")}</th>
                <th className={thClass} onClick={() => handleSort("speed")}>Speed{sortIndicator("speed")}</th>
                <th className={thClass} onClick={() => handleSort("status")}>Status{sortIndicator("status")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cable) => (
                <CableRow key={cable.id} cable={cable} panelName={getPanelDisplay(cable, panels)} onClick={() => onEditCable(cable)} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// --- PatchPanelsView ---

interface PatchPanelsViewProps {
  panels: PatchPanel[];
  cables: CableRun[];
  onAddPanel: () => void;
  onEditPanel: (panel: PatchPanel) => void;
}

function PatchPanelsView({ panels, cables, onAddPanel, onEditPanel }: PatchPanelsViewProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-3 lg:px-4 py-2.5 border-b border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-surface shrink-0">
        <span className="text-sm text-ui-text-dim dark:text-noc-text-dim">Patch Panels</span>
        <div className="ml-auto" />
        <button onClick={onAddPanel} className={btnClass} data-testid="add-panel-button">New Panel</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {panels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-sm text-ui-text-secondary dark:text-noc-text-secondary">No patch panels yet</p>
            <button onClick={onAddPanel} className={btnPrimaryClass}>Create Your First Panel</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {panels.map((panel) => (
              <PatchPanelCard key={panel.id} panel={panel} cables={cables} onEdit={() => onEditPanel(panel)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Segmented toggle ---

const segmentClass = (active: boolean, isFirst: boolean) =>
  `px-3 py-1.5 min-h-[36px] text-sm transition-colors ${!isFirst ? "border-l border-ui-border dark:border-noc-border" : ""} ${
    active ? "bg-blue-50 dark:bg-ub-blue-dim text-ub-blue font-medium" : "text-ui-text-secondary dark:text-noc-text-secondary hover:bg-ui-raised dark:hover:bg-noc-raised"
  }`;

// --- Cable mutation handlers (extracted to reduce main component complexity) ---

function useCableMutations() {
  const createCable = useCreateCable();
  const updateCableMut = useUpdateCable();
  const deleteCableMut = useDeleteCable();
  const syncCables = useSyncCables();
  return { createCable, updateCableMut, deleteCableMut, syncCables };
}

function usePanelMutations() {
  const createPanel = useCreatePatchPanel();
  const updatePanelMut = useUpdatePatchPanel();
  const deletePanelMut = useDeletePatchPanel();
  return { createPanel, updatePanelMut, deletePanelMut };
}

// --- Cable overlay manager ---

interface CableOverlayProps {
  editCable: CableRun | null;
  showAdd: boolean;
  panels: PatchPanel[];
  onSave: (data: CableRunInput) => void;
  onDelete: () => void;
  onClose: () => void;
}

function CableOverlay({ editCable, showAdd, panels, onSave, onDelete, onClose }: CableOverlayProps) {
  if (!editCable && !showAdd) return null;
  return (
    <CableEditPanel
      cable={editCable}
      panels={panels}
      onSave={onSave}
      onDelete={editCable ? onDelete : undefined}
      onClose={onClose}
      title={editCable ? "Edit Cable" : "Add Cable"}
    />
  );
}

// --- Panel overlay manager ---

interface PanelOverlayProps {
  editPanel: PatchPanel | null;
  showAdd: boolean;
  onSave: (data: PatchPanelInput) => void;
  onDelete: () => void;
  onClose: () => void;
}

function PanelOverlay({ editPanel, showAdd, onSave, onDelete, onClose }: PanelOverlayProps) {
  if (!editPanel && !showAdd) return null;
  return (
    <PanelEditPanel
      panel={editPanel}
      onSave={onSave}
      onDelete={editPanel ? onDelete : undefined}
      onClose={onClose}
      title={editPanel ? "Edit Panel" : "New Panel"}
    />
  );
}

// --- Main Module ---

type SubView = "cables" | "panels";

export default function CablingModule() {
  const [state, dispatch] = useReducer(
    (s: { subView: SubView; editCable: CableRun | null; showAddCable: boolean; editPanel: PatchPanel | null; showAddPanel: boolean },
     u: Partial<{ subView: SubView; editCable: CableRun | null; showAddCable: boolean; editPanel: PatchPanel | null; showAddPanel: boolean }>) => ({ ...s, ...u }),
    { subView: "cables" as SubView, editCable: null as CableRun | null, showAddCable: false, editPanel: null as PatchPanel | null, showAddPanel: false },
  );
  const { subView, editCable, showAddCable, editPanel, showAddPanel } = state;
  const setSubView = (v: SubView) => dispatch({ subView: v });
  const setEditCable = (v: CableRun | null) => dispatch({ editCable: v });
  const setShowAddCable = (v: boolean) => dispatch({ showAddCable: v });
  const setEditPanel = (v: PatchPanel | null) => dispatch({ editPanel: v });
  const setShowAddPanel = (v: boolean) => dispatch({ showAddPanel: v });

  const cablesQuery = useCables();
  const panelsQuery = usePatchPanels();
  const { createCable, updateCableMut, deleteCableMut, syncCables } = useCableMutations();
  const { createPanel, updatePanelMut, deletePanelMut } = usePanelMutations();

  const cables = cablesQuery.data ?? [];
  const panels = panelsQuery.data ?? [];

  const handleSaveCable = useCallback((data: CableRunInput) => {
    if (editCable) {
      updateCableMut.mutate({ id: editCable.id, data }, { onSuccess: () => setEditCable(null) });
    } else {
      createCable.mutate(data, { onSuccess: () => setShowAddCable(false) });
    }
  }, [editCable, updateCableMut, createCable]);

  const handleDeleteCable = useCallback(() => {
    if (!editCable) return;
    deleteCableMut.mutate(editCable.id, { onSuccess: () => setEditCable(null) });
  }, [editCable, deleteCableMut]);

  const handleSavePanel = useCallback((data: PatchPanelInput) => {
    if (editPanel) {
      updatePanelMut.mutate({ id: editPanel.id, data }, { onSuccess: () => setEditPanel(null) });
    } else {
      createPanel.mutate(data, { onSuccess: () => setShowAddPanel(false) });
    }
  }, [editPanel, updatePanelMut, createPanel]);

  const handleDeletePanel = useCallback(() => {
    if (!editPanel) return;
    deletePanelMut.mutate(editPanel.id, { onSuccess: () => setEditPanel(null) });
  }, [editPanel, deletePanelMut]);

  const handleSync = useCallback(() => syncCables.mutate(), [syncCables]);
  const closeCablePanel = useCallback(() => { setEditCable(null); setShowAddCable(false); }, []);
  const closePanelPanel = useCallback(() => { setEditPanel(null); setShowAddPanel(false); }, []);

  const isLoading = cablesQuery.isLoading || panelsQuery.isLoading;
  const error = cablesQuery.error ?? panelsQuery.error;

  if (isLoading && cables.length === 0 && panels.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <div className="h-6 w-6 rounded-full border-2 border-ui-border dark:border-noc-border border-t-ub-blue animate-spin" />
        <p className="text-sm text-ui-text-secondary dark:text-noc-text-secondary">Loading cabling data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-sm text-status-danger">
          {error instanceof Error ? error.message : "Failed to load cabling data"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-3 lg:px-4 py-2.5 border-b border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-surface shrink-0">
        <div className="flex rounded-lg border border-ui-border dark:border-noc-border overflow-hidden">
          <button onClick={() => setSubView("cables")} className={segmentClass(subView === "cables", true)} data-testid="tab-cables">Cables</button>
          <button onClick={() => setSubView("panels")} className={segmentClass(subView === "panels", false)} data-testid="tab-panels">Patch Panels</button>
        </div>
      </div>

      {subView === "cables" ? (
        <CableTable cables={cables} panels={panels} onEditCable={setEditCable} onAddCable={() => setShowAddCable(true)} onSync={handleSync} isSyncing={syncCables.isPending} />
      ) : (
        <PatchPanelsView panels={panels} cables={cables} onAddPanel={() => setShowAddPanel(true)} onEditPanel={setEditPanel} />
      )}

      <CableOverlay editCable={editCable} showAdd={showAddCable} panels={panels} onSave={handleSaveCable} onDelete={handleDeleteCable} onClose={closeCablePanel} />
      <PanelOverlay editPanel={editPanel} showAdd={showAddPanel} onSave={handleSavePanel} onDelete={handleDeletePanel} onClose={closePanelPanel} />
    </div>
  );
}
