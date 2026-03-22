import type { AppNotification } from "../api/types";
import { BACKDROP_CLASS, CLOSE_BUTTON_CLASS } from "./ui";
import { formatRelativeTime } from "../utils/format";

interface NotificationDrawerProps {
  notifications: AppNotification[];
  open: boolean;
  onClose: () => void;
  onDismiss: (id: number) => void;
  onDismissAll: () => void;
  onNavigateToDevice: (mac: string) => void;
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


export default function NotificationDrawer({
  notifications,
  open,
  onClose,
  onDismiss,
  onDismissAll,
  onNavigateToDevice,
}: NotificationDrawerProps) {
  if (!open) return null;

  const sorted = [...notifications].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <>
      <div
        className={`${BACKDROP_CLASS} z-40`}
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        role="presentation"
        data-testid="drawer-backdrop"
      />
      <aside
        className="fixed left-0 top-0 bottom-0 w-full md:w-80 bg-ui-surface dark:bg-noc-surface border-r border-ui-border dark:border-noc-border z-50 flex flex-col shadow-xl animate-slide-left"
        aria-label="Notifications"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-ui-border dark:border-noc-border shrink-0">
          <h2 className="text-sm font-sans font-semibold text-ui-text dark:text-noc-text flex-1">
            Notifications
          </h2>
          {notifications.length > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-status-danger text-white text-xs font-mono px-1">
              {notifications.length}
            </span>
          )}
          {notifications.length > 0 && (
            <button
              onClick={onDismissAll}
              className="min-h-[44px] text-xs text-ui-text-secondary dark:text-noc-text-dim hover:text-ui-text dark:hover:text-noc-text cursor-pointer transition-colors"
            >
              Dismiss all
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close notifications"
            className={CLOSE_BUTTON_CLASS}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-ui-text-dim dark:text-noc-text-dim">No notifications</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1 p-2">
              {sorted.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-lg border border-ui-border dark:border-noc-border p-3 cursor-pointer hover:bg-ui-raised dark:hover:bg-noc-raised transition-colors ${
                    n.resolved_at ? "opacity-50" : ""
                  }`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onNavigateToDevice(n.device_mac)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onNavigateToDevice(n.device_mac);
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <SeverityDot severity={n.severity} />
                    <span className="text-sm font-medium text-ui-text dark:text-noc-text flex-1 truncate">
                      {n.title}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismiss(n.id);
                      }}
                      className="min-h-[44px] text-xs text-ui-text-dim dark:text-noc-text-dim hover:text-ui-text dark:hover:text-noc-text cursor-pointer transition-colors"
                      aria-label={`Dismiss ${n.title}`}
                    >
                      Dismiss
                    </button>
                  </div>
                  <p className="text-xs text-ui-text-secondary dark:text-noc-text-dim mb-1">{n.message}</p>
                  <div className="flex items-center gap-2 text-xs text-ui-text-dim dark:text-noc-text-dim">
                    <span>{formatRelativeTime(n.created_at)}</span>
                    {n.resolved_at && <span className="text-status-success">Resolved</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
