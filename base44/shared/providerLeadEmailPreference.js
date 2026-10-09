// Emailul la cereri noi, ales de fiecare utilizator pentru fiecare locație (2026-10-09, audit Setări, S5).
//
// Alex: „Fiecare își alege”. Proprietarii și managerii unei locații primesc implicit email la fiecare
// cerere nouă (ca până acum). Fiecare îl poate opri pentru el, pe fiecare locație. Notificarea din
// aplicație rămâne. Preferința stă în ProviderActivityPreference (aceeași entitate ca rezumatul
// săptămânal), în câmpul `lead_email_enabled`; lipsa câmpului sau a rândului înseamnă „pornit”.
// Nu schimbă cine primește cererea, potrivirea, Top 3 sau distribuirea.

function clean(value, maxLength = 160) {
  return String(value ?? '').trim().slice(0, maxLength);
}

// Utilizatorii care au oprit emailul pentru locație. Rândul cel mai nou al fiecăruia decide.
export async function usersWithLeadEmailOff(svc, locationId) {
  const id = clean(locationId);
  if (!id || !svc?.entities?.ProviderActivityPreference) return new Set();
  const rows = await svc.entities.ProviderActivityPreference.filter({ location_id: id }, '-updated_date', 500).catch(() => []);
  const seen = new Set();
  const off = new Set();
  for (const row of rows || []) {
    const userId = clean(row?.user_id);
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    if (row.lead_email_enabled === false) off.add(userId);
  }
  return off;
}

export async function readLeadEmailPreferences(svc, userId, locationIds = []) {
  const wanted = new Set(locationIds.map((id) => clean(id)).filter(Boolean));
  const result = new Map([...wanted].map((id) => [id, true]));
  if (!wanted.size) return result;
  const rows = await svc.entities.ProviderActivityPreference.filter({ user_id: clean(userId) }, '-updated_date', 500).catch(() => []);
  const seen = new Set();
  for (const row of rows || []) {
    const locationId = clean(row?.location_id);
    if (!wanted.has(locationId) || seen.has(locationId)) continue;
    seen.add(locationId);
    result.set(locationId, row.lead_email_enabled !== false);
  }
  return result;
}

// Păstrează `weekly_enabled` (rezumatul săptămânal, altă setare) neatins.
export async function saveLeadEmailPreference(svc, userId, locationId, enabled) {
  if (typeof enabled !== 'boolean') throw new Error('invalid_preference');
  const rows = await svc.entities.ProviderActivityPreference.filter({ user_id: clean(userId), location_id: clean(locationId) }, '-updated_date', 100);
  if (rows.length) await Promise.all(rows.map((row) => svc.entities.ProviderActivityPreference.update(row.id, { lead_email_enabled: enabled })));
  else await svc.entities.ProviderActivityPreference.create({ user_id: clean(userId), location_id: clean(locationId), weekly_enabled: true, lead_email_enabled: enabled });
  return { lead_email_enabled: enabled };
}
