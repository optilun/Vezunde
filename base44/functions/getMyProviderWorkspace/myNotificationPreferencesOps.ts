import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { canReceiveProviderLeadEmail } from '../../shared/communicationEventCatalog.js';
import { getManyByIds } from '../../shared/providerWorkspaceBatchQueries.js';
import { readLeadEmailPreferences, saveLeadEmailPreference } from '../../shared/providerLeadEmailPreference.js';

// 2026-10-09 (audit Setări, S5; Alex: „Fiecare își alege”). Setările contului → „Notificări pe email”:
// fiecare proprietar sau manager alege, pentru el, dacă primește email la cererile noi ale fiecărei
// locații. Implicit pornit. Lista conține doar locațiile la care utilizatorul primește deja aceste
// emailuri (aceeași regulă de rol ca trimiterea: canReceiveProviderLeadEmail).

export const MY_NOTIFICATION_PREFERENCES_CONTRACT_VERSION = 'my-notification-preferences-v1';

function clean(value, maxLength = 120) {
  return String(value ?? '').trim().slice(0, maxLength);
}

const ROLE_LABELS: Record<string, string> = { organization_owner: 'Proprietar', location_manager: 'Manager' };

async function eligibleMemberships(svc, userId) {
  const rows = await svc.entities.ProviderMembership.filter({ user_id: userId, status: 'active' }, '-created_date', 500);
  const byLocation = new Map();
  for (const row of rows || []) {
    const locationId = clean(row?.location_id);
    if (!locationId || !canReceiveProviderLeadEmail(row.role)) continue;
    if (!byLocation.has(locationId)) byLocation.set(locationId, row);
  }
  return byLocation;
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Autentificare necesară' }, { status: 401 });
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const action = clean(input.action || 'list', 40);
    const memberships = await eligibleMemberships(svc, user.id);

    if (action === 'list') {
      const locationIds = [...memberships.keys()];
      const [locations, preferences] = await Promise.all([
        getManyByIds(svc.entities.ProviderLocation, locationIds),
        readLeadEmailPreferences(svc, user.id, locationIds),
      ]);
      const items = locationIds
        .map((locationId) => {
          const location = locations.get(locationId) || null;
          if (!location) return null;
          return {
            location_id: locationId,
            location_name: location.public_display_name || location.name || 'Locație',
            city: location.locality_name || location.city || '',
            role_label: ROLE_LABELS[clean(memberships.get(locationId)?.role, 80)] || '',
            lead_email_enabled: preferences.get(locationId) !== false,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.location_name.localeCompare(b.location_name, 'ro'));
      return Response.json({ contract_version: MY_NOTIFICATION_PREFERENCES_CONTRACT_VERSION, items });
    }

    if (action === 'set') {
      const locationId = clean(input.location_id);
      if (!memberships.has(locationId)) return Response.json({ error: 'Nu primești emailuri pentru această locație.' }, { status: 403 });
      if (typeof input.lead_email_enabled !== 'boolean') return Response.json({ error: 'Alege dacă vrei emailul pornit sau oprit.' }, { status: 400 });
      const saved = await saveLeadEmailPreference(svc, user.id, locationId, input.lead_email_enabled);
      return Response.json({ contract_version: MY_NOTIFICATION_PREFERENCES_CONTRACT_VERSION, location_id: locationId, ...saved });
    }

    return Response.json({ error: 'Acțiune necunoscută.' }, { status: 400 });
  } catch (_error) {
    return Response.json({ error: 'Preferințele de notificare nu au putut fi încărcate. Încearcă din nou.' }, { status: 500 });
  }
}
