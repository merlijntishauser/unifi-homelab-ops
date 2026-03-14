import type { ThemePreference } from "../hooks/useAppContext";

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
}

function StatusBadge({ active, label, tooltip }: { active: boolean; label: string; tooltip: string }) {
  return (
    <div className="relative group">
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium select-none ${
        active
          ? "bg-emerald-50 dark:bg-status-success-dim text-emerald-700 dark:text-status-success"
          : "bg-gray-100 dark:bg-noc-raised text-gray-500 dark:text-noc-text-dim"
      }`}>
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${
          active ? "bg-emerald-500 dark:bg-status-success" : "bg-gray-400 dark:bg-noc-text-dim"
        }`} />
        {label}
      </div>
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2.5 py-1.5 rounded-lg bg-gray-900 dark:bg-noc-raised text-[11px] text-white dark:text-noc-text whitespace-pre opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 border border-transparent dark:border-noc-border shadow-lg">
        {tooltip}
      </div>
    </div>
  );
}

const THEME_CYCLE: Record<ThemePreference, ThemePreference> = {
  light: "dark",
  dark: "system",
  system: "light",
};

const THEME_LABELS: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.061l1.061-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.061l1.061-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.061 1.06l1.06 1.061zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.061 1.06l1.06 1.061z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M2 4.25A2.25 2.25 0 014.25 2h11.5A2.25 2.25 0 0118 4.25v8.5A2.25 2.25 0 0115.75 15h-3.105a3.501 3.501 0 001.1 1.677A.75.75 0 0113.26 18H6.74a.75.75 0 01-.485-1.323A3.501 3.501 0 007.355 15H4.25A2.25 2.25 0 012 12.75v-8.5zm1.5 0a.75.75 0 01.75-.75h11.5a.75.75 0 01.75.75v7.5a.75.75 0 01-.75.75H4.25a.75.75 0 01-.75-.75v-7.5z" clipRule="evenodd" />
    </svg>
  );
}

const THEME_ICONS: Record<ThemePreference, () => React.JSX.Element> = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
};

export default function Toolbar({
  themePreference,
  onThemePreferenceChange,
  connectionInfo,
  aiInfo,
}: ToolbarProps) {
  const connectionTooltip = connectionInfo
    ? `Connected to: ${connectionInfo.url}\nAs: ${connectionInfo.username}\nConfig from: ${connectionInfo.source}`
    : "Not connected";

  const aiTooltip = aiInfo.configured
    ? `AI LLM: ${aiInfo.provider}\nModel: ${aiInfo.model}`
    : "Not configured";

  const ThemeIcon = THEME_ICONS[themePreference];
  const ariaLabel = `Theme: ${THEME_LABELS[themePreference]}`;

  return (
    <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-200 dark:border-noc-border bg-white dark:bg-noc-surface">
      <h1 className="text-base font-display font-semibold text-gray-900 dark:text-noc-text tracking-tight">
        UniFi Homelab Ops
      </h1>

      <StatusBadge active={connectionInfo !== null} label="Controller" tooltip={connectionTooltip} />
      <StatusBadge active={aiInfo.configured} label="AI" tooltip={aiTooltip} />

      <div className="mr-auto" />

      <div className="relative group">
        <button
          onClick={() => onThemePreferenceChange(THEME_CYCLE[themePreference])}
          className="rounded-lg border border-gray-300 dark:border-noc-border p-2 text-gray-600 dark:text-noc-text-secondary hover:bg-gray-100 dark:hover:bg-noc-raised hover:text-gray-900 dark:hover:text-noc-text hover:border-gray-400 dark:hover:border-noc-border-hover cursor-pointer transition-all"
          aria-label={ariaLabel}
        >
          <ThemeIcon />
        </button>
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2.5 py-1.5 rounded-lg bg-gray-900 dark:bg-noc-raised text-[11px] text-white dark:text-noc-text whitespace-pre opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 border border-transparent dark:border-noc-border shadow-lg">
          {`Theme: ${THEME_LABELS[themePreference]}`}
        </div>
      </div>
    </div>
  );
}
