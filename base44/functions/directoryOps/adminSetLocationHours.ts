import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  formatProviderSaturdayHours,
  formatProviderWeeklyHours,
  validateProviderOpeningHours,
} from '../../shared/providerOpeningHours.js';

// Editare rapida de admin pentru orarul structurat pe zile, pe orice locatie din
// director. Spre deosebire de saveProviderRoutineProfile (folosita de furnizori in
// workspace-ul propriu), aceasta functie e exclusiv admin si NU cere
// ProviderMembership - un admin nu are membership pe cele ~1300 de locatii importate,
// dar tot trebuie sa poata corecta orarul cand gaseste o informatie corecta.
// Refoloseste exact aceeasi validare si formatare ca fluxul de furnizor, ca cele doua
// campuri text si JSON sa ramana mereu consistente intre ele.

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Doar administratorii pot folosi acest update rapid.' }, { status: 403 });
    const svc = base44.asServiceRole;

    const p = await req.json().catch(() => ({}));
    const locationId = String(p.location_id || '').trim();
    if (!locationId) return Response.json({ error: 'location_id este obligatoriu' }, { status: 400 });

    const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
    if (!location) return Response.json({ error: 'Locatia nu a fost gasita' }, { status: 404 });
    if (location.profile_control_status === 'suspended' || location.status === 'suspendata') {
      return Response.json({ error: 'Profilul este suspendat si nu poate fi modificat' }, { status: 403 });
    }

    const checked = validateProviderOpeningHours({ weekly: p.weekly, exceptions: p.exceptions });
    if (!checked.valid) {
      return Response.json({ error: checked.error, fields: checked.fields || [] }, { status: 400 });
    }

    const updates = {
      opening_hours_json: JSON.stringify(checked.value),
      opening_hours: formatProviderWeeklyHours(checked.value.weekly),
      saturday_hours: formatProviderSaturdayHours(checked.value.weekly),
    };

    const previous = {
      opening_hours_json: location.opening_hours_json || '',
      opening_hours: location.opening_hours || '',
      saturday_hours: location.saturday_hours || '',
    };

    await svc.entities.ProviderLocation.update(location.id, updates);
    await svc.entities.DirectoryAuditRecord.create({
      entity_type: 'ProviderLocation',
      entity_id: location.id,
      action_type: 'admin_set_location_hours',
      changed_fields: Object.keys(updates),
      previous_values: JSON.stringify(previous),
      new_values: JSON.stringify(updates),
      admin_user_id: user.id,
      admin_email: user.email,
      note: p.note || 'Orar setat manual de admin',
      performed_at: new Date().toISOString(),
    });

    return Response.json({ success: true, updates });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
