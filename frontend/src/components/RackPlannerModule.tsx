import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import type { BomResponse, Rack, RackItem, RackItemInput, RackSummary } from "../api/types";
import { api } from "../api/client";
import rackSpecs from "../data/rack-specs.json";
import {
  useRacks,
  useRack,
  useCreateRack,
  useDeleteRack,
  useAddRackItem,
  useDeleteRackItem,
  useMoveRackItem,
} from "../hooks/queries";

// --- Device type metadata ---

interface DeviceTypeMeta {
  label: string;
  faceVar: string;
  accent: string;
}

const DEVICE_TYPE_META: Record<string, DeviceTypeMeta> = {
  gateway: { label: "Gateway", faceVar: "gateway", accent: "#006fff" },
  switch: { label: "Switch", faceVar: "switch", accent: "#14b8a6" },
  "patch-panel": { label: "Patch Panel", faceVar: "patch", accent: "#6b7280" },
  ups: { label: "UPS", faceVar: "ups", accent: "#f59e0b" },
  ap: { label: "Access Point", faceVar: "ap", accent: "#8b5cf6" },
  shelf: { label: "Shelf", faceVar: "other", accent: "#4b5563" },
  other: { label: "Other", faceVar: "other", accent: "#4b5563" },
};

function getDeviceTypeMeta(type: string): DeviceTypeMeta {
  return DEVICE_TYPE_META[type] ?? DEVICE_TYPE_META.other;
}

const DEVICE_TYPE_OPTIONS = [
  "gateway",
  "switch",
  "ap",
  "patch-panel",
  "shelf",
  "ups",
  "other",
];

// --- Shared button style ---

const btnClass =
  "rounded-lg border border-ui-border dark:border-noc-border px-3 py-1.5 text-sm text-ui-text-secondary dark:text-noc-text-secondary hover:bg-ui-raised dark:hover:bg-noc-raised hover:text-ui-text dark:hover:text-noc-text hover:border-ui-border-hover dark:hover:border-noc-border-hover cursor-pointer transition-all";

const btnPrimaryClass =
  "rounded-lg border border-ub-blue bg-ub-blue px-3 py-1.5 text-sm text-white hover:bg-ub-blue-light cursor-pointer transition-all";

// --- RackCard ---

interface RackCardProps {
  rack: RackSummary;
  onClick: () => void;
}

