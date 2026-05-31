import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "../hooks/useAppContext";
import { useMetricsDevices, useMetricsHistory, useNotifications, useSnoozedDevices, useSnoozeDevices, useUnsnoozeDevice } from "../hooks/queries";
import type { AppNotification, MetricsHistoryPoint, MetricsSnapshot, SnoozedDevice } from "../api/types";
import DeviceMetricCard from "./DeviceMetricCard";
import SnoozedDevicesSection from "./SnoozedDevicesSection";

const MetricsDetailView = lazy(() => import("./MetricsDetailView"));

interface DeviceCardWithSnoozeProps {
  device: MetricsSnapshot;
  onSelect: () => void;
  onSnooze: () => void;
}

function DeviceCardWithSnooze({ device, onSelect, onSnooze }: DeviceCardWithSnoozeProps) {
  return (
    <div className="relative">
      <DeviceMetricCard device={device} onClick={onSelect} />
      {device.status !== "online" && (
        <button
          type="button"
          aria-label={`Snooze ${device.name || device.mac}`}
          onClick={onSnooze}
          className="absolute top-2 right-2 rounded-md border border-ui-border dark:border-noc-border px-2 py-0.5 text-xs text-ui-text-secondary dark:text-noc-text-secondary bg-ui-surface/90 dark:bg-noc-surface/90 hover:bg-ui-raised dark:hover:bg-noc-raised transition-colors"
        >
          Snooze
        </button>
      )}
    </div>
  );
}

interface DeviceGridProps {
  devices: MetricsSnapshot[];
  snoozed: SnoozedDevice[];
  onSelect: (mac: string) => void;
  onSnoozeDevice: (device: MetricsSnapshot) => void;
  onUnsnooze: (mac: string) => void;
}

function DeviceGrid({ devices, snoozed, onSelect, onSnoozeDevice, onUnsnooze }: DeviceGridProps) {
  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-ui-text-dim dark:text-noc-text-dim">
        <p className="text-sm">No devices found</p>
      </div>
    );
  }
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {devices.map((device) => (
          <DeviceCardWithSnooze
            key={device.mac}
            device={device}
            onSelect={() => onSelect(device.mac)}
            onSnooze={() => onSnoozeDevice(device)}
          />
        ))}
      </div>
      <SnoozedDevicesSection devices={snoozed} onUnsnooze={onUnsnooze} />
    </>
  );
}

interface MetricsBodyProps {
  isLoading: boolean;
  error: Error | null;
  devices: MetricsSnapshot[];
  snoozed: SnoozedDevice[];
  selectedDevice: MetricsSnapshot | null;
  history: MetricsHistoryPoint[];
  notifications: AppNotification[];
  onSelect: (mac: string) => void;
  onBack: () => void;
  onSnoozeDevice: (device: MetricsSnapshot) => void;
  onUnsnooze: (mac: string) => void;
}

function MetricsBody({ isLoading, error, devices, snoozed, selectedDevice, history, notifications, onSelect, onBack, onSnoozeDevice, onUnsnooze }: MetricsBodyProps) {
  if (isLoading && devices.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <div className="size-6 rounded-full border-2 border-ui-border dark:border-noc-border border-t-ub-blue animate-spin" />
        <p className="text-sm text-ui-text-secondary dark:text-noc-text-secondary">
          Loading devices…
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-status-danger">
          {error instanceof Error ? error.message : "Failed to load devices"}
        </p>
      </div>
    );
  }
  if (selectedDevice) {
    return (
      <Suspense fallback={
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="size-6 rounded-full border-2 border-ui-border dark:border-noc-border border-t-ub-blue animate-spin" />
        </div>
      }>
        <MetricsDetailView
          device={selectedDevice}
          history={history}
          notifications={notifications.filter((n) => n.device_mac === selectedDevice.mac)}
          onBack={onBack}
        />
      </Suspense>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-6">
      <DeviceGrid
        devices={devices}
        snoozed={snoozed}
        onSelect={onSelect}
        onSnoozeDevice={onSnoozeDevice}
        onUnsnooze={onUnsnooze}
      />
    </div>
  );
}

export default function MetricsModule() {
  const { connectionInfo } = useAppContext();
  const authed = connectionInfo !== null;
  const deepLinkDevice = useMemo(() => new URLSearchParams(window.location.search).get("device"), []);
  const [selectedMac, setSelectedMac] = useState<string | null>(deepLinkDevice);
  const deepLinked = useRef(!!deepLinkDevice);

  useEffect(() => {
    if (deepLinked.current) {
      deepLinked.current = false;
      window.history.replaceState({}, "", window.location.pathname);
      window.history.pushState({ view: "detail" }, "");
    }
  }, []);

  useEffect(() => {
    const onPopState = () => setSelectedMac(null);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const devicesQuery = useMetricsDevices(authed);
  const historyQuery = useMetricsHistory(selectedMac, !!selectedMac && authed);
  const notificationsQuery = useNotifications(authed);
  const snoozedQuery = useSnoozedDevices(authed);
  const snoozeMutation = useSnoozeDevices();
  const unsnoozeMutation = useUnsnoozeDevice();

  const devices = devicesQuery.data?.devices ?? [];
  const history = historyQuery.data?.history ?? [];
  const notifications = notificationsQuery.data ?? [];
  const selectedDevice = selectedMac ? devices.find((d) => d.mac === selectedMac) ?? null : null;
  const snoozed = snoozedQuery.data?.devices ?? [];
  const offlineDevices = devices.filter((d) => d.status !== "online");

  const handleSelectDevice = (mac: string) => {
    setSelectedMac(mac);
    window.history.pushState({ view: "detail" }, "");
  };

  const handleSnoozeDevice = (device: MetricsSnapshot) => {
    snoozeMutation.mutate([{ mac: device.mac, name: device.name, model: device.model }]);
  };

  const handleSnoozeOffline = () => {
    snoozeMutation.mutate(offlineDevices.map((d) => ({ mac: d.mac, name: d.name, model: d.model })));
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-3 lg:px-4 py-2.5 border-b border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-surface shrink-0">
        <span className="text-sm text-ui-text-dim dark:text-noc-text-dim">Auto-refreshes every 30s</span>
        {offlineDevices.length > 0 && (
          <button
            type="button"
            onClick={handleSnoozeOffline}
            className="ml-auto rounded-md border border-ui-border dark:border-noc-border px-3 py-1 text-xs text-ui-text-secondary dark:text-noc-text-secondary bg-ui-surface/90 dark:bg-noc-surface/90 hover:bg-ui-raised dark:hover:bg-noc-raised transition-colors"
          >
            Snooze offline ({offlineDevices.length})
          </button>
        )}
      </div>
      <div className="flex-1 flex overflow-hidden relative">
        <MetricsBody
          isLoading={devicesQuery.isLoading}
          error={devicesQuery.error}
          devices={devices}
          snoozed={snoozed}
          selectedDevice={selectedDevice}
          history={history}
          notifications={notifications}
          onSelect={handleSelectDevice}
          onBack={() => setSelectedMac(null)}
          onSnoozeDevice={handleSnoozeDevice}
          onUnsnooze={(mac) => unsnoozeMutation.mutate(mac)}
        />
      </div>
    </div>
  );
}
