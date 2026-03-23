import { useMemo } from "react";
import type { MetricsSnapshot, MetricsHistoryPoint, AppNotification } from "../api/types";
import MetricsChart, { DualMetricsChart } from "./MetricsChart";
import type { ChartDatum, DualChartDatum } from "./MetricsChart";
import { formatRelativeTime } from "../utils/format";

interface MetricsDetailViewProps {
  device: MetricsSnapshot;
  history: MetricsHistoryPoint[];
  notifications: AppNotification[];
  onBack: () => void;
}

// --- Formatters ---

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// --- Stat strip helpers ---

type StatColor = "green" | "yellow" | "red" | "neutral";

function cpuColor(v: number): StatColor {
  if (v >= 90) return "red";
  if (v >= 70) return "yellow";
  return "green";
}

function memColor(v: number): StatColor {
  if (v >= 95) return "red";
  if (v >= 85) return "yellow";
  return "green";
}

function tempColor(v: number): StatColor {
  if (v >= 80) return "red";
  if (v >= 60) return "yellow";
  return "green";
}

function poeColor(consumption: number, budget: number): StatColor {
  const ratio = consumption / budget;
  if (ratio >= 0.9) return "red";
  if (ratio >= 0.7) return "yellow";
  return "green";
}

const dotColors: Record<StatColor, string> = {
  green: "bg-status-success",
  yellow: "bg-status-warning",
  red: "bg-status-danger",
  neutral: "bg-ui-text-dim dark:bg-noc-text-dim",
};

