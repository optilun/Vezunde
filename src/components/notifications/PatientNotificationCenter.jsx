import React, { useCallback } from "react";
import { base44 } from "@/api/base44Client";
import NotificationCenter from "./NotificationCenter";

function responseData(response) {
  const data = response?.data || {};
  if (data.error) throw new Error(data.error);
  return data;
}

export default function PatientNotificationCenter({ requestId, accessToken }) {
  const invoke = useCallback(async (action, notificationId = "") => {
    const response = await base44.functions.invoke("getPatientRequestStatus", {
      action,
      request_id: requestId,
      request_access_token: accessToken,
      notification_id: notificationId,
      limit: 100,
    });
    return responseData(response);
  }, [accessToken, requestId]);

  const loadNotifications = useCallback(() => invoke("notifications_list"), [invoke]);
  const markNotificationRead = useCallback((notificationId) => invoke("notification_mark_read", notificationId), [invoke]);
  const markAllNotificationsRead = useCallback(() => invoke("notifications_mark_all_read"), [invoke]);

  const openTarget = useCallback((notification) => {
    if (!notification?.action_target_id) return;
    const target = document.getElementById(`patient-response-${notification.action_target_id}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <NotificationCenter
      label="Actualizări"
      loadNotifications={loadNotifications}
      markNotificationRead={markNotificationRead}
      markAllNotificationsRead={markAllNotificationsRead}
      onOpenTarget={openTarget}
    />
  );
}
