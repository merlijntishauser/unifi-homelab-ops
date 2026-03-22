import { useCallback } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Toolbar from "./Toolbar";
import SettingsModal from "./SettingsModal";
import ModuleSidebar from "./ModuleSidebar";
import BottomNav from "./BottomNav";
import NotificationDrawer from "./NotificationDrawer";
import { useAppContext } from "../hooks/useAppContext";
import { useIsMobile } from "../hooks/useIsMobile";

export default function AppShell() {
  const ctx = useAppContext();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { notifications, dismiss, dismissAll } = ctx.notificationState;

  const handleNavigateToDevice = useCallback((mac: string) => {
    ctx.onCloseNotifications();
    navigate(`/metrics?device=${encodeURIComponent(mac)}`);
  }, [ctx, navigate]);

  return (
    <div className="h-dvh flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:rounded-lg focus:bg-ub-blue focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Skip to content
      </a>
      <Toolbar
        themePreference={ctx.themePreference}
        onThemePreferenceChange={ctx.onThemePreferenceChange}
        connectionInfo={ctx.connectionInfo}
        aiInfo={ctx.aiInfo}
        notificationCount={ctx.notificationCount}
        onOpenNotifications={ctx.onOpenNotifications}
        onAppLogout={ctx.onAppLogout ?? undefined}
      />
      {ctx.settingsOpen && (
        <SettingsModal onClose={ctx.onCloseSettings} />
      )}
      <NotificationDrawer
        notifications={notifications}
        open={ctx.notificationsOpen}
        onClose={ctx.onCloseNotifications}
        onDismiss={dismiss}
        onDismissAll={dismissAll}
        onNavigateToDevice={handleNavigateToDevice}
      />
      <div className="flex-1 flex overflow-hidden">
        {!isMobile && (
          <ModuleSidebar
            onOpenSettings={ctx.onOpenSettings}
            notificationCount={ctx.notificationCount}
            onOpenNotifications={ctx.onOpenNotifications}
          />
        )}
        <main id="main-content" className="flex-1 flex overflow-hidden bg-ui-bg dark:bg-noc-bg">
          <Outlet />
        </main>
      </div>
      {isMobile && <BottomNav onOpenSettings={ctx.onOpenSettings} />}
    </div>
  );
}
