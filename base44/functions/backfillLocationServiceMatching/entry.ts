import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const APPLY_CONFIRMATION = 'APPLY_MATCHING_BACKFILL';
const ELIGIBLE_CONFIRMATIONS = ['provider_confirmed', 'vezunde_verified'];

function cleanString(value) {
  return String(value || '').trim();
}

function classifyProposal(service, location) {
  const level = cleanString(service.service_need_level) || 'unknown';
  const confirmationLevel = cleanString(service.confirmation_level) || 'not_confirmed';
  const profileControlStatus = cleanString(location?.profile_control_status) || 'directory';
  const advanced = service.is_advanced_service === true || level === 'specialized_medical';

  if (service.is_active === false) {
    return { proposed: false, reason: 'Serviciu inactiv' };
  }
  if (service.migration_review_required === true) {
    return { proposed: false, reason: 'Necesita review de migrare' };
  }
  if (!ELIGIBLE_CONFIRMATIONS.includes(confirmationLevel)) {
    return { proposed: false, reason: 'Serviciul nu este confirmat de furnizor sau verificat Vezunde' };
  }
  if ((level === 'general' || level === 'technical') && !advanced) {
    return { proposed: true, reason: 'Serviciu general sau tehnic confirmat' };
  }
  if (advanced) {
    if (confirmationLevel === 'vezunde_verified' && profileControlStatus === 'verified') {
      return { proposed: true, reason: 'Serviciu medical verificat de Vezunde intr-o locatie verificata' };
    }
    return { proposed: false, reason: 'Serviciul medical necesita verificare Vezunde' };
  }
  return { proposed: false, reason: 'Serviciu necunoscut sau neclasificat' };
}

async function audit(svc, user, service, previousValue, nextValue, reason) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: 'LocationService',
    entity_id: service.id,
    action_type: 'backfill_matching_allowed',
    changed_fields: ['matching_allowed'],
    previous_values: JSON.stringify({ matching_allowed: previousValue }),
    new_values: JSON.stringify({ matching_allowed: nextValue }),
    admin_user_id: user.id,
    admin_email: user.email,
    note: reason,
    performed_at: new Date().toISOString(),
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acces interzis: doar administratori' }, { status: 403 });

    const payload = await req.json().catch(() => ({}));
    const action = cleanString(payload.action) || 'dry_run';
    const locationId = cleanString(payload.location_id);

    if (!['dry_run', 'apply'].includes(action)) {
      return Response.json({ error: 'Actiune invalida' }, { status: 400 });
    }
    if (action === 'apply' && !locationId) {
      return Response.json({ error: 'location_id este obligatoriu pentru apply' }, { status: 400 });
    }
    if (action === 'apply' && payload.confirm !== APPLY_CONFIRMATION) {
      return Response.json({ error: 'Confirmare invalida pentru apply' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const query = locationId
      ? { location_id: locationId, matching_allowed: false }
      : { matching_allowed: false };
    const services = await svc.entities.LocationService.filter(query, 'service_key', 500);
    const locationCache = new Map();
    const report = [];

    for (const service of services) {
      let location = locationCache.get(service.location_id);
      if (location === undefined) {
        location = await svc.entities.ProviderLocation.get(service.location_id).catch(() => null);
        locationCache.set(service.location_id, location);
      }

      const proposal = classifyProposal(service, location);
      report.push({
        id: service.id,
        location_id: service.location_id,
        service_key: cleanString(service.service_key),
        service_need_level: cleanString(service.service_need_level) || 'unknown',
        confirmation_level: cleanString(service.confirmation_level) || 'not_confirmed',
        location_profile_control_status: cleanString(location?.profile_control_status) || 'missing',
        old_matching_allowed: service.matching_allowed === true,
        proposed_matching_allowed: proposal.proposed,
        reason: proposal.reason,
      });
    }

    const proposedChanges = report.filter((item) => item.old_matching_allowed !== item.proposed_matching_allowed);
    const applied = [];

    if (action === 'apply') {
      for (const item of proposedChanges) {
        const service = services.find((row) => row.id === item.id);
        if (!service) continue;
        await svc.entities.LocationService.update(service.id, { matching_allowed: item.proposed_matching_allowed });
        await audit(
          svc,
          user,
          service,
          item.old_matching_allowed,
          item.proposed_matching_allowed,
          `Backfill controlat: ${item.reason}`,
        );
        applied.push(item.id);
      }
    }

    return Response.json({
      action,
      location_id: locationId || null,
      scanned_count: report.length,
      proposed_change_count: proposedChanges.length,
      applied_count: applied.length,
      report,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Eroare neasteptata' }, { status: 500 });
  }
});
