import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

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

const docIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const rackIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
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

const haIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M12 3L2 12h3v8h5v-5h4v5h5v-8h3L12 3z" />
  </svg>
);

const moreIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);

const primaryItems: NavItem[] = [
  { to: "/health", label: "Health", icon: heartPulseIcon },
  { to: "/metrics", label: "Metrics", icon: activityIcon },
  { to: "/topology", label: "Topology", icon: networkIcon },
  { to: "/firewall", label: "Firewall", icon: shieldIcon },
];

const overflowItems: NavItem[] = [
  { to: "/docs", label: "Docs", icon: docIcon },
  { to: "/rack-planner", label: "Rack Planner", icon: rackIcon },
  { to: "/home-assistant", label: "Home Assistant", icon: haIcon },
];

const linkClass = (isActive: boolean) =>
  `flex flex-col items-center justify-center gap-0.5 transition-colors ${
    isActive
      ? "text-ub-blue"
      : "text-ui-text-dim dark:text-noc-text-dim"
  }`;

const menuItemClass = (isActive: boolean) =>
  `flex items-center gap-3 w-full px-4 py-3 text-sm transition-colors ${
    isActive
      ? "text-ub-blue bg-blue-50 dark:bg-ub-blue-dim"
      : "text-ui-text dark:text-noc-text hover:bg-ui-raised dark:hover:bg-noc-raised"
  }`;

export default function BottomNav({ onOpenSettings }: BottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const isOverflowRouteActive = overflowItems.some((item) => location.pathname.startsWith(item.to));

  // Close menu on outside click
  useEffect(() => {
    if (!moreOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [moreOpen]);

  const closeMenu = () => setMoreOpen(false);

  return (
    <nav
      className="relative grid grid-cols-5 min-h-[52px] bg-ui-surface dark:bg-noc-surface border-t border-ui-border dark:border-noc-border pb-safe"
      aria-label="Bottom navigation"
    >
      {primaryItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => linkClass(isActive)}
        >
          {item.icon}
          <span className="text-[10px]">{item.label}</span>
        </NavLink>
      ))}
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setMoreOpen((prev) => !prev)}
          className={linkClass(isOverflowRouteActive || moreOpen)}
          aria-label="More"
          aria-expanded={moreOpen}
        >
          {moreIcon}
          <span className="text-[10px]">More</span>
        </button>
        {moreOpen && (
          <div
            className="absolute bottom-full right-0 mb-2 w-56 rounded-xl border border-ui-border dark:border-noc-border bg-ui-surface dark:bg-noc-surface shadow-xl overflow-hidden animate-fade-in"
            role="menu"
          >
            {overflowItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                role="menuitem"
                onClick={closeMenu}
                className={({ isActive }) => menuItemClass(isActive)}
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
            <div className="border-t border-ui-border dark:border-noc-border" />
            <button
              onClick={() => { closeMenu(); onOpenSettings(); }}
              role="menuitem"
              className={menuItemClass(false) + " cursor-pointer"}
            >
              {settingsIcon}
              Settings
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
