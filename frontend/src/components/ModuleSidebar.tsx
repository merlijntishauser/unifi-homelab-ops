import { useState } from "react";
import { NavLink } from "react-router-dom";

interface ModuleSidebarProps {
  onOpenSettings: () => void;
  notificationCount?: number;
  onOpenNotifications?: () => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const shieldIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const networkIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
    <line x1="6" y1="3" x2="6" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
);

const activityIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const heartPulseIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
    <path d="M19.5 12.572l-7.5 7.428-7.5-7.428A5 5 0 1 1 12 6.006a5 5 0 1 1 7.5 6.572" />
    <path d="M12 6l-2 4h4l-2 4" />
  </svg>
);

const docIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const rackIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <line x1="4" y1="7" x2="20" y2="7" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="17" x2="20" y2="17" />
    <circle cx="8" cy="4.5" r="0.5" fill="currentColor" />
    <circle cx="8" cy="9.5" r="0.5" fill="currentColor" />
    <circle cx="8" cy="14.5" r="0.5" fill="currentColor" />
    <circle cx="8" cy="19.5" r="0.5" fill="currentColor" />
  </svg>
);

const settingsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const chevronIcon = (expanded: boolean) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`w-4 h-4 shrink-0 transition-transform duration-200 ${expanded ? "" : "rotate-180"}`}>
    <polyline points="11 17 6 12 11 7" />
  </svg>
);

const navItems: NavItem[] = [
  { to: "/firewall", label: "Firewall", icon: shieldIcon },
  { to: "/topology", label: "Topology", icon: networkIcon },
  { to: "/metrics", label: "Metrics", icon: activityIcon },
  { to: "/health", label: "Health", icon: heartPulseIcon },
  { to: "/docs", label: "Docs", icon: docIcon },
  { to: "/rack-planner", label: "Rack", icon: rackIcon },
];

const navLinkClass = (isActive: boolean) =>
  `flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
    isActive
      ? "bg-blue-50 dark:bg-ub-blue-dim text-ub-blue"
      : "text-ui-text-dim dark:text-noc-text-dim hover:text-ui-text dark:hover:text-noc-text hover:bg-ui-raised dark:hover:bg-noc-raised"
  }`;

function readExpanded(): boolean {
  try {
    return localStorage.getItem("sidebarExpanded") !== "false";
  } catch {
    return true;
  }
}

const bellIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

function formatBadgeCount(count: number): string {
  return count > 9 ? "9+" : String(count);
}

export default function ModuleSidebar({ onOpenSettings, notificationCount = 0, onOpenNotifications }: ModuleSidebarProps) {
  const [expanded, setExpanded] = useState(readExpanded);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    try { localStorage.setItem("sidebarExpanded", String(next)); } catch { /* noop */ }
  };

  return (
    <nav
      className={`hidden lg:flex lg:flex-col ${expanded ? "w-45" : "w-12"} bg-ui-surface dark:bg-noc-surface border-r border-ui-border dark:border-noc-border transition-[width] duration-200 overflow-hidden shrink-0 z-20`}
      aria-label="Module navigation"
    >
      <div className="flex-1 flex flex-col gap-1 py-2 px-1.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => navLinkClass(isActive)}
            title={expanded ? undefined : item.label}
          >
            {item.icon}
            {expanded && <span>{item.label}</span>}
          </NavLink>
        ))}
      </div>
      <div className="border-t border-ui-border dark:border-noc-border py-2 px-1.5 flex flex-col gap-1">
        <button
          onClick={onOpenSettings}
          className={navLinkClass(false) + " w-full"}
          aria-label="Settings"
          title={expanded ? undefined : "Settings"}
        >
          {settingsIcon}
          {expanded && <span>Settings</span>}
        </button>
        {onOpenNotifications && (
          <button
            onClick={onOpenNotifications}
            className={navLinkClass(false) + " w-full relative"}
            aria-label="Notifications"
            title={expanded ? undefined : "Notifications"}
          >
            {bellIcon}
            {expanded && <span>Notifications</span>}
            {notificationCount > 0 && (
              <span className="absolute top-0.5 left-6 inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-status-danger text-white text-[10px] font-mono leading-none px-1">
                {formatBadgeCount(notificationCount)}
              </span>
            )}
          </button>
        )}
        <button
          onClick={toggle}
          className="flex items-center justify-center px-2.5 py-1.5 rounded-lg text-ui-text-dim dark:text-noc-text-dim hover:text-ui-text-secondary dark:hover:text-noc-text-secondary hover:bg-ui-raised dark:hover:bg-noc-raised transition-colors"
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {chevronIcon(expanded)}
        </button>
      </div>
    </nav>
  );
}
