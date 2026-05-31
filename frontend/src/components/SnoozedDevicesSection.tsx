import { useState } from "react";
import type { SnoozedDevice } from "../api/types";

interface SnoozedDevicesSectionProps {
  devices: SnoozedDevice[];
  onUnsnooze: (mac: string) => void;
  defaultOpen?: boolean;
}

export default function SnoozedDevicesSection({ devices, onUnsnooze, defaultOpen = false }: SnoozedDevicesSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (devices.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 rounded-lg border border-ui-border dark:border-noc-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-ui-text-secondary dark:text-noc-text-secondary hover:bg-ui-raised dark:hover:bg-noc-raised transition-colors"
      >
        <span>Snoozed devices ({devices.length})</span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <ul className="divide-y divide-ui-border dark:divide-noc-border">
          {devices.map((device) => (
            <li key={device.mac} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-ui-text dark:text-noc-text">{device.name || device.mac}</p>
                <p className="truncate text-xs text-ui-text-dim dark:text-noc-text-dim">{device.model || device.mac}</p>
              </div>
              <button
                type="button"
                onClick={() => onUnsnooze(device.mac)}
                aria-label={`Unsnooze ${device.name || device.mac}`}
                className="shrink-0 rounded-md border border-ui-border dark:border-noc-border px-3 py-1 text-xs text-ub-blue hover:bg-ub-blue-dim transition-colors"
              >
                Unsnooze
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
