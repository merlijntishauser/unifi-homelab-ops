import { Outlet } from "react-router-dom";
import Toolbar from "./Toolbar";
import SettingsModal from "./SettingsModal";
import ModuleSidebar from "./ModuleSidebar";
import NotificationDrawer from "./NotificationDrawer";
import { useAppContext } from "../hooks/useAppContext";
import { useNotifications, useDismissNotification } from "../hooks/queries";

export default function AppShell() {
  const ctx = useAppContext();
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

  return (
    <div className="h-screen flex flex-col">
      <Toolbar
        themePreference={ctx.themePreference}
        onThemePreferenceChange={ctx.onThemePreferenceChange}
        connectionInfo={ctx.connectionInfo}
        aiInfo={ctx.aiInfo}
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
        onNavigateToDevice={() => ctx.onCloseNotifications()}
      />
      <div className="flex-1 flex overflow-hidden">
        <ModuleSidebar
          onOpenSettings={ctx.onOpenSettings}
          notificationCount={ctx.notificationCount}
          onOpenNotifications={ctx.onOpenNotifications}
        />
        <div className="flex-1 flex overflow-hidden bg-gray-50 dark:bg-noc-bg">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
