export function providerNotificationLocationIds(locationId, locations) {
  const ids = Array.isArray(locations) ? locations.map((location) => location?.id) : [locationId];
  return [...new Set(ids.filter((id) => typeof id === "string" && id.trim().length > 0))];
}

export function resolveProviderNotificationLocation(notification, locationIds, fallbackLocationId = "") {
  const targetLocationId = notification?.location_id || fallbackLocationId;
  return locationIds.includes(targetLocationId) ? targetLocationId : "";
}

export function mergeProviderNotificationResults(results) {
  const notificationsById = new Map();
  let total = 0;
  let unread = 0;
  for (const result of results) {
    total += Number(result?.counters?.total || 0);
    unread += Number(result?.counters?.unread || 0);
    for (const notification of result?.notifications || []) {
      if (notification?.id) notificationsById.set(notification.id, notification);
    }
  }
  const notifications = [...notificationsById.values()]
    .sort((a, b) => String(b.created_date || "").localeCompare(String(a.created_date || "")) || a.id.localeCompare(b.id))
    .slice(0, 100);
  return { notifications, counters: { total, unread } };
}

// Evita un val simultan de requesturi pentru retele cu multe locatii.
export async function settleProviderNotificationLocations(locationIds, request) {
  const results = [];
  for (let index = 0; index < locationIds.length; index += 5) {
    const batch = await Promise.allSettled(locationIds.slice(index, index + 5).map(request));
    results.push(...batch);
  }
  return results;
}
