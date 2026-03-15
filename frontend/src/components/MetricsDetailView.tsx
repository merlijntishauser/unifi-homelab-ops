import type { MetricsSnapshot, MetricsHistoryPoint, AppNotification } from "../api/types";
import Sparkline from "./Sparkline";

interface MetricsDetailViewProps {
  device: MetricsSnapshot;
  history: MetricsHistoryPoint[];
  notifications: AppNotification[];
  onBack: () => void;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

function SeverityDot({ severity }: { severity: string }) {
  const color =
    severity === "critical" || severity === "high"
      ? "bg-status-danger"
      : severity === "warning" || severity === "medium"
        ? "bg-status-warning"
        : "bg-gray-400 dark:bg-noc-text-dim";
  return <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${color}`} />;
}

function ChartSection({
  label,
  value,
  data,
  color,
}: {
  label: string;
  value: string;
  data: number[];
  color: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-noc-border bg-white dark:bg-noc-raised p-4">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-noc-text-secondary">{label}</span>
        <span className="text-sm font-mono text-gray-900 dark:text-noc-text">{value}</span>
      </div>
      <Sparkline data={data} width={400} height={60} color={color} className="w-full" />
    </div>
  );
}

export default function MetricsDetailView({
  device,
  history,
  notifications,
  onBack,
}: MetricsDetailViewProps) {
  const cpuData = history.map((h) => h.cpu);
  const memData = history.map((h) => h.mem);
  const tempData = history.filter((h) => h.temperature !== null).map((h) => h.temperature!);
  const trafficData = history.map((h) => h.tx_bytes + h.rx_bytes);
  const hasTemperature = device.temperature !== null;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <button
        onClick={onBack}
        className="rounded-lg bg-white dark:bg-noc-surface border border-gray-300 dark:border-noc-border px-3 py-1.5 text-sm text-gray-700 dark:text-noc-text-secondary hover:bg-gray-100 dark:hover:bg-noc-raised hover:dark:text-noc-text shadow-sm dark:shadow-lg cursor-pointer transition-all mb-4"
      >
        Back to overview
      </button>

      <div className="mb-6">
        <h2 className="text-lg font-display font-semibold text-gray-900 dark:text-noc-text">
          {device.name}
        </h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-500 dark:text-noc-text-dim">
          <span>{device.model}</span>
          <span className="font-mono">{device.mac}</span>
          <span>v{device.version}</span>
          <span>Up {formatUptime(device.uptime)}</span>
        </div>
      </div>

      <div className="grid gap-4 mb-6">
        <ChartSection label="CPU" value={`${Math.round(device.cpu)}%`} data={cpuData} color="#006fff" />
        <ChartSection label="Memory" value={`${Math.round(device.mem)}%`} data={memData} color="#8b5cf6" />
        {hasTemperature && (
          <ChartSection
            label="Temperature"
            value={`${Math.round(device.temperature!)}C`}
            data={tempData}
            color="#ffaa2c"
          />
        )}
        <ChartSection
          label="Traffic (TX + RX)"
          value={formatBytes(device.tx_bytes + device.rx_bytes)}
          data={trafficData}
          color="#00d68f"
        />
      </div>

      {notifications.length > 0 && (
        <div>
          <h3 className="text-sm font-display font-semibold text-gray-900 dark:text-noc-text mb-3">
            Active Notifications
          </h3>
          <div className="flex flex-col gap-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="rounded-lg border border-gray-200 dark:border-noc-border bg-white dark:bg-noc-raised p-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <SeverityDot severity={n.severity} />
                  <span className="text-sm font-medium text-gray-900 dark:text-noc-text">
                    {n.title}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-noc-text-dim">{n.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
