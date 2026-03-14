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
        colorMode={ctx.colorMode}
        onColorModeChange={ctx.onColorModeChange}
        showHidden={ctx.showHidden}
        onShowHiddenChange={ctx.onShowHiddenChange}
        hasHiddenZones={ctx.hasHiddenZones}
        hasDisabledRules={ctx.hasDisabledRules}
        onRefresh={ctx.onRefresh}
        loading={ctx.dataLoading}
        onLogout={ctx.onLogout}
        onOpenSettings={ctx.onOpenSettings}
        connectionInfo={ctx.connectionInfo}
        aiInfo={ctx.aiInfo}
      />
      {ctx.settingsOpen && (
        <SettingsModal onClose={ctx.onCloseSettings} />
      )}
      <div className="flex-1 flex overflow-hidden">
        <ModuleSidebar />
        <div className="flex-1 flex overflow-hidden bg-gray-50 dark:bg-noc-bg">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
