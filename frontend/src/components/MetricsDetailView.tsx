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
        : "bg-ui-text-dim dark:bg-noc-text-dim";
  return <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${color}`} />;
}

function formatAxisValue(value: number, unit: string): string {
  if (unit === "bytes") return formatBytes(value);
  if (unit === "C") return `${Math.round(value)}C`;
  return `${Math.round(value)}${unit}`;
}

function formatTimeLabel(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

function ChartSection({
  label,
  value,
  data,
  timestamps,
  color,
  unit,
}: {
  label: string;
  value: string;
  data: number[];
  timestamps: string[];
  color: string;
  unit: string;
}) {
  const min = data.length > 0 ? Math.min(...data) : 0;
  const max = data.length > 0 ? Math.max(...data) : 0;
  const minLabel = formatAxisValue(min, unit);
  const maxLabel = formatAxisValue(max, unit);

  const firstTime = timestamps.length > 0 ? formatTimeLabel(timestamps[0]) : "";
  const lastTime = timestamps.length > 1 ? formatTimeLabel(timestamps[timestamps.length - 1]) : "";

  return (
    <div className="rounded-lg border border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-raised p-4">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-medium text-ui-text-secondary dark:text-noc-text-secondary">{label}</span>
        <span className="text-sm font-mono text-ui-text dark:text-noc-text">{value}</span>
      </div>
      <div className="flex gap-1">
        <div className="flex flex-col justify-between text-[10px] font-mono text-ui-text-dim dark:text-noc-text-dim w-10 text-right shrink-0 py-0.5">
          <span>{maxLabel}</span>
          <span>{minLabel}</span>
        </div>
        <div className="flex-1 flex flex-col">
          <Sparkline data={data} width={400} height={60} color={color} className="w-full" />
          <div className="flex justify-between text-[10px] font-mono text-ui-text-dim dark:text-noc-text-dim mt-0.5">
            <span>{firstTime}</span>
            <span>{lastTime}</span>
          </div>
        </div>
      </div>
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
  const tempTimestamps = history.filter((h) => h.temperature !== null).map((h) => h.timestamp);
  const trafficData = history.map((h) => h.tx_bytes + h.rx_bytes);
  const timestamps = history.map((h) => h.timestamp);
  const hasTemperature = device.temperature !== null;

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-6">
      <button
        onClick={onBack}
        className="rounded-lg bg-ui-surface dark:bg-noc-surface border border-ui-border dark:border-noc-border px-3 py-1.5 min-h-[44px] text-sm text-ui-text-secondary dark:text-noc-text-secondary hover:bg-ui-raised dark:hover:bg-noc-raised hover:dark:text-noc-text shadow-sm cursor-pointer transition-all mb-4"
      >
        Back to overview
      </button>

      <div className="mb-4 lg:mb-6">
        <h2 className="text-lg font-sans font-semibold text-ui-text dark:text-noc-text">
          {device.name}
        </h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-ui-text-dim dark:text-noc-text-dim">
          <span>{device.model}</span>
          <span className="font-mono">{device.mac}</span>
          <span>v{device.version}</span>
          <span>Up {formatUptime(device.uptime)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 mb-4 lg:mb-6">
        <ChartSection label="CPU" value={`${Math.round(device.cpu)}%`} data={cpuData} timestamps={timestamps} color="#006fff" unit="%" />
        <ChartSection label="Memory" value={`${Math.round(device.mem)}%`} data={memData} timestamps={timestamps} color="#8b5cf6" unit="%" />
        {hasTemperature && (
          <ChartSection
            label="Temperature"
            value={`${Math.round(device.temperature!)}C`}
            data={tempData}
            timestamps={tempTimestamps}
            color="#ffaa2c"
            unit="C"
          />
        )}
        <ChartSection
          label="Traffic (TX + RX)"
          value={formatBytes(device.tx_bytes + device.rx_bytes)}
          data={trafficData}
          timestamps={timestamps}
          color="#00d68f"
          unit="bytes"
        />
      </div>

      {notifications.length > 0 && (
        <div>
          <h3 className="text-sm font-sans font-semibold text-ui-text dark:text-noc-text mb-3">
            Active Notifications
          </h3>
          <div className="flex flex-col gap-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="rounded-lg border border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-raised p-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <SeverityDot severity={n.severity} />
                  <span className="text-sm font-medium text-ui-text dark:text-noc-text">
                    {n.title}
                  </span>
                </div>
                <p className="text-xs text-ui-text-dim dark:text-noc-text-dim">{n.message}</p>
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
