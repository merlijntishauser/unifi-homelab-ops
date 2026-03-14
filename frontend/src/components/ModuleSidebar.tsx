import { NavLink } from "react-router-dom";

interface ModuleSidebarProps {
  onOpenSettings: () => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const shieldIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const networkIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <line x1="6" y1="3" x2="6" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
);

const activityIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const heartPulseIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M19.5 12.572l-7.5 7.428-7.5-7.428A5 5 0 1 1 12 6.006a5 5 0 1 1 7.5 6.572" />
    <path d="M12 6l-2 4h4l-2 4" />
  </svg>
);

const settingsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const navItems: NavItem[] = [
  { to: "/firewall", label: "Firewall", icon: shieldIcon },
  { to: "/topology", label: "Topology", icon: networkIcon },
  { to: "/metrics", label: "Metrics", icon: activityIcon },
  { to: "/health", label: "Health", icon: heartPulseIcon },
];

const navLinkClass = (isActive: boolean) =>
  `flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
    isActive
      ? "bg-blue-50 dark:bg-ub-blue-dim text-ub-blue"
      : "text-gray-500 dark:text-noc-text-dim hover:text-gray-900 dark:hover:text-noc-text hover:bg-gray-100 dark:hover:bg-noc-raised"
  }`;

export default function ModuleSidebar({ onOpenSettings }: ModuleSidebarProps) {
  return (
    <nav
      className="group/sidebar flex flex-col w-12 hover:w-45 bg-white dark:bg-noc-surface border-r border-gray-200 dark:border-noc-border transition-[width] duration-200 overflow-hidden shrink-0 z-20"
      aria-label="Module navigation"
    >
      <div className="flex-1 flex flex-col gap-1 py-2 px-1.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => navLinkClass(isActive)}
          >
            {item.icon}
            <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">
              {item.label}
            </span>
          </NavLink>
        ))}
      </div>
      <div className="border-t border-gray-200 dark:border-noc-border py-2 px-1.5">
        <button
          onClick={onOpenSettings}
          className={navLinkClass(false) + " w-full"}
          aria-label="Settings"
        >
          {settingsIcon}
          <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">
            Settings
          </span>
        </button>
      </div>
    </nav>
  );
}
