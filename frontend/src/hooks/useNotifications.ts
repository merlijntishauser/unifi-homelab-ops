import { useCallback, useMemo } from "react";
import type { AppNotification } from "../api/types";
import { useNotifications as useNotificationsQuery, useDismissNotification } from "./queries";

export interface NotificationState {
  notifications: AppNotification[];
  activeCount: number;
  dismiss: (id: number) => void;
  dismissAll: () => void;
}

export function useNotificationState(enabled: boolean): NotificationState {
  const query = useNotificationsQuery(enabled);
  const dismissMutation = useDismissNotification();
  const notifications = useMemo(() => query.data ?? [], [query.data]);

  const activeCount = useMemo(
    () => notifications.filter((n) => !n.dismissed && !n.resolved_at).length,
    [notifications],
  );

  const dismiss = useCallback(
    (id: number) => dismissMutation.mutate(id),
    [dismissMutation],
  );

  const dismissAll = useCallback(() => {
    for (const n of notifications) {
      dismissMutation.mutate(n.id);
    }
  }, [notifications, dismissMutation]);

  return { notifications, activeCount, dismiss, dismissAll };
}
