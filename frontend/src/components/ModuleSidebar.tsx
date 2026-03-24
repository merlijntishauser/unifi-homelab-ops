import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useVersionCheck } from "../hooks/useVersionCheck";
import { shieldIcon, networkIcon, activityIcon, heartPulseIcon, docIcon, rackIcon, cableIcon, haIcon, settingsIcon } from "./icons";

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

const chevronIcon = (expanded: boolean) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`w-4 h-4 shrink-0 transition-transform duration-200 ${expanded ? "" : "rotate-180"}`}>
    <polyline points="11 17 6 12 11 7" />
  </svg>
);

const navItems: NavItem[] = [
  { to: "/health", label: "Health", icon: heartPulseIcon },
  { to: "/metrics", label: "Metrics", icon: activityIcon },
  { to: "/topology", label: "Topology", icon: networkIcon },
  { to: "/firewall", label: "Firewall", icon: shieldIcon },
  { to: "/docs", label: "Docs", icon: docIcon },
  { to: "/rack-planner", label: "Rack", icon: rackIcon },
  { to: "/cabling", label: "Cabling", icon: cableIcon },
  { to: "/home-assistant", label: "Home Assistant", icon: haIcon },
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
  const { build, updateAvailable } = useVersionCheck();

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
        {expanded && (
          <div className="px-2.5 py-1">
            <p className="text-[10px] font-mono text-ui-text-dim dark:text-noc-text-dim truncate" title={build.label}>
              {build.label}
            </p>
            {updateAvailable && (
              <a
                href="https://hub.docker.com/r/merlijntishauser/unifi-homelab-ops/tags"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 mt-0.5 text-[10px] font-semibold text-status-warning hover:text-status-warning/80 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 shrink-0">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {updateAvailable} available
              </a>
            )}
          </div>
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
