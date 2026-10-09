import { buildLocalInterest, localAreaKey, completedInterestWindows, LOCAL_INTEREST_VERSION } from './providerLocalInterestPolicy.js';
import { createInAppNotification } from './inAppNotificationDelivery.js';
const cache = new Map();
async function readEvents(svc, location, now) {
  const windows = completedInterestWindows(now);
  const rows = [];
  const query = { analytics_version: LOCAL_INTEREST_VERSION, analytics_eligible: true,
    county_key: localAreaKey(location.county_name || location.county),
    created_date: { $gte: new Date(windows.start).toISOString(), $lt: new Date(windows.end).toISOString() } };
  for (let skip = 0; skip <= 10000; skip += 1000) {
    const page = await svc.entities.PatientSearchEvent.filter(query, 'created_date', 1000, skip);
    rows.push(...page);
    if (rows.length > 10000) return { events: [], complete: false };
    if (page.length < 1000) return { events: rows, complete: true };
  }
  return { events: [], complete: false };
}
export async function loadLocalInterest(svc, location, entitlement, now = Date.now()) {
  const services = await svc.entities.LocationService.filter({ location_id: location.id, is_active: true }, 'service_key', 500);
  const key = JSON.stringify([location.id, location.locality_siruta_code, location.county_name || location.county,
    entitlement.plan_code, completedInterestWindows(now).end, services.map(row => [row.service_key, row.matching_allowed, row.accepts_requests, row.provider_visibility_status])]);
  const cached = cache.get(key);
  if (cached && now - cached.at < 300000) return cached.value;
  const source = localAreaKey(location.county_name || location.county) && services.length
    ? await readEvents(svc, location, now) : { events: [], complete: true };
  const first = await svc.entities.PatientSearchEvent.filter({
    analytics_version: LOCAL_INTEREST_VERSION, analytics_eligible: true,
  }, 'created_date', 1, 0, ['created_date']);
  const value = { ...buildLocalInterest({ ...source, location, services, planCode: entitlement.plan_code, now }),
    data_since: first[0]?.created_date ? String(first[0].created_date).slice(0, 10) : null };
  if (cache.size >= 100) cache.delete(cache.keys().next().value);
  cache.set(key, { at: now, value });
  return value;
}
export async function readActivityPreference(svc, userId, locationId) {
  const rows = await svc.entities.ProviderActivityPreference.filter({ user_id: userId, location_id: locationId }, '-updated_date', 100);
  return { weekly_enabled: rows.length === 0 || rows[0].weekly_enabled !== false, rows };
}
export async function saveActivityPreference(svc, userId, locationId, weeklyEnabled) {
  if (typeof weeklyEnabled !== 'boolean') throw new Error('invalid_preference');
  const { rows } = await readActivityPreference(svc, userId, locationId);
  if (rows.length) await Promise.all(rows.map(row => svc.entities.ProviderActivityPreference.update(row.id, { weekly_enabled: weeklyEnabled })));
  else await svc.entities.ProviderActivityPreference.create({ user_id: userId, location_id: locationId, weekly_enabled: weeklyEnabled });
  return { weekly_enabled: weeklyEnabled };
}
export async function ensureLocalInterestDigest({ svc, user, location, entitlement, now = Date.now() }) {
  const preference = await readActivityPreference(svc, user.id, location.id);
  if (!preference.weekly_enabled) return null;
  const interest = await loadLocalInterest(svc, location, entitlement, now);
  if (interest.status !== 'ready' || interest.weekly.total === null) return null;
  // One completed week / location / authorized user. Existing notifications are reused.
  return createInAppNotification({
    svc, eventKey: 'provider_local_interest_weekly', recipientType: 'provider_user', recipientRefId: user.id,
    sourceEntityType: 'LocalInterestWeek', sourceEntityId: location.id + ':' + interest.weekly.start.slice(0, 10),
    organizationId: location.organization_id || '', locationId: location.id,
    title: 'Activitate în zona locației',
    body: interest.weekly.total + ' căutări relevante ' + (interest.area_scope === 'county' ? 'în județul ' : 'în ') + interest.area_label + ' în săptămâna încheiată. Sunt căutări anonime, nu cereri trimise locației.',
    actionKind: 'activity', actionTargetId: location.id,
  });
}
