import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  formatProviderSaturdayHours,
  formatProviderWeeklyHours,
  validateProviderOpeningHours,
} from '../../../shared/providerOpeningHours.js';

const MEMBER_ROLES = ['organization_owner', 'location_manager', 'location_staff'];
const MAX_TARGETS = 50;

function reject(error, status = 400, details = {}) {
  return Response.json({ error, ...details }, { status });
}

function normalizeMemberRole(role) {
  if (role === 'owner') return 'organization_owner';
  if (role === 'staff') return 'location_staff';
  return MEMBER_ROLES.includes(role) ? role : '';
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseOpeningHours(raw) {
  const value = String(raw || '').trim();
  if (!value) return { error: 'Locatia sursa nu are un program configurat.' };
  if (value.length > 12000) return { error: 'Programul sursa depaseste dimensiunea permisa.' };
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (_error) {
    return { error: 'Programul sursa nu este JSON valid.' };
  }
  const checked = validateProviderOpeningHours(parsed);
  if (!checked.valid) return { error: checked.error, fields: checked.fields || [] };
  return {
    value: checked.value,
    opening_hours_json: JSON.stringify(checked.value),
    opening_hours: formatProviderWeeklyHours(checked.value.weekly),
    saturday_hours: formatProviderSaturdayHours(checked.value.weekly),
  };
}

async function activeMembershipsForUser(svc, userId) {
  const memberships = await svc.entities.ProviderMembership.filter({ user_id: userId, status: 'active' }, '-created_date', 1000);
  return memberships.filter((membership) => normalizeMemberRole(membership.role));
}

function canManageLocation(memberships, locationId) {
  return memberships.some((membership) => membership.location_id === locationId && normalizeMemberRole(membership.role));
}

function locationLabel(location) {
  return location.public_display_name || location.name || 'Locatie';
}

function locationPlace(location) {
  return location.locality_name || location.city || '';
}

function isEligibleLocation(location) {
  return Boolean(
    location &&
      location.profile_control_status !== 'suspended' &&
      location.status !== 'suspendata' &&
      location.claim_verification_status === 'approved',
  );
}

function hasExistingSchedule(location) {
  return Boolean(String(location.opening_hours_json || '').trim() || String(location.opening_hours || '').trim());
}

function auditNote(operationId, sourceId) {
  return `copy_operation:${operationId};source:${sourceId}`;
}

async function findOperationAudit(svc, locationId, operationId, sourceId) {
  const rows = await svc.entities.DirectoryAuditRecord.filter({
    entity_type: 'ProviderLocation',
    entity_id: locationId,
    action_type: 'provider_copy_opening_hours',
    note: auditNote(operationId, sourceId),
  }, '-performed_at', 1).catch(() => []);
  return rows[0] || null;
}

async function createAudit(svc, user, location, source, previous, next, operationId) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: 'ProviderLocation',
    entity_id: location.id,
    action_type: 'provider_copy_opening_hours',
    changed_fields: ['opening_hours_json', 'opening_hours', 'saturday_hours'],
    previous_values: JSON.stringify(previous),
    new_values: JSON.stringify(next),
    admin_user_id: user.id,
    admin_email: user.email,
    note: auditNote(operationId, source.id),
    performed_at: new Date().toISOString(),
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return reject('Autentificare necesara', 401);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action || 'preview').trim();
    const sourceId = String(payload.source_location_id || '').trim();
    const targetIds = unique(Array.isArray(payload.target_location_ids) ? payload.target_location_ids.map((value) => String(value || '').trim()) : []);

    if (!['preview', 'copy'].includes(action)) return reject('Actiune invalida.');
    if (!sourceId) return reject('Selecteaza locatia sursa.');
    if (targetIds.length === 0) return reject('Selecteaza cel putin o locatie tinta.');
    if (targetIds.length > MAX_TARGETS) return reject(`Poti selecta maximum ${MAX_TARGETS} de locatii tinta.`);
    if (targetIds.includes(sourceId)) return reject('Locatia sursa nu poate fi selectata ca destinatie.');

    const memberships = await activeMembershipsForUser(svc, user.id);
    if (!canManageLocation(memberships, sourceId)) return reject('Nu ai permisiunea necesara pentru locatia sursa.', 403);
    const inaccessibleTargetIds = targetIds.filter((locationId) => !canManageLocation(memberships, locationId));
    if (inaccessibleTargetIds.length > 0) return reject('Nu ai permisiunea necesara pentru toate locatiile tinta.', 403, { location_ids: inaccessibleTargetIds });

    const source = await svc.entities.ProviderLocation.get(sourceId).catch(() => null);
    if (!source || !isEligibleLocation(source)) return reject('Locatia sursa nu este eligibila.', 403);
    const targets = [];
    for (const targetId of targetIds) {
      const target = await svc.entities.ProviderLocation.get(targetId).catch(() => null);
      if (!target) return reject('Una dintre locatiile tinta nu a fost gasita.', 404, { location_id: targetId });
      targets.push(target);
    }

    const invalidOrganizationTargets = targets.filter((target) => target.organization_id !== source.organization_id);
    if (invalidOrganizationTargets.length > 0) {
      return reject('Programul poate fi copiat numai intre locatii din aceeasi organizatie.', 403, {
        location_ids: invalidOrganizationTargets.map((target) => target.id),
      });
    }
    const ineligibleTargets = targets.filter((target) => !isEligibleLocation(target));
    if (ineligibleTargets.length > 0) {
      return reject('Una dintre locatiile tinta nu este aprobata sau este suspendata.', 403, {
        location_ids: ineligibleTargets.map((target) => target.id),
      });
    }

    const schedule = parseOpeningHours(source.opening_hours_json);
    if (schedule.error) return reject(schedule.error, 400, { fields: schedule.fields || [] });

    const preview = {
      source: {
        id: source.id,
        name: locationLabel(source),
        locality: locationPlace(source),
        opening_hours: schedule.opening_hours,
        weekly: schedule.value.weekly,
        exceptions: schedule.value.exceptions,
      },
      targets: targets.map((target) => ({
        id: target.id,
        name: locationLabel(target),
        locality: locationPlace(target),
        has_existing_schedule: hasExistingSchedule(target),
        current_opening_hours: target.opening_hours || '',
      })),
    };

    if (action === 'preview') return Response.json({ success: true, preview });

    const targetsWithSchedule = targets.filter(hasExistingSchedule);
    if (targetsWithSchedule.length > 0 && payload.confirm_replace_existing !== true) {
      return reject('Confirma inlocuirea programului existent pentru locatiile indicate.', 409, {
        confirmation_required: true,
        location_ids: targetsWithSchedule.map((target) => target.id),
        preview,
      });
    }

    const operationId = String(payload.operation_id || '').trim();
    if (!/^[a-zA-Z0-9_-]{12,100}$/.test(operationId)) return reject('Identificatorul operatiei este invalid. Reincarca preview-ul si incearca din nou.');

    const next = {
      opening_hours_json: schedule.opening_hours_json,
      opening_hours: schedule.opening_hours,
      saturday_hours: schedule.saturday_hours,
    };
    const results = [];
    for (const target of targets) {
      const previous = {
        opening_hours_json: target.opening_hours_json || '',
        opening_hours: target.opening_hours || '',
        saturday_hours: target.saturday_hours || '',
      };
      try {
        const existingAudit = await findOperationAudit(svc, target.id, operationId, source.id);
        if (existingAudit) {
          results.push({ location_id: target.id, name: locationLabel(target), status: 'duplicate_skipped' });
          continue;
        }
        await svc.entities.ProviderLocation.update(target.id, next);
        try {
          await createAudit(svc, user, target, source, previous, next, operationId);
        } catch (auditError) {
          await svc.entities.ProviderLocation.update(target.id, previous).catch(() => null);
          throw new Error(`Auditul nu a putut fi salvat: ${auditError.message}`);
        }
        results.push({ location_id: target.id, name: locationLabel(target), status: 'success' });
      } catch (error) {
        results.push({ location_id: target.id, name: locationLabel(target), status: 'error', error: error.message });
      }
    }

    const successCount = results.filter((result) => result.status === 'success').length;
    const duplicateCount = results.filter((result) => result.status === 'duplicate_skipped').length;
    const errorCount = results.filter((result) => result.status === 'error').length;
    return Response.json({
      success: errorCount === 0,
      partial_success: successCount + duplicateCount > 0 && errorCount > 0,
      operation_id: operationId,
      summary: { success_count: successCount, duplicate_count: duplicateCount, error_count: errorCount },
      results,
    }, { status: errorCount > 0 && successCount + duplicateCount === 0 ? 500 : 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
