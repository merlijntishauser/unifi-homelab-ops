/** Standard text input / select class used across all forms. */
export const INPUT_CLASS =
  "w-full rounded-lg border border-ui-border dark:border-noc-border bg-ui-input dark:bg-noc-input min-h-[40px] px-3 py-2.5 text-sm text-ui-text dark:text-noc-text placeholder-ui-text-dim dark:placeholder-noc-text-dim focus:border-ub-blue focus:outline-none focus:ring-1 focus:ring-ub-blue/40 transition-colors";

/** Compact input variant for simulation forms (smaller padding, monospace). */
export const INPUT_COMPACT_CLASS =
  "w-full rounded-lg border border-ui-border dark:border-noc-border bg-ui-input dark:bg-noc-input px-2.5 py-2.5 lg:py-1.5 text-xs font-mono text-ui-text dark:text-noc-text placeholder-ui-text-dim dark:placeholder-noc-text-dim focus:border-ub-blue focus:outline-none focus:ring-1 focus:ring-ub-blue/40 transition-colors";

/** Overlay backdrop for modals, drawers, and dialogs. Use with role="presentation". */
export const BACKDROP_CLASS =
  "fixed inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm";

/** Close button with 44px min touch target. */
export const CLOSE_BUTTON_CLASS =
  "min-w-[44px] min-h-[44px] flex items-center justify-center text-ui-text-dim dark:text-noc-text-dim hover:text-ui-text dark:hover:text-noc-text text-xl cursor-pointer transition-colors";
