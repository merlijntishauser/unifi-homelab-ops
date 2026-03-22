import { useEffect, useRef, useState } from "react";
import type { ThemePreference } from "../hooks/useAppContext";
import Tooltip from "./Tooltip";

interface ConnectionInfo {
  url: string;
  username: string;
  source: "env" | "runtime" | "none";
}

interface AiInfo {
  configured: boolean;
  provider: string;
  model: string;
}

interface ToolbarProps {
  themePreference: ThemePreference;
  onThemePreferenceChange: (pref: ThemePreference) => void;
  connectionInfo: ConnectionInfo | null;
  aiInfo: AiInfo;
  notificationCount?: number;
  onOpenNotifications?: () => void;
  onAppLogout?: () => void;
}

function StatusBadge({ active, label, tooltip, tooltipAlign }: { active: boolean; label: string; tooltip: string; tooltipAlign?: "center" | "left" | "right" }) {
  return (
    <div className="relative group">
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium select-none ${
        active
          ? "bg-emerald-50 dark:bg-status-success-dim text-emerald-700 dark:text-status-success"
          : "bg-ui-raised dark:bg-noc-raised text-ui-text-dim dark:text-noc-text-dim"
      }`}>
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${
          active ? "bg-emerald-500 dark:bg-status-success" : "bg-ui-text-dim dark:bg-noc-text-dim"
        }`} />
        <span>{label}</span>
      </div>
      <Tooltip text={tooltip} align={tooltipAlign} />
    </div>
  );
}

const THEME_OPTIONS: ThemePreference[] = ["light", "dark", "system"];

const THEME_LABELS: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.061l1.061-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.061l1.061-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.061 1.06l1.06 1.061zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.061 1.06l1.06 1.061z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M2 4.25A2.25 2.25 0 014.25 2h11.5A2.25 2.25 0 0118 4.25v8.5A2.25 2.25 0 0115.75 15h-3.105a3.501 3.501 0 001.1 1.677A.75.75 0 0113.26 18H6.74a.75.75 0 01-.485-1.323A3.501 3.501 0 007.355 15H4.25A2.25 2.25 0 012 12.75v-8.5zm1.5 0a.75.75 0 01.75-.75h11.5a.75.75 0 01.75.75v7.5a.75.75 0 01-.75.75H4.25a.75.75 0 01-.75-.75v-7.5z" clipRule="evenodd" />
    </svg>
  );
}

const THEME_ICONS: Record<ThemePreference, () => React.JSX.Element> = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
};

function ThemePicker({ themePreference, onThemePreferenceChange }: { themePreference: ThemePreference; onThemePreferenceChange: (pref: ThemePreference) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const ThemeIcon = THEME_ICONS[themePreference];

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-ui-border dark:border-noc-border p-2 text-ui-text-secondary dark:text-noc-text-secondary hover:bg-ui-raised dark:hover:bg-noc-raised hover:text-ui-text dark:hover:text-noc-text hover:border-ui-border-hover dark:hover:border-noc-border-hover cursor-pointer transition-all"
        aria-label={`Theme: ${THEME_LABELS[themePreference]}`}
        aria-expanded={open}
      >
        <ThemeIcon />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1.5 rounded-xl border border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-surface shadow-xl overflow-hidden animate-fade-in z-50" role="menu">
          {THEME_OPTIONS.map((opt) => {
            const Icon = THEME_ICONS[opt];
            const isActive = themePreference === opt;
            return (
              <button
                key={opt}
                role="menuitem"
                onClick={() => { onThemePreferenceChange(opt); setOpen(false); }}
                className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm cursor-pointer transition-colors ${
                  isActive
                    ? "text-ub-blue bg-blue-50 dark:bg-ub-blue-dim"
                    : "text-ui-text dark:text-noc-text hover:bg-ui-raised dark:hover:bg-noc-raised"
                }`}
              >
                <Icon />
                {THEME_LABELS[opt]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Toolbar({
  themePreference,
  onThemePreferenceChange,
  connectionInfo,
  aiInfo,
  notificationCount = 0,
  onOpenNotifications,
  onAppLogout,
}: ToolbarProps) {
  const connectionTooltip = connectionInfo
    ? `Connected to: ${connectionInfo.url}\nAs: ${connectionInfo.username}\nConfig from: ${connectionInfo.source}`
    : "Not connected";

  const aiTooltip = aiInfo.configured
    ? `AI LLM: ${aiInfo.provider}\nModel: ${aiInfo.model}`
    : "Not configured";

  return (
    <div className="relative z-30 flex items-center gap-2 lg:gap-3 px-4 lg:px-6 py-2.5 lg:py-3 mt-safe border-b border-ui-border dark:border-noc-border bg-ui-surface/80 dark:bg-noc-surface/80 backdrop-blur-md">
      <div className="flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-3 shrink-0">
        <h1 className="text-sm lg:text-base font-sans font-semibold tracking-tight bg-gradient-to-r from-[#3b82f6] to-ub-blue bg-clip-text text-transparent whitespace-nowrap">
          UniFi Homelab Ops
        </h1>
        <div className="flex items-center gap-1.5">
          <StatusBadge active={connectionInfo !== null} label="Controller" tooltip={connectionTooltip} tooltipAlign="left" />
          <StatusBadge active={aiInfo.configured} label="AI" tooltip={aiTooltip} />
        </div>
      </div>

      <div className="mr-auto" />

      {onOpenNotifications && (
        <button
          onClick={onOpenNotifications}
          className="lg:hidden relative rounded-lg border border-ui-border dark:border-noc-border p-2 text-ui-text-secondary dark:text-noc-text-secondary hover:bg-ui-raised dark:hover:bg-noc-raised hover:text-ui-text dark:hover:text-noc-text hover:border-ui-border-hover dark:hover:border-noc-border-hover cursor-pointer transition-all"
          aria-label="Notifications"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-status-danger text-white text-[10px] font-mono leading-none px-1">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </button>
      )}

      <ThemePicker themePreference={themePreference} onThemePreferenceChange={onThemePreferenceChange} />

      {onAppLogout && (
        <div className="relative group">
          <button
            onClick={onAppLogout}
            className="rounded-lg border border-ui-border dark:border-noc-border p-2 text-ui-text-secondary dark:text-noc-text-secondary hover:bg-status-danger-dim hover:text-status-danger hover:border-status-danger/20 cursor-pointer transition-all"
            aria-label="Log out"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
          <Tooltip text="Log out" align="right" />
        </div>
      )}
    </div>
  );
}
