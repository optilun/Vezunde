import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { findProviderLeadLocationMembership } from '../../shared/providerLeadLocationAccess.js';
import {
  PROVIDER_REQUEST_INTAKE_CONTRACT_VERSION,
  buildRequestIntakeReadiness,
  canManageRequestIntake,
  isRequestIntakeEnabled,
  requestIntakeUpdate,
} from '../../shared/providerRequestIntake.js';

// 2026-10-09 (audit Top 3, T1; Alex: „1 + 2 + 3 întâi”). Setări → Plan și acces → „Primesc cereri
// de la clienți”. Oricine are acces la Cererile locației vede starea; doar proprietarul sau
// managerul o schimbă. Nu atinge potrivirea, clasamentul sau Top 3: decide doar dacă locația
// poate fi printre destinatarii unei cereri, cu aceleași reguli de eligibilitate ca până acum.

function clean(value, maxLength = 120) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function payload(location, services, canManage) {
  return {
    contract_version: PROVIDER_REQUEST_INTAKE_CONTRACT_VERSION,
    location_id: location.id,
    enabled: isRequestIntakeEnabled(location),
    request_intake_status: clean(location.request_intake_status, 40) || 'inactive',
    accepts_patients_directly: location.accepts_patients_directly === true,
    can_manage: canManage,
    // Cine vede pagina are acces la Cereri, deci locația are cel puțin un membru activ.
    readiness: buildRequestIntakeReadiness({ location, services, hasActiveMember: true }),
  };
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Autentificare necesară.' }, { status: 401 });
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const action = clean(input.action || 'get', 40);
    const locationId = clean(input.location_id);
    if (!locationId) return Response.json({ error: 'Alege o locație.' }, { status: 400 });

    const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
    if (!location) return Response.json({ error: 'Locația nu a fost găsită.' }, { status: 404 });
    const membership = await findProviderLeadLocationMembership(svc, user, location);
    if (!membership) return Response.json({ error: 'Nu ai acces la cererile acestei locații.' }, { status: 403 });
    const canManage = canManageRequestIntake(membership.role);

    if (action === 'get') {
      const services = await svc.entities.LocationService.filter({ location_id: location.id }, null, 500);
      return Response.json(payload(location, services, canManage));
    }

    if (action !== 'set') return Response.json({ error: 'Acțiune necunoscută.' }, { status: 400 });
    if (!canManage) {
      return Response.json({ error: 'Doar proprietarul sau managerul locației poate porni sau opri primirea cererilor.' }, { status: 403 });
    }
    if (typeof input.enabled !== 'boolean') {
      return Response.json({ error: 'Alege dacă locația primește cereri sau nu.' }, { status: 400 });
    }
    if (location.profile_control_status === 'suspended' || location.status === 'suspendata') {
      return Response.json({ error: 'Profilul locației este suspendat.' }, { status: 409 });
    }
    if (input.enabled && !['claimed', 'verified'].includes(clean(location.profile_control_status, 40))) {
      return Response.json({ error: 'Primirea cererilor se poate porni după ce profilul este revendicat.' }, { status: 409 });
    }

    const updates = requestIntakeUpdate(input.enabled);
    const previous = {
      request_intake_status: location.request_intake_status ?? null,
      accepts_patients_directly: location.accepts_patients_directly ?? null,
    };
    const changed = previous.request_intake_status !== updates.request_intake_status
      || previous.accepts_patients_directly !== updates.accepts_patients_directly;
    if (changed) {
      await svc.entities.ProviderLocation.update(location.id, updates);
      await svc.entities.DirectoryAuditRecord.create({
        entity_type: 'ProviderLocation',
        entity_id: location.id,
        action_type: 'provider_request_intake_update',
        changed_fields: Object.keys(updates),
        previous_values: JSON.stringify(previous),
        new_values: JSON.stringify(updates),
        admin_user_id: user.id,
        admin_email: user.email || '',
        note: input.enabled ? 'Furnizorul a pornit primirea cererilor.' : 'Furnizorul a oprit primirea cererilor.',
        performed_at: new Date().toISOString(),
      }).catch(() => null);
    }

    const services = await svc.entities.LocationService.filter({ location_id: location.id }, null, 500);
    return Response.json(payload({ ...location, ...updates }, services, canManage));
  } catch (_error) {
    return Response.json({ error: 'Primirea cererilor nu a putut fi actualizată. Încearcă din nou.' }, { status: 500 });
  }
}
