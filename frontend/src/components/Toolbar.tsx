import type { ColorMode } from "@xyflow/react";

interface ToolbarProps {
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
  showDisabled: boolean;
  onShowDisabledChange: (show: boolean) => void;
  onRefresh: () => void;
  loading: boolean;
  onLogout: () => void;
  onOpenSettings: () => void;
}

export default function Toolbar({
  colorMode,
  onColorModeChange,
  showDisabled,
  onShowDisabledChange,
  onRefresh,
  loading,
  onLogout,
  onOpenSettings,
}: ToolbarProps) {
  const btnClass =
    "rounded-lg border border-gray-300 dark:border-noc-border px-3 py-1.5 text-sm text-gray-600 dark:text-noc-text-secondary hover:bg-gray-100 dark:hover:bg-noc-raised hover:text-gray-900 dark:hover:text-noc-text hover:border-gray-400 dark:hover:border-noc-border-hover cursor-pointer transition-all";

  return (
    <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-200 dark:border-noc-border bg-white dark:bg-noc-surface">
      <h1 className="text-base font-display font-semibold text-gray-900 dark:text-noc-text mr-auto tracking-tight">
        UniFi Firewall Analyser
      </h1>

      <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-noc-text-secondary cursor-pointer select-none">
        <input
          type="checkbox"
          checked={showDisabled}
          onChange={(e) => onShowDisabledChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 dark:border-noc-border text-ub-blue focus:ring-ub-blue bg-white dark:bg-noc-input accent-ub-blue"
        />
        Show disabled rules
      </label>

      <button
        onClick={() =>
          onColorModeChange(colorMode === "dark" ? "light" : "dark")
        }
        className={btnClass}
      >
        {colorMode === "dark" ? "Light" : "Dark"}
      </button>

      <button
        onClick={onRefresh}
        disabled={loading}
        className={`${btnClass} disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {loading ? "Refreshing..." : "Refresh"}
      </button>

      <button
        onClick={onOpenSettings}
        className={btnClass}
      >
        Settings
      </button>

      <button
        onClick={onLogout}
        className="rounded-lg border border-red-300 dark:border-status-danger/30 px-3 py-1.5 text-sm text-red-600 dark:text-status-danger hover:bg-red-50 dark:hover:bg-status-danger-dim cursor-pointer transition-all"
      >
        Disconnect
      </button>
    </div>
  );
}
