import { createContext, useContext } from "react";
import type { ColorMode } from "@xyflow/react";
import type { Zone, ZonePair } from "../api/types";

interface ConnectionInfo {
  url: string;
  username: string;
  source: "env" | "runtime" | "none";
}

interface AiInfo {
  configured: boolean;
  provider: string;
  model: string;
}

export type ThemePreference = "light" | "dark" | "system";

export interface AppContextValue {
  colorMode: ColorMode;
  themePreference: ThemePreference;
  onThemePreferenceChange: (pref: ThemePreference) => void;
  showHidden: boolean;
  onShowHiddenChange: (show: boolean) => void;
  hasHiddenZones: boolean;
  hasDisabledRules: boolean;
  onRefresh: () => void;
  dataLoading: boolean;
  onLogout: () => void;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  settingsOpen: boolean;
  connectionInfo: ConnectionInfo | null;
  aiInfo: AiInfo;
  aiConfigured: boolean;
  zones: Zone[];
  zonePairs: ZonePair[];
  filteredZonePairs: ZonePair[];
  visibleZones: Zone[];
  hiddenZoneIds: Set<string>;
  onToggleZone: (zoneId: string) => void;
  dataError: Error | null;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useAppContext must be used within AppContext.Provider");
  }
  return ctx;
}
