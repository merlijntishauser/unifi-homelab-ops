/** Standard text input / select class used across all forms. */
export const INPUT_CLASS =
  "w-full rounded-lg border border-ui-border dark:border-noc-border bg-ui-input dark:bg-noc-input h-[44px] px-3 py-2.5 text-sm text-ui-text dark:text-noc-text placeholder-ui-text-dim dark:placeholder-noc-text-dim focus:border-ub-blue focus:outline-none focus:ring-1 focus:ring-ub-blue/40 transition-colors";

/** Compact input variant for simulation forms (smaller padding, monospace). */
export const INPUT_COMPACT_CLASS =
  "w-full rounded-lg border border-ui-border dark:border-noc-border bg-ui-input dark:bg-noc-input px-2.5 py-2.5 lg:py-1.5 text-xs font-mono text-ui-text dark:text-noc-text placeholder-ui-text-dim dark:placeholder-noc-text-dim focus:border-ub-blue focus:outline-none focus:ring-1 focus:ring-ub-blue/40 transition-colors";

/** Select input with consistent height and custom chevron. */
export const SELECT_CLASS =
  "w-full rounded-lg border border-ui-border dark:border-noc-border bg-ui-input dark:bg-noc-input h-[44px] px-3 pr-8 text-sm text-ui-text dark:text-noc-text focus:border-ub-blue focus:outline-none focus:ring-1 focus:ring-ub-blue/40 transition-colors appearance-none bg-[length:16px_16px] bg-[position:right_8px_center] bg-no-repeat bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%236b7280%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.22%208.22a.75.75%200%200%201%201.06%200L10%2011.94l3.72-3.72a.75.75%200%201%201%201.06%201.06l-4.25%204.25a.75.75%200%200%201-1.06%200L5.22%209.28a.75.75%200%200%201%200-1.06z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')]";

/** Overlay backdrop for modals, drawers, and dialogs. Use with role="presentation". */
export const BACKDROP_CLASS =
  "fixed inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm";

/** Close button with 44px min touch target. */
export const CLOSE_BUTTON_CLASS =
  "min-w-[44px] min-h-[44px] flex items-center justify-center text-ui-text-dim dark:text-noc-text-dim hover:text-ui-text dark:hover:text-noc-text text-xl cursor-pointer transition-colors";