function RackCard({ rack, onClick }: RackCardProps) {
  const fillPercent = rack.height_u > 0 ? Math.round((rack.used_u / rack.height_u) * 100) : 0;

  return (
    <div
      className="rounded-lg border border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-raised p-4 cursor-pointer hover:border-ui-border-hover dark:hover:border-noc-border-hover hover:shadow-md transition-all"
      role="button"
      tabIndex={0}
      data-testid={`rack-card-${rack.id}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-sans font-semibold text-sm text-ui-text dark:text-noc-text truncate flex-1">
          {rack.name}
        </span>
      </div>

      <p className="text-xs text-ui-text-dim dark:text-noc-text-dim mb-3">
        {rack.size} / {rack.height_u}U
        {rack.location && <span> / {rack.location}</span>}
      </p>

      <div className="mb-2">
        <div className="flex items-center justify-between text-xs text-ui-text-dim dark:text-noc-text-dim mb-1">
          <span>Fill</span>
          <span className="font-mono">{rack.used_u}/{rack.height_u}U ({fillPercent}%)</span>
        </div>
        <div className="h-1.5 rounded-full bg-ui-raised dark:bg-noc-input overflow-hidden">
          <div
            className="h-full rounded-full bg-ub-blue"
            style={{ width: `${Math.min(fillPercent, 100)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div>
          <span className="text-ui-text-dim dark:text-noc-text-dim">Power</span>
          <p className="font-mono mt-0.5 text-ui-text dark:text-noc-text-secondary">
            {rack.total_power.toFixed(1)}W
          </p>
        </div>
        <div>
          <span className="text-ui-text-dim dark:text-noc-text-dim">Devices</span>
          <p className="font-mono mt-0.5 text-ui-text dark:text-noc-text-secondary">
            {rack.item_count}
          </p>
        </div>
      </div>
    </div>
  );
}

// --- NewRackForm ---

interface NewRackFormProps {
  onSubmit: (name: string, size: string, heightU: number, location: string) => void;
  onCancel: () => void;
}

function NewRackForm({ onSubmit, onCancel }: NewRackFormProps) {
  const [name, setName] = useState("");
  const [size, setSize] = useState("19-inch");
  const [heightU, setHeightU] = useState(12);
  const [location, setLocation] = useState("");

  return (
    <div className="rounded-lg border border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-raised p-4" data-testid="new-rack-form">
      <h3 className="text-sm font-semibold text-ui-text dark:text-noc-text mb-3">New Rack</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label htmlFor="new-rack-name" className="block text-xs text-ui-text-dim dark:text-noc-text-dim mb-1">Name</label>
          <input
            id="new-rack-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Main Rack"
            className="w-full rounded border border-ui-border dark:border-noc-border bg-ui-input dark:bg-noc-input px-2 py-1.5 text-sm text-ui-text dark:text-noc-text"
          />
        </div>
        <div>
          <label htmlFor="new-rack-size" className="block text-xs text-ui-text-dim dark:text-noc-text-dim mb-1">Size</label>
          <select
            id="new-rack-size"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="w-full rounded border border-ui-border dark:border-noc-border bg-ui-input dark:bg-noc-input px-2 py-1.5 text-sm text-ui-text dark:text-noc-text"
          >
            <option value="10-inch">10-inch</option>
            <option value="19-inch">19-inch</option>
          </select>
        </div>
        <div>
          <label htmlFor="new-rack-height" className="block text-xs text-ui-text-dim dark:text-noc-text-dim mb-1">Height (U)</label>
          <input
            id="new-rack-height"
            type="number"
            value={heightU}
            onChange={(e) => setHeightU(parseInt(e.target.value) || 6)}
            min={6}
            max={48}
            className="w-full rounded border border-ui-border dark:border-noc-border bg-ui-input dark:bg-noc-input px-2 py-1.5 text-sm text-ui-text dark:text-noc-text"
          />
        </div>
        <div className="col-span-2">
          <label htmlFor="new-rack-location" className="block text-xs text-ui-text-dim dark:text-noc-text-dim mb-1">Location (optional)</label>
          <input
            id="new-rack-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Office closet"
            className="w-full rounded border border-ui-border dark:border-noc-border bg-ui-input dark:bg-noc-input px-2 py-1.5 text-sm text-ui-text dark:text-noc-text"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={() => {
            if (name.trim()) onSubmit(name.trim(), size, heightU, location.trim());
          }}
          disabled={!name.trim()}
          className={`${btnPrimaryClass} disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          Create
        </button>
        <button onClick={onCancel} className={btnClass}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// --- RackOverview ---

interface RackOverviewProps {
  onSelectRack: (id: number) => void;
}

function RackOverview({ onSelectRack }: RackOverviewProps) {
  const racksQuery = useRacks();
  const createRack = useCreateRack();
  const [showNewForm, setShowNewForm] = useState(false);

  const racks = racksQuery.data ?? [];

  const handleCreate = (name: string, size: string, heightU: number, location: string) => {
    createRack.mutate(
      { name, size, height_u: heightU, location },
      { onSuccess: () => setShowNewForm(false) },
    );
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-3 lg:px-4 py-2 border-b border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-surface shrink-0">
        <span className="text-sm text-ui-text-dim dark:text-noc-text-dim">Rack Planner</span>
        <div className="ml-auto" />
        <button
          onClick={() => setShowNewForm((v) => !v)}
          className={btnClass}
          data-testid="new-rack-button"
        >
          New Rack
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {showNewForm && (
          <div className="mb-4 max-w-md">
            <NewRackForm onSubmit={handleCreate} onCancel={() => setShowNewForm(false)} />
          </div>
        )}
        {racksQuery.isLoading && racks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="h-6 w-6 rounded-full border-2 border-ui-border dark:border-noc-border border-t-ub-blue animate-spin" />
            <p className="text-sm text-ui-text-secondary dark:text-noc-text-secondary">Loading racks...</p>
          </div>
        ) : racksQuery.error ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-sm text-status-danger">
              {racksQuery.error instanceof Error ? racksQuery.error.message : "Failed to load racks"}
            </p>
          </div>
        ) : racks.length === 0 && !showNewForm ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16 text-ui-text-dim dark:text-noc-text-dim">
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
              <circle cx="8" cy="4.5" r="0.5" fill="currentColor" />
              <circle cx="8" cy="9.5" r="0.5" fill="currentColor" />
              <circle cx="8" cy="14.5" r="0.5" fill="currentColor" />
              <circle cx="8" cy="19.5" r="0.5" fill="currentColor" />
            </svg>
            <div className="text-center">
              <p className="text-base font-semibold text-ui-text dark:text-noc-text">No racks yet</p>
              <p className="text-sm text-ui-text-secondary dark:text-noc-text-secondary mt-1">Design your homelab rack layout with drag-and-drop device placement.</p>
            </div>
            <button
              onClick={() => setShowNewForm(true)}
              className="rounded-lg bg-ub-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-ub-blue-light cursor-pointer transition-colors"
            >
              Create Your First Rack
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {racks.map((rack) => (
              <RackCard key={rack.id} rack={rack} onClick={() => onSelectRack(rack.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- AddItemForm ---

interface AddItemFormProps {
  onSubmit: (data: RackItemInput) => void;
  onCancel: () => void;
  maxPositionU: number;
}

interface AddItemState {
  label: string;
  deviceType: string;
  heightU: number;
  positionU: number;
  powerWatts: number;
  notes: string;
  widthFraction: number;
  positionX: number;
}

const initialAddItemState: AddItemState = {
  label: "",
  deviceType: "other",
  heightU: 1,
  positionU: 1,
  powerWatts: 0,
  notes: "",
  widthFraction: 1.0,
  positionX: 0.0,
};

const WIDTH_OPTIONS: { label: string; value: number }[] = [
  { label: "Full (1U)", value: 1.0 },
  { label: "Half (1/2)", value: 0.5 },
  { label: "Quarter (1/4)", value: 0.25 },
];

function getValidPositionXOptions(widthFraction: number): { label: string; value: number }[] {
  const all = [
    { label: "Left", value: 0.0 },
    { label: "Center-Left", value: 0.25 },
    { label: "Center-Right", value: 0.5 },
    { label: "Right", value: 0.75 },
  ];
  return all.filter((opt) => opt.value + widthFraction <= 1.0);
}

function addItemReducer(state: AddItemState, update: Partial<AddItemState>): AddItemState {
  return { ...state, ...update };
}

function AddItemForm({ onSubmit, onCancel, maxPositionU }: AddItemFormProps) {
  const [form, dispatch] = useReducer(addItemReducer, initialAddItemState);
  const { label, deviceType, heightU, positionU, powerWatts, notes, widthFraction, positionX } = form;
  const [tab, setTab] = useState<"unifi" | "custom">("unifi");
  const [searchQuery, setSearchQuery] = useState("");

  const validPositionXOptions = useMemo(() => getValidPositionXOptions(widthFraction), [widthFraction]);

  const filteredDevices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return rackSpecs.devices;
    return rackSpecs.devices.filter((d) => d.name.toLowerCase().includes(q) || d.model.toLowerCase().includes(q) || d.type.toLowerCase().includes(q));
  }, [searchQuery]);

  const handleSelectDevice = (device: typeof rackSpecs.devices[0]) => {
    dispatch({
      label: device.name,
      deviceType: device.type,
      heightU: device.height_u,
      widthFraction: device.width_fraction,
      positionX: 0,
    });
    setTab("custom");
  };

  return (
    <div className="rounded-lg border border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-raised p-4" data-testid="add-item-form">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-ui-text dark:text-noc-text">Add Item</h3>
        <div className="ml-auto flex rounded-lg border border-ui-border dark:border-noc-border overflow-hidden">
          <button
            onClick={() => setTab("unifi")}
            className={`px-3 py-1 text-xs font-medium transition-colors ${tab === "unifi" ? "bg-ub-blue text-white" : "text-ui-text-secondary dark:text-noc-text-secondary hover:bg-ui-raised dark:hover:bg-noc-input"}`}
          >
            UniFi Device
          </button>
          <button
            onClick={() => setTab("custom")}
            className={`px-3 py-1 text-xs font-medium transition-colors border-l border-ui-border dark:border-noc-border ${tab === "custom" ? "bg-ub-blue text-white" : "text-ui-text-secondary dark:text-noc-text-secondary hover:bg-ui-raised dark:hover:bg-noc-input"}`}
          >
            Custom
          </button>
        </div>
      </div>

      {tab === "unifi" && (
        <div className="mb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search devices..."
            className="w-full rounded border border-ui-border dark:border-noc-border bg-ui-input dark:bg-noc-input px-2 py-1.5 text-sm text-ui-text dark:text-noc-text mb-2"
          />
          <div className="max-h-48 overflow-y-auto divide-y divide-ui-border/50 dark:divide-noc-border/50 border border-ui-border dark:border-noc-border rounded">
            {filteredDevices.map((device) => (
              <button
                key={device.model}
                onClick={() => handleSelectDevice(device)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-ui-raised dark:hover:bg-noc-input transition-colors cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ui-text dark:text-noc-text truncate">{device.name}</div>
                  <div className="text-[10px] text-ui-text-dim dark:text-noc-text-dim">
                    {device.form_factor} -- {device.height_u}U -- {device.type}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-mono text-ui-text-dim dark:text-noc-text-dim">{device.model}</span>
              </button>
            ))}
            {filteredDevices.length === 0 && (
              <p className="text-xs text-ui-text-dim dark:text-noc-text-dim p-3 text-center">No matching devices</p>
            )}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label htmlFor="add-item-label" className="block text-xs text-ui-text-dim dark:text-noc-text-dim mb-1">Label</label>
          <input
            id="add-item-label"
            type="text"
            value={label}
            onChange={(e) => dispatch({ label: e.target.value })}
            placeholder="e.g. USW-24-PoE"
            className="w-full rounded border border-ui-border dark:border-noc-border bg-ui-input dark:bg-noc-input px-2 py-1.5 text-sm text-ui-text dark:text-noc-text"
          />
        </div>
        <div>
          <label htmlFor="add-item-type" className="block text-xs text-ui-text-dim dark:text-noc-text-dim mb-1">Type</label>
          <select
            id="add-item-type"
            value={deviceType}
            onChange={(e) => dispatch({ deviceType: e.target.value })}
            className="w-full rounded border border-ui-border dark:border-noc-border bg-ui-input dark:bg-noc-input px-2 py-1.5 text-sm text-ui-text dark:text-noc-text"
          >
            {DEVICE_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{getDeviceTypeMeta(t).label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="add-item-height" className="block text-xs text-ui-text-dim dark:text-noc-text-dim mb-1">Height (U)</label>
          <input
            id="add-item-height"
            type="number"
            value={heightU}
            onChange={(e) => { const v = parseFloat(e.target.value); dispatch({ heightU: isNaN(v) ? 0 : v }); }}
            min={0}
            max={5}
            step={0.5}
            className="w-full rounded border border-ui-border dark:border-noc-border bg-ui-input dark:bg-noc-input px-2 py-1.5 text-sm text-ui-text dark:text-noc-text"
          />
          {heightU === 0 && (
            <p className="text-[10px] text-ui-text-dim dark:text-noc-text-dim mt-0.5">0U items mount on side rails</p>
          )}
        </div>
        <div>
          <label htmlFor="add-item-width" className="block text-xs text-ui-text-dim dark:text-noc-text-dim mb-1">Width</label>
          <select
            id="add-item-width"
            value={widthFraction}
            onChange={(e) => {
              const newWidth = parseFloat(e.target.value);
              const newValidOptions = getValidPositionXOptions(newWidth);
              const currentXStillValid = newValidOptions.some((opt) => opt.value === positionX);
              dispatch({ widthFraction: newWidth, positionX: currentXStillValid ? positionX : 0.0 });
            }}
            className="w-full rounded border border-ui-border dark:border-noc-border bg-ui-input dark:bg-noc-input px-2 py-1.5 text-sm text-ui-text dark:text-noc-text"
            data-testid="add-item-width"
          >
            {WIDTH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        {widthFraction < 1.0 && (
          <div>
            <label htmlFor="add-item-position-x" className="block text-xs text-ui-text-dim dark:text-noc-text-dim mb-1">Position X</label>
            <select
              id="add-item-position-x"
              value={positionX}
              onChange={(e) => dispatch({ positionX: parseFloat(e.target.value) })}
              className="w-full rounded border border-ui-border dark:border-noc-border bg-ui-input dark:bg-noc-input px-2 py-1.5 text-sm text-ui-text dark:text-noc-text"
              data-testid="add-item-position-x"
            >
              {validPositionXOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="add-item-position" className="block text-xs text-ui-text-dim dark:text-noc-text-dim mb-1">Position (U)</label>
          <input
            id="add-item-position"
            type="number"
            value={positionU}
            onChange={(e) => dispatch({ positionU: parseFloat(e.target.value) || 1 })}
            min={1}
            max={maxPositionU}
            step={0.5}
            className="w-full rounded border border-ui-border dark:border-noc-border bg-ui-input dark:bg-noc-input px-2 py-1.5 text-sm text-ui-text dark:text-noc-text"
          />
        </div>
        <div>
          <label htmlFor="add-item-power" className="block text-xs text-ui-text-dim dark:text-noc-text-dim mb-1">Power (W)</label>
          <input
            id="add-item-power"
            type="number"
            value={powerWatts}
            onChange={(e) => dispatch({ powerWatts: parseFloat(e.target.value) || 0 })}
            min={0}
            step={0.1}
            className="w-full rounded border border-ui-border dark:border-noc-border bg-ui-input dark:bg-noc-input px-2 py-1.5 text-sm text-ui-text dark:text-noc-text"
          />
        </div>
        <div className="col-span-2">
          <label htmlFor="add-item-notes" className="block text-xs text-ui-text-dim dark:text-noc-text-dim mb-1">Notes (optional)</label>
          <input
            id="add-item-notes"
            type="text"
            value={notes}
            onChange={(e) => dispatch({ notes: e.target.value })}
            className="w-full rounded border border-ui-border dark:border-noc-border bg-ui-input dark:bg-noc-input px-2 py-1.5 text-sm text-ui-text dark:text-noc-text"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={() => {
            if (label.trim()) {
              onSubmit({
                label: label.trim(),
                device_type: deviceType,
                height_u: heightU,
                position_u: positionU,
                power_watts: powerWatts,
                notes: notes.trim(),
                width_fraction: widthFraction,
                position_x: positionX,
              });
            }
          }}
          disabled={!label.trim()}
          className={`${btnPrimaryClass} disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          Add
        </button>
        <button onClick={onCancel} className={btnClass}>Cancel</button>
      </div>
    </div>
  );
}

// --- BomView ---

interface BomViewProps {
  bom: BomResponse;
  onClose: () => void;
}

function BomView({ bom, onClose }: BomViewProps) {
  return (
    <div className="rounded-lg border border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-raised p-4" data-testid="bom-view">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ui-text dark:text-noc-text">
          Bill of Materials: {bom.rack_name}
        </h3>
        <button onClick={onClose} className={btnClass}>Close</button>
      </div>
      {bom.entries.length === 0 ? (
        <p className="text-sm text-ui-text-dim dark:text-noc-text-dim">No items in rack.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ui-border dark:border-noc-border text-left text-xs text-ui-text-dim dark:text-noc-text-dim">
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4">Label</th>
              <th className="pb-2 pr-4 text-right">Qty</th>
              <th className="pb-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {bom.entries.map((entry) => (
              <tr key={`${entry.item_type}-${entry.label}`} className="border-b border-ui-border/50 dark:border-noc-border/50">
                <td className="py-1.5 pr-4 font-mono text-xs text-ui-text-secondary dark:text-noc-text-secondary">{entry.item_type}</td>
                <td className="py-1.5 pr-4 text-ui-text dark:text-noc-text">{entry.label}</td>
                <td className="py-1.5 pr-4 text-right font-mono text-ui-text dark:text-noc-text">{entry.quantity}</td>
                <td className="py-1.5 text-ui-text-dim dark:text-noc-text-dim">{entry.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// --- RackSlotItem ---

interface RackSlotItemProps {
  item: RackItem;
  onDragStart: (e: React.DragEvent, item: RackItem) => void;
  onDelete: (itemId: number) => void;
}

const PORT_COUNTS: Record<string, number> = { switch: 6, gateway: 3, "patch-panel": 8 };

function DevicePortIndicators({ type }: { type: string }) {
  const count = PORT_COUNTS[type] ?? 0;
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      {Array.from({ length: count }, (_, n) => (
        <div key={`p${n}`} className="w-1.5 h-2 rounded-[1px] bg-noc-text-dim/30 dark:bg-noc-text-dim/40" />
      ))}
    </div>
  );
}

function RackSlotItem({ item, onDragStart, onDelete }: RackSlotItemProps) {
  const meta = getDeviceTypeMeta(item.device_type);
  const isFractional = item.width_fraction < 1.0;
  const v = meta.faceVar;

  return (
    <div
      className={`rack-device flex items-center gap-2 px-3 h-full rounded-sm cursor-grab active:cursor-grabbing select-none ${isFractional ? "absolute" : ""}`}
      style={{
        ...(isFractional ? { width: `${item.width_fraction * 100}%`, left: `${item.position_x * 100}%` } : undefined),
        background: `linear-gradient(180deg, var(--rack-face-${v}-top) 0%, var(--rack-face-${v}-bottom) 100%)`,
        borderLeft: `3px solid ${meta.accent}`,
        borderRight: "1px solid var(--rack-device-border-right)",
        borderTop: "1px solid var(--rack-device-border-top)",
        borderBottom: "1px solid var(--rack-device-border-bottom)",
        boxShadow: "var(--rack-device-shadow)",
        color: "var(--rack-device-text)",
      }}
      draggable
      onDragStart={(e) => onDragStart(e, item)}
      data-testid={`rack-item-${item.id}`}
    >
      {/* Status LED */}
      <div className="w-1.5 h-1.5 rounded-full bg-status-success shrink-0 shadow-[0_0_4px_rgba(0,214,143,0.5)]" />
      {/* Drag handle */}
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 shrink-0 opacity-30" style={{ color: "var(--rack-device-text-dim)" }}>
        <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
        <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
      </svg>
      <span className="text-[11px] font-semibold truncate flex-1" style={{ color: "var(--rack-device-text)" }}>
        {item.label}
      </span>
      <DevicePortIndicators type={item.device_type} />
      {item.power_watts > 0 && (
        <span className="font-mono text-[9px] shrink-0" style={{ color: "var(--rack-device-text-dim)" }}>
          {item.power_watts.toFixed(1)}W
        </span>
      )}
      <button
        draggable={false}
        onMouseDown={(e) => { e.stopPropagation(); e.stopImmediatePropagation(); }}
        onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(item.id);
        }}
        className="shrink-0 p-1 hover:text-status-danger transition-colors z-10"
        style={{ color: "var(--rack-device-text-dim)" }}
        aria-label={`Delete ${item.label}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

// --- DevicePicker ---

interface DevicePickerProps {
  rackId: number;
  onAdd: (device: { mac: string; name: string; model: string; type: string }) => void;
}

function DevicePicker({ rackId, onAdd }: DevicePickerProps) {
  const [devices, setDevices] = useState<{ mac: string; name: string; model: string; type: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAvailableDevices(rackId).then(setDevices).catch(() => setDevices([])).finally(() => setLoading(false));
  }, [rackId]);

  if (loading) {
    return <p className="text-xs text-ui-text-dim dark:text-noc-text-dim p-3">Loading devices...</p>;
  }

  if (devices.length === 0) {
    return <p className="text-xs text-ui-text-dim dark:text-noc-text-dim p-3">All devices already placed in this rack.</p>;
  }

  return (
    <div className="max-w-md mb-4">
      <div className="rounded-lg border border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-raised overflow-hidden">
        <div className="px-3 py-2 bg-ui-raised dark:bg-noc-input text-xs font-semibold text-ui-text-secondary dark:text-noc-text-secondary uppercase tracking-wide">
          Available Devices
        </div>
        <div className="divide-y divide-ui-border/50 dark:divide-noc-border/50 max-h-64 overflow-y-auto">
          {devices.map((device) => {
            const meta = getDeviceTypeMeta(device.type);
            return (
              <div key={device.mac} className="flex items-center gap-3 px-3 py-2 hover:bg-ui-raised dark:hover:bg-noc-input transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ui-text dark:text-noc-text truncate">{device.name}</div>
                  <div className="text-xs text-ui-text-dim dark:text-noc-text-dim truncate">{meta.label} -- {device.model}</div>
                </div>
                <button
                  onClick={() => onAdd(device)}
                  className="shrink-0 rounded border border-ub-blue/20 px-2 py-1 text-xs text-ub-blue hover:bg-ub-blue/10 cursor-pointer transition-colors"
                >
                  Add to Rack
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- Rack slot builder (extracted to reduce RackEditor complexity) ---

interface BuildRackSlotsArgs {
  rack: Rack;
  occupiedSlots: Map<number, RackItem[]>;
  handleDrop: (e: React.DragEvent, targetU: number) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragStart: (e: React.DragEvent, item: RackItem) => void;
  handleDeleteItem: (itemId: number) => void;
}

function buildRackSlots({ rack, occupiedSlots, handleDrop, handleDragOver, handleDragStart, handleDeleteItem }: BuildRackSlotsArgs): React.ReactNode[] {
  const slots: React.ReactNode[] = [];
  const renderedItemIds = new Set<number>();
  let skip = 0;
  // Each grid row = 0.5U. Iterate bottom-up (U=1 first) so spans flow naturally upward.
  for (let halfIdx = 0; halfIdx < rack.height_u * 2; halfIdx++) {
    const currentU = 1 + halfIdx * 0.5;
    if (skip > 0) {
      skip--;
      continue;
    }
    const items = occupiedSlots.get(currentU);
    if (items && items.length > 0) {
      const topItems = items.filter((item) => item.position_u === currentU && !renderedItemIds.has(item.id));
      if (topItems.length > 0) {
        const maxHeight = Math.max(...topItems.map((item) => item.height_u));
        const gridSpan = Math.round(maxHeight * 2);
        for (const item of topItems) renderedItemIds.add(item.id);
        const hasFractional = topItems.some((item) => item.width_fraction < 1.0);
        const slotBorder = Number.isInteger(currentU)
          ? { borderBottom: "1px dashed var(--rack-u-border)" }
          : { borderBottom: "1px dotted var(--rack-half-u-border)" };
        slots.unshift(
          <div key={`slot-${currentU}`} className={hasFractional ? "relative" : ""} style={{ gridRow: `span ${gridSpan}`, ...slotBorder }} onDrop={(e) => handleDrop(e, currentU)} onDragOver={handleDragOver}>
            {topItems.length === 1 && !hasFractional ? (
              <RackSlotItem item={topItems[0]} onDragStart={handleDragStart} onDelete={handleDeleteItem} />
            ) : (
              topItems.map((item) => (
                <RackSlotItem key={item.id} item={item} onDragStart={handleDragStart} onDelete={handleDeleteItem} />
              ))
            )}
          </div>,
        );
        skip = gridSpan - 1;
        continue;
      }
      // Occupied but not a bottom-slot (mid/top of item) -- covered by item's span
      continue;
    }
    // Unoccupied half-slot -- each is its own drop target for 0.5U precision
    const isWholeU = Number.isInteger(currentU);
    slots.unshift(
      <div
        key={`empty-${currentU}`}
        className="rack-slot"
        style={isWholeU
          ? { borderBottom: "1px dashed var(--rack-u-border)" }
          : { borderBottom: "1px dotted var(--rack-half-u-border)" }
        }
        onDrop={(e) => handleDrop(e, currentU)}
        onDragOver={handleDragOver}
        data-testid={`empty-slot-${currentU}`}
      />,
    );
    // Non-integer unoccupied half-slot (e.g., 1.5 when there's a 0.5U at 1.0): no grid element needed
    // because the grid doesn't need a filler -- this will be naturally handled by adjacent spans
  }
  return slots;
}

// --- RackEditor ---

interface RackEditorProps {
  rackId: number;
  onBack: () => void;
}

function RackEditor({ rackId, onBack }: RackEditorProps) {
  const rackQuery = useRack(rackId);
  const addItem = useAddRackItem();
  const deleteItem = useDeleteRackItem();
  const moveItem = useMoveRackItem();
  const deleteRack = useDeleteRack();
  const [editorState, setEditorState] = useReducer(
    (s: { showAddForm: boolean; showDevicePicker: boolean; bom: BomResponse | null; dragItemId: number | null; addError: string | null },
     u: Partial<{ showAddForm: boolean; showDevicePicker: boolean; bom: BomResponse | null; dragItemId: number | null; addError: string | null }>) => ({ ...s, ...u }),
    { showAddForm: false, showDevicePicker: false, bom: null, dragItemId: null, addError: null },
  );
  const { showAddForm, showDevicePicker, bom, dragItemId, addError } = editorState;

  const rack: Rack | undefined = rackQuery.data;

  // Separate 0U items from standard items
  const zeroUItems = useMemo(() => {
    if (!rack) return [];
    return rack.items.filter((item) => item.height_u === 0);
  }, [rack]);

  // Build a map of occupied half-U positions (multiple items per slot for fractional widths)
  const occupiedSlots = useMemo(() => {
    if (!rack) return new Map<number, RackItem[]>();
    const map = new Map<number, RackItem[]>();
    for (const item of rack.items) {
      if (item.height_u === 0) continue;
      for (let s = item.position_u; s < item.position_u + item.height_u; s += 0.5) {
        const existing = map.get(s) ?? [];
        existing.push(item);
        map.set(s, existing);
      }
    }
    return map;
  }, [rack]);

  const handleDragStart = useCallback((e: React.DragEvent, item: RackItem) => {
    setEditorState({ dragItemId: item.id });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(item.id));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetU: number) => {
      e.preventDefault();
      if (dragItemId === null || !rack) return;
      const item = rack.items.find((i) => i.id === dragItemId);
      if (!item) {
        setEditorState({ dragItemId: null });
        return;
      }
      if (item.position_u === targetU) {
        setEditorState({ dragItemId: null });
        return;
      }
      // Preserve horizontal position when dragging vertically
      moveItem.mutate({ rackId: rack.id, itemId: dragItemId, positionU: targetU, positionX: item.position_x });
      setEditorState({ dragItemId: null });
    },
    [dragItemId, rack, moveItem],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleAddItem = useCallback(
    (data: RackItemInput) => {
      if (!rack) return;
      setEditorState({ addError: null });
      addItem.mutate(
        { rackId: rack.id, data },
        {
          onSuccess: () => setEditorState({ showAddForm: false }),
          onError: (err) => setEditorState({ addError: err instanceof Error ? err.message : "Failed to add item" }),
        },
      );
    },
    [rack, addItem],
  );

  const handleDeleteItem = useCallback(
    (itemId: number) => {
      if (!rack) return;
      deleteItem.mutate({ rackId: rack.id, itemId });
    },
    [rack, deleteItem],
  );

  const handleDeleteRack = useCallback(() => {
    deleteRack.mutate(rackId, { onSuccess: onBack });
  }, [rackId, deleteRack, onBack]);

  const handleAddFromTopology = useCallback((device: { mac: string; name: string; model: string; type: string }) => {
    const freeSlots: number[] = [];
    if (rack) {
      for (let s = 1; s <= rack.height_u; s++) {
        // A 1U item needs both half-slots free (s and s+0.5)
        if (!occupiedSlots.has(s) && !occupiedSlots.has(s + 0.5)) freeSlots.push(s);
      }
    }
    const positionU = freeSlots.length > 0 ? freeSlots[0] : 1;
    setEditorState({ addError: null });
    addItem.mutate(
      { rackId, data: { position_u: positionU, label: device.name, device_type: device.type, device_mac: device.mac, height_u: 1, width_fraction: 1.0, position_x: 0.0 } },
      { onError: (err) => setEditorState({ addError: err instanceof Error ? err.message : "Rack is full" }) },
    );
  }, [rackId, addItem, rack, occupiedSlots]);

  const handleShowBom = useCallback(async () => {
    const data = await api.getRackBom(rackId);
    setEditorState({ bom: data });
  }, [rackId]);

  if (rackQuery.isLoading || !rack) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <div className="h-6 w-6 rounded-full border-2 border-ui-border dark:border-noc-border border-t-ub-blue animate-spin" />
        <p className="text-sm text-ui-text-secondary dark:text-noc-text-secondary">Loading rack...</p>
      </div>
    );
  }

  const slots = buildRackSlots({
    rack, occupiedSlots, handleDrop, handleDragOver, handleDragStart, handleDeleteItem,
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-3 lg:px-4 py-2 border-b border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-surface shrink-0">
        <button onClick={onBack} className={btnClass} data-testid="back-button">
          Back
        </button>
        <span className="text-sm font-semibold text-ui-text dark:text-noc-text truncate">
          {rack.name}
        </span>
        <span className="text-xs text-ui-text-dim dark:text-noc-text-dim">
          {rack.size} / {rack.height_u}U / {rack.total_power.toFixed(1)}W
        </span>
        <div className="ml-auto" />
        <button onClick={() => setEditorState({ showAddForm: !showAddForm })} className={btnClass} data-testid="add-item-button">
          Add Item
        </button>
        <button onClick={() => setEditorState({ showDevicePicker: !showDevicePicker })} className={btnClass} data-testid="import-button">
          {showDevicePicker ? "Hide Devices" : "Add from Topology"}
        </button>
        <button onClick={handleShowBom} className={btnClass} data-testid="bom-button">
          Bill of Materials
        </button>
        <button onClick={handleDeleteRack} className={`${btnClass} hover:!text-status-danger hover:!border-status-danger`} data-testid="delete-rack-button">
          Delete Rack
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Rack grid (fixed width, represents physical rack) */}
          <div className="shrink-0" style={{ width: rack.size === "10-inch" ? "20rem" : "36rem" }} data-testid="rack-grid">
          <div className="flex">
            {/* U labels */}
            <div className="shrink-0 w-7 grid" style={{ gridTemplateRows: `repeat(${rack.height_u * 2}, 1rem)` }}>
              {Array.from({ length: rack.height_u }, (_, i) => {
                const u = rack.height_u - i;
                return (
                  <div key={u} className="font-mono text-[10px] text-ui-text-dim dark:text-noc-text-dim text-right pr-1.5 select-none flex items-center justify-end" style={{ gridRow: "span 2" }}>
                    {u}
                  </div>
                );
              })}
            </div>
            {/* Left rack rail */}
            <div className="shrink-0 w-3 rounded-l grid" style={{ background: "var(--rack-rail)", borderTop: "2px solid var(--rack-border)", borderBottom: "2px solid var(--rack-border)", gridTemplateRows: `repeat(${rack.height_u * 2}, 1rem)` }}>
              {Array.from({ length: rack.height_u }, (_, uIdx) => (
                <div key={`rail-${uIdx}`} className="flex items-center justify-center" style={{ gridRow: "span 2" }}>
                  <div className="w-1 h-1 rounded-full" style={{ background: "var(--rack-rail-screw)" }} />
                </div>
              ))}
            </div>
            {/* Device area */}
            <div className="flex-1 min-w-0 grid auto-rows-[1rem]" style={{ background: "var(--rack-bg)", borderTop: "2px solid var(--rack-border)", borderBottom: "2px solid var(--rack-border)" }}>
              {slots}
            </div>
            {/* Right rack rail */}
            <div className="shrink-0 w-3 rounded-r grid" style={{ background: "var(--rack-rail)", borderTop: "2px solid var(--rack-border)", borderBottom: "2px solid var(--rack-border)", gridTemplateRows: `repeat(${rack.height_u * 2}, 1rem)` }}>
              {Array.from({ length: rack.height_u }, (_, uIdx) => (
                <div key={`rail-${uIdx}`} className="flex items-center justify-center" style={{ gridRow: "span 2" }}>
                  <div className="w-1 h-1 rounded-full" style={{ background: "var(--rack-rail-screw)" }} />
                </div>
              ))}
            </div>
          </div>
          {/* Width indicator */}
          <div className="flex items-center mt-2 ml-8">
            <svg viewBox="0 0 8 8" className="w-2 h-2 shrink-0 text-ui-text-dim/40 dark:text-noc-text-dim/40" fill="currentColor"><polygon points="0,4 8,0 8,8" /></svg>
            <div className="flex-1 h-px bg-ui-text-dim/40 dark:bg-noc-text-dim/40" />
            <span className="px-2 text-[10px] font-mono text-ui-text-dim dark:text-noc-text-dim select-none whitespace-nowrap">
              {rack.size === "10-inch" ? "10\"" : "19\""}
            </span>
            <div className="flex-1 h-px bg-ui-text-dim/40 dark:bg-noc-text-dim/40" />
            <svg viewBox="0 0 8 8" className="w-2 h-2 shrink-0 text-ui-text-dim/40 dark:text-noc-text-dim/40" fill="currentColor"><polygon points="8,4 0,0 0,8" /></svg>
          </div>
          {zeroUItems.length > 0 && (
            <div className="mt-4" data-testid="zero-u-section">
              <h4 className="text-xs font-semibold text-ui-text-secondary dark:text-noc-text-secondary uppercase tracking-wide mb-2">
                Side-mounted (0U)
              </h4>
              <div className="grid auto-rows-[2rem] gap-px">
                {zeroUItems.map((item) => (
                  <div key={`zero-u-${item.id}`} className="flex">
                    <span className="font-mono text-[10px] text-ui-text-dim dark:text-noc-text-dim w-8 text-right pr-2 pt-1 shrink-0 select-none">
                      0U
                    </span>
                    <div className="flex-1 min-w-0">
                      <RackSlotItem item={item} onDragStart={handleDragStart} onDelete={handleDeleteItem} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

          {/* Side panel (right side on desktop, below on mobile) */}
          {(showAddForm || showDevicePicker || bom) && (
            <div className="flex-1 min-w-0 lg:max-w-md">
              {addError && (
                <div className="mb-3 rounded-lg bg-status-danger-dim border border-status-danger/20 p-3 text-sm text-status-danger">
                  {addError}
                </div>
              )}
              {showAddForm && (
                <AddItemForm
                    onSubmit={handleAddItem}
                    onCancel={() => { setEditorState({ showAddForm: false }); setEditorState({ addError: null }); }}
                    maxPositionU={rack.height_u}
                  />
              )}
              {showDevicePicker && (
                <DevicePicker rackId={rackId} onAdd={handleAddFromTopology} />
              )}
              {bom && (
                <BomView bom={bom} onClose={() => setEditorState({ bom: null })} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- RackPlannerModule ---

export default function RackPlannerModule() {
  const [selectedRackId, setSelectedRackId] = useState<number | null>(null);

  useEffect(() => {
    const onPopState = () => setSelectedRackId(null);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleSelectRack = useCallback((id: number) => {
    setSelectedRackId(id);
    window.history.pushState({ view: "editor" }, "");
  }, []);

  const handleBack = useCallback(() => {
    setSelectedRackId(null);
  }, []);

  return selectedRackId !== null ? (
    <RackEditor rackId={selectedRackId} onBack={handleBack} />
  ) : (
    <RackOverview onSelectRack={handleSelectRack} />
  );
}
