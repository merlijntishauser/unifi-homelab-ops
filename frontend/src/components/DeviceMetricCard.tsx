import type { MetricsSnapshot } from "../api/types";

interface DeviceMetricCardProps {
  device: MetricsSnapshot;
  onClick: () => void;
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "online"
      ? "bg-status-success"
      : status === "offline"
        ? "bg-status-danger"
        : "bg-gray-400 dark:bg-noc-text-dim";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

function tempColor(temp: number): string {
  if (temp >= 80) return "text-status-danger";
  if (temp >= 60) return "text-status-warning";
  return "text-status-success";
}

export default function DeviceMetricCard({ device, onClick }: DeviceMetricCardProps) {
  return (
    <div
      className="rounded-lg border border-gray-200 dark:border-noc-border bg-white dark:bg-noc-raised p-4 cursor-pointer hover:border-gray-400 dark:hover:border-noc-border-hover hover:shadow-md dark:hover:shadow-lg transition-all"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-display font-semibold text-sm text-gray-900 dark:text-noc-text truncate flex-1">
          {device.name}
        </span>
        <StatusDot status={device.status} />
      </div>

      <p className="text-xs text-gray-500 dark:text-noc-text-dim mb-3 truncate">{device.model}</p>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <span className="text-gray-500 dark:text-noc-text-dim">CPU</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-noc-input overflow-hidden">
              <div
                className="h-full rounded-full bg-ub-blue"
                style={{ width: `${Math.min(device.cpu, 100)}%` }}
              />
            </div>
            <span className="font-mono text-gray-700 dark:text-noc-text-secondary w-8 text-right">
              {Math.round(device.cpu)}%
            </span>
          </div>
        </div>

        <div>
          <span className="text-gray-500 dark:text-noc-text-dim">Mem</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-noc-input overflow-hidden">
              <div
                className="h-full rounded-full bg-ub-purple"
                style={{ width: `${Math.min(device.mem, 100)}%` }}
              />
            </div>
            <span className="font-mono text-gray-700 dark:text-noc-text-secondary w-8 text-right">
              {Math.round(device.mem)}%
            </span>
          </div>
        </div>

        {device.temperature !== null && (
          <div>
            <span className="text-gray-500 dark:text-noc-text-dim">Temp</span>
            <p className={`font-mono mt-0.5 ${tempColor(device.temperature)}`}>
              {Math.round(device.temperature)}C
            </p>
          </div>
        )}

        <div>
          <span className="text-gray-500 dark:text-noc-text-dim">Clients</span>
          <p className="font-mono mt-0.5 text-gray-700 dark:text-noc-text-secondary">
            {device.num_sta}
          </p>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-noc-border text-xs text-gray-500 dark:text-noc-text-dim font-mono">
        {formatUptime(device.uptime)}
      </div>
    </div>
  );
}
