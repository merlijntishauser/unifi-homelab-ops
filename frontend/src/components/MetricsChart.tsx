/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from "react";

interface ChartDatum {
  time: string;
  value: number;
}

interface MetricsChartProps {
  label: string;
  value: string;
  data: ChartDatum[];
  color: string;
  unit: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatAxisValue(value: number, unit: string): string {
  if (unit === "bytes") return formatBytes(value);
  if (unit === "C") return `${Math.round(value)}C`;
  return `${Math.round(value)}${unit}`;
}

type RechartsModule = typeof import("recharts");

export default function MetricsChart({ label, value, data, color, unit }: MetricsChartProps) {
  const [rc, setRc] = useState<RechartsModule | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("recharts").then((mod) => { if (!cancelled) setRc(mod); });
    return () => { cancelled = true; };
  }, []);

  if (!rc) {
    return (
      <div className="rounded-lg border border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-surface p-4 h-[140px] flex items-center justify-center">
        <div className="h-5 w-5 rounded-full border-2 border-ui-border dark:border-noc-border border-t-ub-blue animate-spin" />
      </div>
    );
  }

  const { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } = rc;

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

export type { ChartDatum };
