import { useMemo } from "react";
import { useAppAuthStatus, useAuthStatus } from "./queries";

export function useAuthFlow() {
  const appAuth = useAppAuthStatus();
  const appAuthRequired = appAuth.data?.required ?? false;
  const appAuthenticated = appAuth.data?.authenticated ?? false;
  const appAuthResolved = !appAuth.isLoading;

  const shouldCheckUnifi = appAuthResolved && (!appAuthRequired || appAuthenticated);
  const authQuery = useAuthStatus(shouldCheckUnifi);
  const authed = authQuery.data?.configured ?? false;
  const authLoading = appAuth.isLoading || (shouldCheckUnifi && authQuery.isLoading);
  const connectionInfo = useMemo(
    () => authed ? { url: authQuery.data!.url, username: authQuery.data!.username, source: authQuery.data!.source, authMethod: authQuery.data!.auth_method, controllerStatus: authQuery.data!.controller_status, controllerDetail: authQuery.data!.controller_detail } : null,
    [authed, authQuery.data],
  );

  return { appAuthRequired, appAuthenticated, authed, authLoading, connectionInfo, refetchAppAuth: appAuth.refetch, refetchAuth: authQuery.refetch };
}
