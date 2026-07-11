import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  getCanonicalServiceDefinition,
  isServiceMatchingEligible,
  normalizeServiceKey,
} from '../../../shared/canonicalServiceRegistryExtended.js';

const APPLY_CONFIRMATION = 'APPLY_MATCHING_BACKFILL';

function cleanString(value) {
  return String(value || '').trim();
}

function proposedMatchingState(service, location) {
  const normalized = normalizeServiceKey(service?.service_key);
  const definition = normalized.definition;
  const level = definition?.service_need_level || 'unknown';

  if (service?.is_active === false) {
    return { proposed: false, level, catalog_status: normalized.status, reason: 'Serviciul este inactiv.' };
  }
  if (service?.migration_review_required === true) {
    return { proposed: false, level, catalog_status: normalized.status, reason: 'Serviciul necesita verificarea migrarii.' };
  }
  if (!definition) {
    return { proposed: false, level: 'unknown', catalog_status: normalized.status, reason: 'Serviciul nu are o clasificare canonica sigura.' };
  }

  const proposed = isServiceMatchingEligible(service, location);
  if (definition.requires_review || level === 'specialized_medical') {
    if (location?.profile_control_status !== 'verified') {
      return { proposed: false, level, catalog_status: normalized.status, reason: 'Locatia nu este verificata Vezunde pentru servicii medicale.' };
    }
    if (service?.confirmation_level !== 'vezunde_verified') {
      return { proposed: false, level, catalog_status: normalized.status, reason: 'Serviciul medical nu este verificat individual de Vezunde.' };
    }
    return { proposed, level, catalog_status: normalized.status, reason: 'Serviciu medical verificat la o locatie verificata.' };
  }

  if (!proposed) {
    return { proposed: false, level, catalog_status: normalized.status, reason: 'Serviciul nu indeplineste regula canonica de publicare si matching.' };
  }
  return {
    proposed: true,
    level,
    catalog_status: normalized.status,
    reason: level === 'technical'
      ? 'Serviciu tehnic activ si confirmat conform registrului canonic.'
      : 'Serviciu general activ si confirmat conform registrului canonic.',
  };
}

async function createAuditRecord(svc, user, service, location, previousValue, nextValue, reason) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: 'LocationService',
    entity_id: service.id,
    action_type: 'backfill_matching_allowed',
    changed_fields: ['matching_allowed'],
    previous_values: JSON.stringify({ matching_allowed: previousValue }),
    new_values: JSON.stringify({ matching_allowed: nextValue }),
    admin_user_id: user.id,
    admin_email: user.email,
    note: `Backfill controlat pentru ${service.service_key} la locatia ${location.id}. ${reason}`,
    performed_at: new Date().toISOString(),
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Doar administratorii Vezunde pot rula acest instrument' }, { status: 403 });

    const payload = await req.json().catch(() => ({}));
    const action = cleanString(payload.action || 'dry_run');
    if (!['dry_run', 'apply'].includes(action)) {
      return Response.json({ error: 'Actiune invalida' }, { status: 400 });
    }

    const locationId = cleanString(payload.location_id);
    if (!locationId) return Response.json({ error: 'location_id este obligatoriu' }, { status: 400 });

    const svc = base44.asServiceRole;
    const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
    if (!location) return Response.json({ error: 'Locatia nu a fost gasita' }, { status: 404 });

    const services = await svc.entities.LocationService.filter({ location_id: locationId }, 'service_key', 500);
    const rows = services.map((service) => {
      const decision = proposedMatchingState(service, location);
      const previous = service.matching_allowed === true;
      const definition = getCanonicalServiceDefinition(service.service_key);
      return {
        id: service.id,
        location_id: locationId,
        service_key: cleanString(service.service_key),
        canonical_key: normalizeServiceKey(service.service_key).canonicalKey,
        canonical_label: definition?.label || null,
        catalog_status: decision.catalog_status,
        service_need_level: decision.level,
        confirmation_level: cleanString(service.confirmation_level) || 'not_confirmed',
        location_profile_control_status: cleanString(location.profile_control_status) || 'directory',
        matching_allowed_old: previous,
        matching_allowed_proposed: decision.proposed,
        change_required: previous !== decision.proposed,
        reason: decision.reason,
      };
    });

    const changes = rows.filter((row) => row.change_required);
    const summary = {
      total_services: rows.length,
      changes_required: changes.length,
      enable_count: changes.filter((row) => row.matching_allowed_proposed).length,
      disable_count: changes.filter((row) => !row.matching_allowed_proposed).length,
      unchanged_count: rows.length - changes.length,
      unknown_or_ambiguous_count: rows.filter((row) => !['canonical', 'legacy_mapped'].includes(row.catalog_status)).length,
    };

    if (action === 'dry_run') {
      return Response.json({ mode: 'dry_run', location_id: locationId, summary, rows });
    }

    if (cleanString(payload.confirm) !== APPLY_CONFIRMATION) {
      return Response.json({ error: 'Confirmarea pentru aplicare este invalida' }, { status: 400 });
    }

    const expectedChangeCount = Number(payload.expected_change_count);
    if (!Number.isInteger(expectedChangeCount) || expectedChangeCount !== changes.length) {
      return Response.json({
        error: 'Datele s-au schimbat dupa dry-run. Ruleaza din nou verificarea inainte de aplicare.',
        expected_change_count: changes.length,
      }, { status: 409 });
    }

    for (const row of changes) {
      const service = services.find((item) => item.id === row.id);
      if (!service) continue;
      await svc.entities.LocationService.update(service.id, {
        matching_allowed: row.matching_allowed_proposed,
      });
      await createAuditRecord(
        svc,
        user,
        service,
        location,
        row.matching_allowed_old,
        row.matching_allowed_proposed,
        row.reason,
      );
    }

    return Response.json({
      mode: 'apply',
      location_id: locationId,
      applied_count: changes.length,
      summary,
      rows,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Eroare neasteptata' }, { status: 500 });
  }
});
