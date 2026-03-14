import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
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
import { createAppRouter } from "./router";
import LoginScreen from "./components/LoginScreen";
import PassphraseScreen from "./components/PassphraseScreen";

interface AppState {
  colorMode: ColorMode;
  showHidden: boolean;
  settingsOpen: boolean;
  hiddenZoneIds: Set<string>;
}

const initialAppState: AppState = {
  colorMode: "dark" as ColorMode,
  showHidden: false,
  settingsOpen: false,
  hiddenZoneIds: new Set<string>(),
};

function initAppState(): AppState {
  const stored = localStorage.getItem("colorMode");
  const colorMode: ColorMode = stored === "light" || stored === "dark" ? stored : "dark";
  return { ...initialAppState, colorMode };
}

type AppAction = Partial<AppState> | ((prev: AppState) => Partial<AppState>);

function appReducer(state: AppState, action: AppAction): AppState {
  const update = typeof action === "function" ? action(state) : action;
  return { ...state, ...update };
}

function LoadingOverlay({ message }: { message: string | null }) {
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-noc-bg">
      <div className="h-6 w-6 rounded-full border-2 border-gray-300 dark:border-noc-border border-t-ub-blue animate-spin" />
      {message && (
        <p className="text-sm text-gray-500 dark:text-noc-text-secondary font-body animate-pulse">{message}</p>
      )}
    </div>
  );
}

const router = createAppRouter();

function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState, initAppState);
  const { colorMode, showHidden, settingsOpen, hiddenZoneIds } = state;
  const qc = useQueryClient();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", colorMode === "dark");
  }, [colorMode]);

  const { appAuthRequired, appAuthenticated, authed, authLoading, connectionInfo, refetchAppAuth, refetchAuth } = useAuthFlow();
  const { zones, zonePairs, dataLoading, dataError } = useFirewallQueries(authed);
  const { aiConfigured, aiInfo } = useAiInfo(authed);

  const zoneFilterQuery = useZoneFilter(authed);

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

  const handleColorModeChange = useCallback((mode: ColorMode) => {
    localStorage.setItem("colorMode", mode);
    dispatch({ colorMode: mode });
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
    onColorModeChange: handleColorModeChange,
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
  };

  return (
    <AppContext.Provider value={contextValue}>
      <RouterProvider router={router} />
    </AppContext.Provider>
  );
}

export default App;
