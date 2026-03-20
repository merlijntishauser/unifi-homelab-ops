import { useCallback } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Toolbar from "./Toolbar";
import SettingsModal from "./SettingsModal";
import ModuleSidebar from "./ModuleSidebar";
import BottomNav from "./BottomNav";
import NotificationDrawer from "./NotificationDrawer";
import { useAppContext } from "../hooks/useAppContext";
import { useNotifications, useDismissNotification } from "../hooks/queries";
import { useIsMobile } from "../hooks/useIsMobile";

export default function AppShell() {
  const ctx = useAppContext();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const authed = ctx.connectionInfo !== null;
  const notificationsQuery = useNotifications(authed);
  const dismissMutation = useDismissNotification();
  const notifications = notificationsQuery.data ?? [];

  const handleDismiss = (id: number) => {
    dismissMutation.mutate(id);
  };

  const handleDismissAll = () => {
    for (const n of notifications) {
      dismissMutation.mutate(n.id);
    }
  };

  const handleNavigateToDevice = useCallback((mac: string) => {
    ctx.onCloseNotifications();
    navigate(`/metrics?device=${encodeURIComponent(mac)}`);
  }, [ctx, navigate]);

  return (
    <div className="h-dvh flex flex-col">
      <Toolbar
        themePreference={ctx.themePreference}
        onThemePreferenceChange={ctx.onThemePreferenceChange}
        connectionInfo={ctx.connectionInfo}
        aiInfo={ctx.aiInfo}
        notificationCount={ctx.notificationCount}
        onOpenNotifications={ctx.onOpenNotifications}
      />
      {ctx.settingsOpen && (
        <SettingsModal onClose={ctx.onCloseSettings} />
      )}
      <NotificationDrawer
        notifications={notifications}
        open={ctx.notificationsOpen}
        onClose={ctx.onCloseNotifications}
        onDismiss={handleDismiss}
        onDismissAll={handleDismissAll}
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
        <div className="flex-1 flex overflow-hidden bg-ui-bg dark:bg-noc-bg">
          <Outlet />
        </div>
      </div>
      {isMobile && <BottomNav onOpenSettings={ctx.onOpenSettings} />}
    </div>
  );
}
