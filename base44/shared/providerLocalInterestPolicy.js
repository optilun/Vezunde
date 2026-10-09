import { normalizeServiceKey } from './canonicalServiceRegistryExtended.js';
export const LOCAL_INTEREST_VERSION = 'local-interest-v1';
export const LOCAL_INTEREST_MIN_SESSIONS = 5;
export const DAY = 86400000;
export const localAreaKey = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const GROUPS = {
  optical_retail: ['optical', 'Ochelari și lentile'], lenses_and_measurements: ['optical', 'Ochelari și lentile'],
  technical_activities: ['repair', 'Reparații ochelari'], contact_lenses: ['contact', 'Lentile de contact'],
  optometry: ['vision', 'Control de vedere'],
  ophthalmology_consults: ['medical', 'Consultații oftalmologice'], investigations: ['medical', 'Consultații oftalmologice'],
  specialties: ['medical', 'Consultații oftalmologice'], procedures_surgery: ['medical', 'Consultații oftalmologice'],
  children_and_prevention: ['medical', 'Consultații oftalmologice'],
};
export function localInterestService(key) {
  const normalized = normalizeServiceKey(String(key || ''));
  const group = GROUPS[normalized.definition?.group];
  return normalized.canonicalKey && group ? { key: normalized.canonicalKey, group: group[0], label: group[1] } : null;
}
export function completedInterestWindows(now = Date.now()) {
  const end = Math.floor(now / DAY) * DAY;
  const weekday = new Date(end).getUTCDay();
  const weekEnd = end - ((weekday + 6) % 7) * DAY;
  return { end, start: end - 90 * DAY, weekStart: weekEnd - 7 * DAY, weekEnd };
}
function metric(rows, start, end) {
  const period = rows.filter(row => row.time >= start && row.time < end);
  const sessions = new Set(period.map(row => row.session));
  return { rows: period, publishable: sessions.size >= LOCAL_INTEREST_MIN_SESSIONS, total: period.length };
}
function publicMetric(value, days) {
  return { days, status: value.publishable ? 'available' : 'insufficient', total: value.publishable ? value.total : null };
}
/** @param {{ events?: Array<Record<string, any>>, location?: { county_name?: string, county?: string, locality_siruta_code?: string, locality_name?: string, city?: string }, services?: Array<Record<string, any>>, planCode?: string, now?: number, complete?: boolean }} input */
export function buildLocalInterest({ events = [], location = {}, services = [], planCode = 'free', now = Date.now(), complete = true }) {
  const windows = completedInterestWindows(now);
  const allowed = new Set(services.filter(row => row.is_active === true && row.matching_allowed === true && row.accepts_requests !== false
    && !['provider_suspended', 'removal_pending'].includes(row.provider_visibility_status)).map(row => localInterestService(row.service_key)?.key).filter(Boolean));
  const county = localAreaKey(location.county_name || location.county);
  const locality = String(location.locality_siruta_code || '');
  const dedup = new Map();
  for (const event of events) {
    const time = Date.parse(event.created_date);
    const service = localInterestService(event.service_key);
    if (event.analytics_version !== LOCAL_INTEREST_VERSION || event.analytics_eligible !== true || !service || !allowed.has(service.key)
      || !county || event.county_key !== county || !/^[a-zA-Z0-9-]{16,64}$/.test(event.session_hash || '')
      || !Number.isFinite(time) || time < windows.start || time >= windows.end) continue;
    const key = [event.session_hash, Math.floor(time / DAY), service.key, event.locality_siruta_code].join(':');
    const candidate = { time, session: event.session_hash, service, locality: event.locality_siruta_code };
    const previous = dedup.get(key);
    if (!previous || time < previous.time) dedup.set(key, candidate);
  }
  const countyRows = [...dedup.values()];
  const localRows = locality ? countyRows.filter(row => row.locality === locality) : [];
  const useLocal = metric(localRows, windows.end - 7 * DAY, windows.end).publishable;
  const rows = useLocal ? localRows : countyRows;
  const ready = complete && allowed.size > 0 && Boolean(county);
  const metrics = (planCode === 'pro' ? [7, 30, 90] : [7]).map(days => publicMetric(metric(ready ? rows : [], windows.end - days * DAY, windows.end), days));
  const breakdown = [];
  if (ready && planCode === 'pro') {
    const thirty = metric(rows, windows.end - 30 * DAY, windows.end);
    const groups = new Map();
    for (const row of thirty.rows) {
      if (!groups.has(row.service.group)) groups.set(row.service.group, []);
      groups.get(row.service.group).push(row);
    }
    const cells = [...groups.values()].map(groupRows => ({ groupRows, value: metric(groupRows, windows.end - 30 * DAY, windows.end) }));
    // Suppress the entire breakdown if a small complementary cell could be inferred.
    if (thirty.publishable && cells.every(cell => cell.value.publishable)) {
      for (const cell of cells) breakdown.push({ key: cell.groupRows[0].service.group, label: cell.groupRows[0].service.label, total: cell.value.total });
    }
  }
  const current = metric(rows, windows.end - 7 * DAY, windows.end);
  const previous = metric(rows, windows.end - 14 * DAY, windows.end - 7 * DAY);
  const weekly = metric(rows, windows.weekStart, windows.weekEnd);
  return {
    contract_version: LOCAL_INTEREST_VERSION,
    status: !complete ? 'incomplete' : !county ? 'missing_area' : allowed.size === 0 ? 'missing_services' : 'ready',
    plan_code: planCode === 'pro' ? 'pro' : 'free',
    area_scope: useLocal ? 'locality' : 'county',
    area_label: useLocal ? String(location.locality_name || location.city || '') : String(location.county_name || location.county || ''),
    period_end: new Date(windows.end).toISOString(), metrics, breakdown,
    comparison: ready && planCode === 'pro' && current.publishable && previous.publishable ? { current: current.total, previous: previous.total } : null,
    weekly: { start: new Date(windows.weekStart).toISOString(), end: new Date(windows.weekEnd).toISOString(), total: ready && weekly.publishable ? weekly.total : null },
  };
}
export function deduplicateActivityNotifications(rows) {
  const groups = new Map();
  const result = [];
  for (const row of rows) {
    if (row.event_key !== 'provider_local_interest_weekly' || !row.idempotency_key) { result.push(row); continue; }
    const key = row.idempotency_key;
    const previous = groups.get(key);
    if (!previous) groups.set(key, { ...row });
    else {
      const first = String(row.created_date || '').localeCompare(String(previous.created_date || '')) < 0 ? row : previous;
      groups.set(key, { ...first, status: row.status === 'read' || previous.status === 'read' ? 'read' : 'unread' });
    }
  }
  return [...result, ...groups.values()].sort((a, b) => String(b.created_date || '').localeCompare(String(a.created_date || '')));
}
