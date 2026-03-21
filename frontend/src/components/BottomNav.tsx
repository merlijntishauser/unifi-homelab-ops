import { NavLink } from "react-router-dom";

interface BottomNavProps {
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
  { to: "/health", label: "Health", icon: heartPulseIcon },
  { to: "/metrics", label: "Metrics", icon: activityIcon },
  { to: "/topology", label: "Topology", icon: networkIcon },
  { to: "/firewall", label: "Firewall", icon: shieldIcon },
];

const linkClass = (isActive: boolean) =>
  `flex flex-col items-center justify-center gap-0.5 transition-colors ${
    isActive
      ? "text-ub-blue"
      : "text-ui-text-dim dark:text-noc-text-dim"
  }`;

export default function BottomNav({ onOpenSettings }: BottomNavProps) {
  return (
    <nav
      className="grid grid-cols-5 min-h-[52px] bg-ui-surface dark:bg-noc-surface border-t border-ui-border dark:border-noc-border pb-safe"
      aria-label="Bottom navigation"
    >
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => linkClass(isActive)}
        >
          {item.icon}
          <span className="text-[10px]">{item.label}</span>
        </NavLink>
      ))}
      <button
        onClick={onOpenSettings}
        className={linkClass(false)}
        aria-label="Settings"
      >
        {settingsIcon}
        <span className="text-[10px]">Settings</span>
      </button>
    </nav>
  );
}
