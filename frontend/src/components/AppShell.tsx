import { Outlet } from "react-router-dom";
import Toolbar from "./Toolbar";
import SettingsModal from "./SettingsModal";
import ModuleSidebar from "./ModuleSidebar";
import { useAppContext } from "../hooks/useAppContext";

export default function AppShell() {
  const ctx = useAppContext();

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
      <div className="flex-1 flex overflow-hidden">
        <ModuleSidebar onOpenSettings={ctx.onOpenSettings} />
        <div className="flex-1 flex overflow-hidden bg-gray-50 dark:bg-noc-bg">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
