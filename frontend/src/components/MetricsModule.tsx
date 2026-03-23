import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "../hooks/useAppContext";
import { useMetricsDevices, useMetricsHistory, useNotifications } from "../hooks/queries";
import DeviceMetricCard from "./DeviceMetricCard";

const MetricsDetailView = lazy(() => import("./MetricsDetailView"));

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

  const devices = devicesQuery.data?.devices ?? [];
  const history = historyQuery.data?.history ?? [];
  const notifications = notificationsQuery.data ?? [];
  const selectedDevice = selectedMac ? devices.find((d) => d.mac === selectedMac) ?? null : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-3 lg:px-4 py-2.5 border-b border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-surface shrink-0">
        <span className="text-sm text-ui-text-dim dark:text-noc-text-dim">Auto-refreshes every 30s</span>
      </div>
      <div className="flex-1 flex overflow-hidden relative">
        {devicesQuery.isLoading && devices.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="h-6 w-6 rounded-full border-2 border-ui-border dark:border-noc-border border-t-ub-blue animate-spin" />
            <p className="text-sm text-ui-text-secondary dark:text-noc-text-secondary">
              Loading devices...
            </p>
          </div>
        ) : devicesQuery.error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <p className="text-sm text-status-danger">
              {devicesQuery.error instanceof Error
                ? devicesQuery.error.message
                : "Failed to load devices"}
            </p>
          </div>
        ) : selectedDevice ? (
          <Suspense fallback={
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <div className="h-6 w-6 rounded-full border-2 border-ui-border dark:border-noc-border border-t-ub-blue animate-spin" />
            </div>
          }>
            <MetricsDetailView
              device={selectedDevice}
              history={history}
              notifications={notifications.filter((n) => n.device_mac === selectedDevice.mac)}
              onBack={() => setSelectedMac(null)}
            />
          </Suspense>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 lg:p-6">
            {devices.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-ui-text-dim dark:text-noc-text-dim">
                <p className="text-sm">No devices found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {devices.map((device) => (
                  <DeviceMetricCard
                    key={device.mac}
                    device={device}
                    onClick={() => {
                      setSelectedMac(device.mac);
                      window.history.pushState({ view: "detail" }, "");
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
