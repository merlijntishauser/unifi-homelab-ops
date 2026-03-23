import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { MetricsSnapshot, MetricsHistoryPoint, AppNotification } from "../api/types";

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatTimeLabel(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

function formatAxisValue(value: number, unit: string): string {
  if (unit === "bytes") return formatBytes(value);
  if (unit === "C") return `${Math.round(value)}C`;
  return `${Math.round(value)}${unit}`;
}

interface ChartDatum {
  time: string;
  value: number;
}

interface ChartSectionProps {
  label: string;
  value: string;
  data: ChartDatum[];
  color: string;
  unit: string;
}

function ChartSection({ label, value, data, color, unit }: ChartSectionProps) {
  return (
    <div className="rounded-lg border border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-surface p-4">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-medium text-ui-text-secondary dark:text-noc-text-secondary">{label}</span>
        <span className="text-sm font-mono text-ui-text dark:text-noc-text">{value}</span>
      </div>
      <ResponsiveContainer width="100%" height={100}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: "currentColor", opacity: 0.4 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "currentColor", opacity: 0.4 }}
            tickLine={false}
            axisLine={false}
            width={36}
            tickFormatter={(v: number) => formatAxisValue(v, unit)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-noc-surface, #141820)",
              border: "1px solid var(--color-noc-border, rgba(255,255,255,0.08))",
              borderRadius: 8,
              fontSize: 12,
              fontFamily: "var(--font-mono)",
            }}
            labelStyle={{ color: "var(--color-noc-text-secondary, #8b95a5)", fontSize: 11 }}
            itemStyle={{ color: "var(--color-noc-text, #f0f2f5)" }}
            formatter={(v) => [formatAxisValue(Number(v ?? 0), unit), label]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#grad-${label})`}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0, fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function MetricsDetailView({
  device,
  history,
  notifications,
  onBack,
}: MetricsDetailViewProps) {
  const cpuData = useMemo(() => history.map((h) => ({ time: formatTimeLabel(h.timestamp), value: h.cpu })), [history]);
  const memData = useMemo(() => history.map((h) => ({ time: formatTimeLabel(h.timestamp), value: h.mem })), [history]);
  const tempData = useMemo(() =>
    history.filter((h) => h.temperature !== null).map((h) => ({ time: formatTimeLabel(h.timestamp), value: h.temperature! })),
    [history],
  );
  const trafficData = useMemo(() => history.map((h) => ({ time: formatTimeLabel(h.timestamp), value: h.tx_bytes + h.rx_bytes })), [history]);
  const hasTemperature = device.temperature !== null;

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-6">
      <button
        onClick={onBack}
        className="inline-flex items-center rounded-lg bg-ui-surface dark:bg-noc-surface border border-ui-border dark:border-noc-border px-3 py-1.5 min-h-[36px] text-sm text-ui-text-secondary dark:text-noc-text-secondary hover:bg-ui-raised dark:hover:bg-noc-raised hover:dark:text-noc-text shadow-sm cursor-pointer transition-all mb-4"
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
        <ChartSection label="CPU" value={`${Math.round(device.cpu)}%`} data={cpuData} color="#006fff" unit="%" />
        <ChartSection label="Memory" value={`${Math.round(device.mem)}%`} data={memData} color="#8b5cf6" unit="%" />
        {hasTemperature && (
          <ChartSection
            label="Temperature"
            value={`${Math.round(device.temperature!)}C`}
            data={tempData}
            color="#ffaa2c"
            unit="C"
          />
        )}
        <ChartSection
          label="Traffic (TX + RX)"
          value={formatBytes(device.tx_bytes + device.rx_bytes)}
          data={trafficData}
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
