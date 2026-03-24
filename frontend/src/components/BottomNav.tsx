import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { shieldIcon, networkIcon, activityIcon, heartPulseIcon, settingsIcon, docIcon, rackIcon, cableIcon, haIcon, moreIcon } from "./icons";

interface BottomNavProps {
  onOpenSettings: () => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const primaryItems: NavItem[] = [
  { to: "/health", label: "Health", icon: heartPulseIcon },
  { to: "/metrics", label: "Metrics", icon: activityIcon },
  { to: "/topology", label: "Topology", icon: networkIcon },
  { to: "/firewall", label: "Firewall", icon: shieldIcon },
];

const overflowItems: NavItem[] = [
  { to: "/docs", label: "Docs", icon: docIcon },
  { to: "/rack-planner", label: "Rack Planner", icon: rackIcon },
  { to: "/cabling", label: "Cabling", icon: cableIcon },
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
      <div ref={menuRef} className="relative flex items-center justify-center">
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