function StatCard({ label, value, color }: { label: string; value: string; color: StatColor }) {
  return (
    <div className="rounded-lg border border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-surface px-3 py-2.5 min-w-[80px]">
      <span className="text-[10px] text-ui-text-dim dark:text-noc-text-dim uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-2 mt-0.5">
        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${dotColors[color]}`} />
        <span className="text-base font-mono font-semibold text-ui-text dark:text-noc-text">{value}</span>
      </div>
    </div>
  );
}

// --- Status dot ---

function StatusDot({ status }: { status: string }) {
  const color = status === "online" ? "bg-status-success" : status === "offline" ? "bg-status-danger" : "bg-ui-text-dim dark:bg-noc-text-dim";
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />;
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

// --- Delta computation for traffic ---

function computeDeltas(history: MetricsHistoryPoint[]): DualChartDatum[] {
  const result: DualChartDatum[] = [];
  for (let i = 1; i < history.length; i++) {
    const txDelta = Math.max(0, history[i].tx_bytes - history[i - 1].tx_bytes);
    const rxDelta = Math.max(0, history[i].rx_bytes - history[i - 1].rx_bytes);
    result.push({
      time: formatTimeLabel(history[i].timestamp),
      primary: txDelta,
      secondary: rxDelta,
    });
  }
  return result;
}

// --- Info grid row ---

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <span className="text-ui-text-dim dark:text-noc-text-dim">{label}</span>
      <span className={`text-ui-text dark:text-noc-text-secondary ${mono ? "font-mono" : ""}`}>{value}</span>
    </>
  );
}

// --- Main component ---

export default function MetricsDetailView({
  device,
  history,
  notifications,
  onBack,
}: MetricsDetailViewProps) {
  const cpuData = useMemo<ChartDatum[]>(() => history.map((h) => ({ time: formatTimeLabel(h.timestamp), value: h.cpu })), [history]);
  const memData = useMemo<ChartDatum[]>(() => history.map((h) => ({ time: formatTimeLabel(h.timestamp), value: h.mem })), [history]);
  const tempData = useMemo<ChartDatum[]>(() =>
    history.filter((h) => h.temperature !== null).map((h) => ({ time: formatTimeLabel(h.timestamp), value: h.temperature! })),
    [history],
  );
  const trafficData = useMemo<DualChartDatum[]>(() => computeDeltas(history), [history]);
  const clientData = useMemo<ChartDatum[]>(() => history.map((h) => ({ time: formatTimeLabel(h.timestamp), value: h.num_sta })), [history]);
  const poeData = useMemo<ChartDatum[]>(() =>
    history.filter((h) => h.poe_consumption !== null).map((h) => ({ time: formatTimeLabel(h.timestamp), value: h.poe_consumption! })),
    [history],
  );

  const hasTemperature = device.temperature !== null;
  const hasClients = device.type === "uap" || device.num_sta > 0;
  const hasPoe = device.poe_budget !== null && device.poe_budget > 0;

  const totalTrafficDelta = trafficData.reduce((sum, d) => sum + d.primary + d.secondary, 0);

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-6" data-testid="detail-view">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-lg bg-ui-surface dark:bg-noc-surface border border-ui-border dark:border-noc-border px-3 py-1.5 min-h-[36px] text-sm text-ui-text-secondary dark:text-noc-text-secondary hover:bg-ui-raised dark:hover:bg-noc-raised shadow-sm cursor-pointer transition-all mb-4"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to overview
      </button>

      {/* Header */}
      <div className="mb-4 lg:mb-6">
        <div className="flex items-center gap-2.5 mb-2">
          <StatusDot status={device.status} />
          <h2 className="text-lg font-sans font-semibold text-ui-text dark:text-noc-text">
            {device.name}
          </h2>
        </div>

        {/* Device info card */}
        <div className="rounded-lg border border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-surface p-3">
          <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-4 gap-y-1.5 text-xs">
            <InfoRow label="Model" value={device.model} />
            {device.ip && <InfoRow label="IP" value={device.ip} mono />}
            <InfoRow label="MAC" value={device.mac} mono />
            <InfoRow label="Firmware" value={`v${device.version}`} mono />
            <InfoRow label="Uptime" value={formatUptime(device.uptime)} />
            {hasClients && <InfoRow label="Clients" value={String(device.num_sta)} />}
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className="flex flex-wrap gap-2 mb-4 lg:mb-6">
        <StatCard label="CPU" value={`${Math.round(device.cpu)}%`} color={cpuColor(device.cpu)} />
        <StatCard label="Memory" value={`${Math.round(device.mem)}%`} color={memColor(device.mem)} />
        {hasTemperature && (
          <StatCard label="Temp" value={`${Math.round(device.temperature!)}C`} color={tempColor(device.temperature!)} />
        )}
        {hasClients && (
          <StatCard label="Clients" value={String(device.num_sta)} color="neutral" />
        )}
        {hasPoe && (
          <StatCard
            label="PoE"
            value={`${(device.poe_consumption ?? 0).toFixed(0)}/${device.poe_budget!.toFixed(0)}W`}
            color={poeColor(device.poe_consumption ?? 0, device.poe_budget!)}
          />
        )}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 mb-4 lg:mb-6">
        <MetricsChart label="CPU" value={`${Math.round(device.cpu)}%`} data={cpuData} color="#006fff" unit="%" />
        <MetricsChart label="Memory" value={`${Math.round(device.mem)}%`} data={memData} color="#8b5cf6" unit="%" />
        {hasTemperature && (
          <MetricsChart label="Temperature" value={`${Math.round(device.temperature!)}C`} data={tempData} color="#ffaa2c" unit="C" />
        )}
        <DualMetricsChart
          label="Traffic"
          value={formatBytes(totalTrafficDelta)}
          data={trafficData}
          primaryColor="#006fff"
          secondaryColor="#00d68f"
          primaryLabel="TX"
          secondaryLabel="RX"
          unit="bytes"
        />
        {hasClients && (
          <MetricsChart label="Connected Clients" value={String(device.num_sta)} data={clientData} color="#06b6d4" unit="" />
        )}
        {hasPoe && (
          <MetricsChart
            label="PoE Consumption"
            value={`${(device.poe_consumption ?? 0).toFixed(1)}W`}
            data={poeData}
            color="#f59e0b"
            unit="W"
            referenceLine={device.poe_budget!}
            referenceLabel={`Budget ${device.poe_budget!.toFixed(0)}W`}
          />
        )}
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div>
          <h3 className="text-sm font-sans font-semibold text-ui-text dark:text-noc-text mb-3">
            Active Notifications
          </h3>
          <div className="flex flex-col gap-2">
            {notifications.map((n) => {
              const sevColor = n.severity === "critical" || n.severity === "high"
                ? "bg-status-danger"
                : n.severity === "warning" || n.severity === "medium"
                  ? "bg-status-warning"
                  : "bg-status-success";
              return (
                <div
                  key={n.id}
                  className="flex overflow-hidden rounded-lg border border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-raised"
                >
                  <div className={`w-1 shrink-0 ${sevColor}`} />
                  <div className="p-3 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <SeverityDot severity={n.severity} />
                      <span className="text-sm font-medium text-ui-text dark:text-noc-text flex-1">
                        {n.title}
                      </span>
                      <span className="text-xs text-ui-text-dim dark:text-noc-text-dim">
                        {formatRelativeTime(n.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-ui-text-dim dark:text-noc-text-dim ml-4">{n.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
