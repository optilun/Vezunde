import React, { useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import NotificationCenter from "./NotificationCenter";
import {
  providerNotificationLocationIds,
  resolveProviderNotificationLocation,
  mergeProviderNotificationResults,
  settleProviderNotificationLocations,
} from "@/lib/providerNotificationScope";

function responseData(response) {
  const data = response?.data || {};
  if (data.error) throw new Error(data.error);
  return data;
}

export default function ProviderNotificationCenter({ locationId, locations, onOpenTarget }) {
  // Fiecare apel pentru "Toate locatiile" este reautorizat de endpointul existent.
  const scopeKey = JSON.stringify(providerNotificationLocationIds(locationId, locations));
  const locationIds = useMemo(() => JSON.parse(scopeKey), [scopeKey]);
  const isAggregate = Array.isArray(locations);

  const loadNotifications = useCallback(async () => {
    if (locationIds.length === 0) return { notifications: [], counters: { total: 0, unread: 0 } };
    const settled = await settleProviderNotificationLocations(locationIds, async (id) => {
      const response = await base44.functions.invoke("providerLeadInboxOps", {
        action: "notifications_list",
        location_id: id,
        limit: 100,
      });
      return responseData(response);
    });
    const successful = settled.filter((result) => result.status === "fulfilled").map((result) => result.value);
    const failed = settled.filter((result) => result.status === "rejected");
    if (successful.length === 0) throw failed[0]?.reason || new Error("Notificările nu au putut fi încărcate.");
    return {
      ...mergeProviderNotificationResults(successful),
      warning: failed.length > 0 ? `Notificările din ${failed.length} locații nu au putut fi încărcate. Încearcă din nou.` : "",
    };
  }, [locationIds]);

  const markNotificationRead = useCallback(async (notificationId, notification) => {
    const targetLocationId = resolveProviderNotificationLocation(notification, locationIds, isAggregate ? "" : locationId);
    if (!targetLocationId) throw new Error("Locația notificării nu este disponibilă.");
    const response = await base44.functions.invoke("providerLeadInboxOps", {
      action: "notification_mark_read",
      location_id: targetLocationId,
      notification_id: notificationId,
    });
    return responseData(response);
  }, [isAggregate, locationId, locationIds]);

  const markAllNotificationsRead = useCallback(async () => {
    const settled = await settleProviderNotificationLocations(locationIds, async (id) => {
      const response = await base44.functions.invoke("providerLeadInboxOps", {
        action: "notifications_mark_all_read",
        location_id: id,
      });
      return responseData(response);
    });
    const failed = settled.filter((result) => result.status === "rejected");
    if (failed.length > 0) throw new Error(`Notificările din ${failed.length} locații nu au putut fi marcate ca citite.`);
  }, [locationIds]);

  const openTarget = useCallback((notification) => {
    if (!notification?.action_target_id) return;
    const targetLocationId = resolveProviderNotificationLocation(notification, locationIds, isAggregate ? "" : locationId);
    if (!targetLocationId) return;
    if (onOpenTarget) {
      onOpenTarget({ ...notification, location_id: targetLocationId });
      return;
    }
    const target = document.getElementById(`provider-lead-${notification.action_target_id}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isAggregate, locationId, locationIds, onOpenTarget]);

  return (
    <NotificationCenter
      key={scopeKey}
      label="Notificări"
      loadNotifications={loadNotifications}
      markNotificationRead={markNotificationRead}
      markAllNotificationsRead={markAllNotificationsRead}
      onOpenTarget={openTarget}
    />
  );
}
