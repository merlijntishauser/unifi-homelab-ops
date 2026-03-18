import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import type { BomResponse, Rack, RackItem, RackItemInput, RackSummary } from "../api/types";
import { api } from "../api/client";
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
  bgClass: string;
  borderClass: string;
}

const DEVICE_TYPE_META: Record<string, DeviceTypeMeta> = {
  gateway: {
    label: "Gateway",
    bgClass: "bg-ub-blue/10",
    borderClass: "border-ub-blue/30",
  },
  switch: {
    label: "Switch",
    bgClass: "bg-teal-500/10 dark:bg-teal-400/10",
    borderClass: "border-teal-500/30 dark:border-teal-400/30",
  },
  "patch-panel": {
    label: "Patch Panel",
    bgClass: "bg-ui-raised dark:bg-noc-raised",
    borderClass: "border-ui-border dark:border-noc-border",
  },
  ups: {
    label: "UPS",
    bgClass: "bg-status-warning/10",
    borderClass: "border-status-warning/30",
  },
  ap: {
    label: "Access Point",
    bgClass: "bg-ui-raised dark:bg-noc-raised",
    borderClass: "border-ui-border dark:border-noc-border",
  },
  shelf: {
    label: "Shelf",
    bgClass: "bg-ui-raised dark:bg-noc-raised",
    borderClass: "border-ui-border dark:border-noc-border",
  },
  other: {
    label: "Other",
    bgClass: "bg-ui-raised dark:bg-noc-raised",
    borderClass: "border-ui-border dark:border-noc-border",
  },
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
}

const initialAddItemState: AddItemState = {
  label: "",
  deviceType: "other",
  heightU: 1,
  positionU: 1,
  powerWatts: 0,
  notes: "",
};

function addItemReducer(state: AddItemState, update: Partial<AddItemState>): AddItemState {
  return { ...state, ...update };
}

