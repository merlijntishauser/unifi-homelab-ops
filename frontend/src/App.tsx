import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { ColorMode } from "@xyflow/react";
import { RouterProvider } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  queryKeys,
  useZoneFilter,
  useLogout,
  useSaveZoneFilter,
} from "./hooks/queries";
import { useAuthFlow } from "./hooks/useAuth";
import { useFirewallQueries } from "./hooks/useFirewallQueries";
import { useAiInfo } from "./hooks/useAiInfo";
import { AppContext } from "./hooks/useAppContext";
import { useNotificationState } from "./hooks/useNotifications";
import type { ThemePreference } from "./hooks/useAppContext";
import { createAppRouter } from "./router";
import LoginScreen from "./components/LoginScreen";
import PassphraseScreen from "./components/PassphraseScreen";

interface AppState {
  themePreference: ThemePreference;
  showHidden: boolean;
  settingsOpen: boolean;
  hiddenZoneIds: Set<string>;
  notificationsOpen: boolean;
}

const initialAppState: AppState = {
  themePreference: "dark",
  showHidden: false,
  settingsOpen: false,
  hiddenZoneIds: new Set<string>(),
  notificationsOpen: false,
};

function initAppState(): AppState {
  const stored = localStorage.getItem("themePreference");
  const themePreference: ThemePreference =
    stored === "light" || stored === "dark" || stored === "system" ? stored : "dark";
  return { ...initialAppState, themePreference };
}

type AppAction = Partial<AppState> | ((prev: AppState) => Partial<AppState>);

function appReducer(state: AppState, action: AppAction): AppState {
  const update = typeof action === "function" ? action(state) : action;
  return { ...state, ...update };
}

function resolveColorMode(preference: ThemePreference, systemDark: boolean): ColorMode {
  if (preference === "system") return systemDark ? "dark" : "light";
  return preference;
}

function LoadingOverlay({ message }: { message: string | null }) {
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-3 bg-ui-bg dark:bg-noc-bg">
      <div className="h-6 w-6 rounded-full border-2 border-ui-border dark:border-noc-border border-t-ub-blue animate-spin" />
      {message && (
        <p className="text-sm text-ui-text-secondary dark:text-noc-text-secondary animate-pulse">{message}</p>
      )}
    </div>
  );
}

const router = createAppRouter();

function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState, initAppState);
  const { themePreference, showHidden, settingsOpen, hiddenZoneIds, notificationsOpen } = state;
  const qc = useQueryClient();

  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    function handler(e: MediaQueryListEvent) {
      setSystemDark(e.matches);
    }
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const colorMode = resolveColorMode(themePreference, systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", colorMode === "dark");
  }, [colorMode]);

  const { appAuthRequired, appAuthenticated, authed, authLoading, connectionInfo, refetchAppAuth, refetchAuth } = useAuthFlow();
  const { zones, zonePairs, dataLoading, dataError } = useFirewallQueries(authed);
  const { aiConfigured, aiInfo } = useAiInfo(authed);

  const zoneFilterQuery = useZoneFilter(authed);
  const notificationState = useNotificationState(authed);

  // Sync hiddenZoneIds from server when filter data arrives
  const lastFilterRef = useRef<string[] | undefined>(undefined);
  useEffect(() => {
    const serverIds = zoneFilterQuery.data?.hidden_zone_ids;
    if (serverIds && serverIds !== lastFilterRef.current) {
      lastFilterRef.current = serverIds;
      dispatch({ hiddenZoneIds: new Set(serverIds) });
    }
  }, [zoneFilterQuery.data]);

  const logoutMutation = useLogout();
  const saveZoneFilterMutation = useSaveZoneFilter();

  const handleLogout = useCallback(async () => {
    clearTimeout(saveTimerRef.current);
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const handleRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.zones });
    qc.invalidateQueries({ queryKey: queryKeys.zonePairs });
  }, [qc]);

  const filteredZonePairs = useMemo(() => {
    if (showHidden) return zonePairs;
    return zonePairs.map((pair) => ({
      ...pair,
      rules: pair.rules.filter((r) => r.enabled),
    }));
  }, [zonePairs, showHidden]);

  const visibleZones = useMemo(() => {
    if (showHidden || hiddenZoneIds.size === 0) return zones;
    return zones.filter((z) => !hiddenZoneIds.has(z.id));
  }, [zones, hiddenZoneIds, showHidden]);

  const hasDisabledRules = useMemo(
    () => zonePairs.some((p) => p.rules.some((r) => !r.enabled)),
    [zonePairs],
  );

  const hasHiddenZones = hiddenZoneIds.size > 0;

  const saveTimerRef = useRef<number | undefined>(undefined);

  // Clean up debounced save on unmount
  useEffect(() => {
    return () => clearTimeout(saveTimerRef.current);
  }, []);

  const handleToggleZone = useCallback((zoneId: string) => {
    dispatch((prev) => {
      const next = new Set(prev.hiddenZoneIds);
      if (next.has(zoneId)) {
        next.delete(zoneId);
      } else {
        next.add(zoneId);
      }
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        saveZoneFilterMutation.mutate([...next]);
      }, 300);
      return { hiddenZoneIds: next };
    });
  }, [saveZoneFilterMutation]);

  const handleThemePreferenceChange = useCallback((pref: ThemePreference) => {
    localStorage.setItem("themePreference", pref);
    dispatch({ themePreference: pref });
  }, []);

  const handleCloseSettings = useCallback(() => {
    dispatch({ settingsOpen: false });
    qc.invalidateQueries({ queryKey: queryKeys.aiConfig });
  }, [qc]);

  // Auth gates
  if (appAuthRequired && !appAuthenticated && !authLoading) {
    return (
      <PassphraseScreen
        onAuthenticated={() => {
          refetchAppAuth();
        }}
      />
    );
  }

  if (!authed && !authLoading) {
    return <LoginScreen onLoggedIn={() => refetchAuth()} />;
  }

  if (authLoading) {
    return <LoadingOverlay message="Checking authentication..." />;
  }

  const contextValue = {
    colorMode,
    themePreference,
    onThemePreferenceChange: handleThemePreferenceChange,
    showHidden,
    onShowHiddenChange: (val: boolean) => dispatch({ showHidden: val }),
    hasHiddenZones,
    hasDisabledRules,
    onRefresh: handleRefresh,
    dataLoading,
    onLogout: handleLogout,
    onOpenSettings: () => dispatch({ settingsOpen: true }),
    onCloseSettings: handleCloseSettings,
    settingsOpen,
    connectionInfo,
    aiInfo,
    aiConfigured,
    zones,
    zonePairs,
    filteredZonePairs,
    visibleZones,
    hiddenZoneIds,
    onToggleZone: handleToggleZone,
    dataError,
    notificationsOpen,
    onOpenNotifications: () => dispatch({ notificationsOpen: true }),
    onCloseNotifications: () => dispatch({ notificationsOpen: false }),
    notificationCount: notificationState.activeCount,
    notificationState,
  };

  return (
    <AppContext.Provider value={contextValue}>
      <RouterProvider router={router} />
    </AppContext.Provider>
  );
}

export default App;
