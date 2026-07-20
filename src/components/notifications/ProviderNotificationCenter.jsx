import React, { useCallback } from "react";
import { base44 } from "@/api/base44Client";
import NotificationCenter from "./NotificationCenter";

function responseData(response) {
  const data = response?.data || {};
  if (data.error) throw new Error(data.error);
  return data;
}

export default function ProviderNotificationCenter({ locationId, onOpenTarget }) {
  const loadNotifications = useCallback(async () => {
    const response = await base44.functions.invoke("providerLeadInboxOps", {
      action: "notifications_list",
      location_id: locationId,
      limit: 100,
    });
    return responseData(response);
  }, [locationId]);

  const markNotificationRead = useCallback(async (notificationId) => {
    const response = await base44.functions.invoke("providerLeadInboxOps", {
      action: "notification_mark_read",
      location_id: locationId,
      notification_id: notificationId,
    });
    return responseData(response);
  }, [locationId]);

  const markAllNotificationsRead = useCallback(async () => {
    const response = await base44.functions.invoke("providerLeadInboxOps", {
      action: "notifications_mark_all_read",
      location_id: locationId,
    });
    return responseData(response);
  }, [locationId]);

  const openTarget = useCallback((notification) => {
    if (!notification?.action_target_id) return;
    if (onOpenTarget) {
      onOpenTarget(notification);
      return;
    }
    const target = document.getElementById(`provider-lead-${notification.action_target_id}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [onOpenTarget]);

  return (
    <NotificationCenter
      label="Notificări"
      loadNotifications={loadNotifications}
      markNotificationRead={markNotificationRead}
      markAllNotificationsRead={markAllNotificationsRead}
      onOpenTarget={openTarget}
    />
  );
}