function AddItemForm({ onSubmit, onCancel, maxPositionU }: AddItemFormProps) {
  const [form, dispatch] = useReducer(addItemReducer, initialAddItemState);
  const { label, deviceType, heightU, positionU, powerWatts, notes } = form;

  return (
    <div className="rounded-lg border border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-raised p-4" data-testid="add-item-form">
      <h3 className="text-sm font-semibold text-ui-text dark:text-noc-text mb-3">Add Item</h3>
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
            onChange={(e) => dispatch({ heightU: parseInt(e.target.value) || 1 })}
            min={1}
            max={4}
            className="w-full rounded border border-ui-border dark:border-noc-border bg-ui-input dark:bg-noc-input px-2 py-1.5 text-sm text-ui-text dark:text-noc-text"
          />
        </div>
        <div>
          <label htmlFor="add-item-position" className="block text-xs text-ui-text-dim dark:text-noc-text-dim mb-1">Position (U)</label>
          <input
            id="add-item-position"
            type="number"
            value={positionU}
            onChange={(e) => dispatch({ positionU: parseInt(e.target.value) || 1 })}
            min={1}
            max={maxPositionU}
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

function RackSlotItem({ item, onDragStart, onDelete }: RackSlotItemProps) {
  const meta = getDeviceTypeMeta(item.device_type);

  return (
    <div
      className={`flex items-center gap-2 px-3 h-full rounded border ${meta.bgClass} ${meta.borderClass} cursor-grab active:cursor-grabbing select-none`}
      draggable
      onDragStart={(e) => onDragStart(e, item)}
      data-testid={`rack-item-${item.id}`}
    >
      <span className="font-mono text-[10px] text-ui-text-dim dark:text-noc-text-dim shrink-0 w-14 truncate">
        {item.device_type}
      </span>
      <span className="text-sm font-sans text-ui-text dark:text-noc-text truncate flex-1">
        {item.label}
      </span>
      {item.power_watts > 0 && (
        <span className="font-mono text-xs text-ui-text-dim dark:text-noc-text-dim shrink-0">
          {item.power_watts.toFixed(1)}W
        </span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(item.id);
        }}
        className="shrink-0 text-ui-text-dim dark:text-noc-text-dim hover:text-status-danger transition-colors"
        aria-label={`Delete ${item.label}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [bom, setBom] = useState<BomResponse | null>(null);
  const [dragItemId, setDragItemId] = useState<number | null>(null);

  const rack: Rack | undefined = rackQuery.data;

  // Build a map of occupied U positions
  const occupiedSlots = useMemo(() => {
    if (!rack) return new Map<number, RackItem>();
    const map = new Map<number, RackItem>();
    for (const item of rack.items) {
      for (let u = item.position_u; u < item.position_u + item.height_u; u++) {
        map.set(u, item);
      }
    }
    return map;
  }, [rack]);

  const handleDragStart = useCallback((e: React.DragEvent, item: RackItem) => {
    setDragItemId(item.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(item.id));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetU: number) => {
      e.preventDefault();
      if (dragItemId === null || !rack) return;
      const item = rack.items.find((i) => i.id === dragItemId);
      if (!item || item.position_u === targetU) {
        setDragItemId(null);
        return;
      }
      moveItem.mutate({ rackId: rack.id, itemId: dragItemId, positionU: targetU });
      setDragItemId(null);
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
      addItem.mutate({ rackId: rack.id, data }, { onSuccess: () => setShowAddForm(false) });
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
        if (!occupiedSlots.has(s)) freeSlots.push(s);
      }
    }
    const positionU = freeSlots.length > 0 ? freeSlots[0] : 1;
    addItem.mutate({ rackId, data: { position_u: positionU, label: device.name, device_type: device.type, device_mac: device.mac, height_u: 1 } });
  }, [rackId, addItem, rack, occupiedSlots]);

  const handleShowBom = useCallback(async () => {
    const data = await api.getRackBom(rackId);
    setBom(data);
  }, [rackId]);

  if (rackQuery.isLoading || !rack) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <div className="h-6 w-6 rounded-full border-2 border-ui-border dark:border-noc-border border-t-ub-blue animate-spin" />
        <p className="text-sm text-ui-text-secondary dark:text-noc-text-secondary">Loading rack...</p>
      </div>
    );
  }

  // Build slot rows from top to bottom (highest U first)
  const slots: React.ReactNode[] = [];
  let u = rack.height_u;
  while (u >= 1) {
    const currentU = u;
    const item = occupiedSlots.get(currentU);
    if (item && item.position_u + item.height_u - 1 === currentU) {
      // This is the top U of an item -- render the item spanning its height
      slots.push(
        <div
          key={`item-${item.id}`}
          className="flex"
          style={{ gridRow: `span ${item.height_u}` }}
        >
          <span className="font-mono text-[10px] text-ui-text-dim dark:text-noc-text-dim w-8 text-right pr-2 pt-1 shrink-0 select-none">
            {currentU}
          </span>
          <div className="flex-1 min-w-0">
            <RackSlotItem item={item} onDragStart={handleDragStart} onDelete={handleDeleteItem} />
          </div>
        </div>,
      );
      u -= item.height_u;
    } else if (item) {
      // Middle/bottom part of a multi-U item -- skip
      u--;
    } else {
      // Empty slot
      slots.push(
        <div
          key={`empty-${currentU}`}
          className="flex"
          onDrop={(e) => handleDrop(e, currentU)}
          onDragOver={handleDragOver}
          data-testid={`empty-slot-${currentU}`}
        >
          <span className="font-mono text-[10px] text-ui-text-dim dark:text-noc-text-dim w-8 text-right pr-2 pt-1 shrink-0 select-none">
            {currentU}
          </span>
          <div className="flex-1 border border-dashed border-ui-border/50 dark:border-noc-border/50 rounded h-full" />
        </div>,
      );
      u--;
    }
  }

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
        <button onClick={() => setShowAddForm((v) => !v)} className={btnClass} data-testid="add-item-button">
          Add Item
        </button>
        <button onClick={() => setShowDevicePicker((v) => !v)} className={btnClass} data-testid="import-button">
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
        {showAddForm && (
          <div className="mb-4 max-w-md">
            <AddItemForm
              onSubmit={handleAddItem}
              onCancel={() => setShowAddForm(false)}
              maxPositionU={rack.height_u}
            />
          </div>
        )}
        {showDevicePicker && (
          <DevicePicker rackId={rackId} onAdd={handleAddFromTopology} />
        )}
        {bom && (
          <div className="mb-4 max-w-2xl">
            <BomView bom={bom} onClose={() => setBom(null)} />
          </div>
        )}
        <div
          className="max-w-2xl grid auto-rows-[2rem] gap-px"
          data-testid="rack-grid"
        >
          {slots}
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
