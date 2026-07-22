import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  allowedRolesForClaimScope,
  isApprovedRoleAllowed,
  uniqueClaimLocationIds,
} from '../../shared/providerClaimScopePolicy.js';

const REVIEWABLE_STATUSES = new Set(['in_asteptare', 'needs_more_info']);
const CONTROLLED_PROFILE_STATUSES = new Set(['claimed', 'verified']);

function clean(value, maxLength = 1200) {
  return String(value || '').trim().slice(0, maxLength);
}

function parseJSON(value) {
  try {
    return value ? JSON.parse(value) : {};
  } catch (_error) {
    return {};
  }
}

async function writeAudit(svc, user, claim, actionType, previous, next, note) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: 'ProviderClaimRequest',
    entity_id: claim.id,
    action_type: actionType,
    changed_fields: Object.keys(next || {}),
    previous_values: JSON.stringify(previous || {}),
    new_values: JSON.stringify(next || {}),
    admin_user_id: user.id,
    admin_email: user.email || '',
    note: note || '',
    performed_at: new Date().toISOString(),
  });
}

async function sendClaimEmail(base44, claim, subject, lines) {
  try {
    await base44.integrations.Core.SendEmail({
      to: claim.email,
      from_name: 'VIASEE',
      subject,
      body: [
        'Buna ziua,',
        '',
        ...lines,
        '',
        `Solicitare: ${claim.business_name || claim.id}`,
        '',
        'Echipa VIASEE',
      ].join('\n'),
    });
    return true;
  } catch (_error) {
    return false;
  }
}

async function ensureMembership(svc, values) {
  const existing = await svc.entities.ProviderMembership.filter({
    user_id: values.user_id,
    location_id: values.location_id,
    status: 'active',
  }, '-created_date', 20);
  if (existing[0]) {
    const updates = {};
    if (existing[0].role !== values.role) updates.role = values.role;
    if ((existing[0].organization_id || null) !== (values.organization_id || null)) updates.organization_id = values.organization_id || null;
    if (Object.keys(updates).length > 0) await svc.entities.ProviderMembership.update(existing[0].id, updates);
    return existing[0].id;
  }
  const created = await svc.entities.ProviderMembership.create({
    user_id: values.user_id,
    organization_id: values.organization_id || null,
    location_id: values.location_id,
    role: values.role,
    status: 'active',
  });
  return created.id;
}

async function resetPendingLocationIfUnused(svc, child, claimId) {
  if (child.was_controlled) return;
  const otherPending = await svc.entities.ProviderClaimLocationSelection.filter({
    location_id: child.location_id,
    decision: 'included',
    request_status: 'pending',
    selection_status: 'active',
  }, '-created_date', 100).catch(() => []);
  if (otherPending.some((row) => row.claim_request_id !== claimId)) return;
  const location = await svc.entities.ProviderLocation.get(child.location_id).catch(() => null);
  if (location?.claim_verification_status === 'pending') {
    await svc.entities.ProviderLocation.update(location.id, { claim_verification_status: 'none' });
  }
}

async function promotePreparedDrafts(svc, claim) {
  const drafts = await svc.entities.ProviderWorkspaceSubmission.filter({
    claim_request_id: claim.id,
    submitted_by_user_id: claim.user_id,
    access_origin: 'claim_preparation',
    status: { $in: ['draft', 'needs_more_info'] },
  }, '-created_date', 100).catch(() => []);
  let promoted = 0;
  for (const draft of drafts) {
    if (draft.preparation_locked_at) continue;
    await svc.entities.ProviderWorkspaceSubmission.update(draft.id, { access_origin: 'provider_workspace' });
    promoted += 1;
  }
  return promoted;
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Neautentificat.' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acces interzis.' }, { status: 403 });

    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const claimId = clean(input.claim_id, 160);
    const action = clean(input.action, 40);
    const note = clean(input.note, 1200);
    if (!claimId) return Response.json({ error: 'claim_id este obligatoriu.' }, { status: 400 });

    const claim = await svc.entities.ProviderClaimRequest.get(claimId).catch(() => null);
    if (!claim) return Response.json({ error: 'Solicitarea nu exista.' }, { status: 404 });
    const scopeRows = await svc.entities.ProviderClaimScopeSelection.filter({
      claim_request_id: claimId,
      selection_status: 'active',
    }, '-created_date', 20).catch(() => []);
    const scope = scopeRows[0];
    if (!scope) return Response.json({ error: 'Solicitarea nu are un scope canonic asociat.' }, { status: 409 });
    const children = await svc.entities.ProviderClaimLocationSelection.filter({
      claim_request_id: claimId,
      selection_status: 'active',
    }, 'created_date', 1000).catch(() => []);
    const includedChildren = children.filter((child) => child.decision === 'included');
    if (includedChildren.length === 0) return Response.json({ error: 'Solicitarea nu contine locatii incluse.' }, { status: 409 });

    if (action === 'request_more_info') {
      if (!REVIEWABLE_STATUSES.has(claim.status)) return Response.json({ error: 'Solicitarea nu mai poate cere completari.' }, { status: 409 });
      if (!note) return Response.json({ error: 'Mesajul pentru solicitant este obligatoriu.' }, { status: 400 });
      const now = new Date().toISOString();
      await svc.entities.ProviderClaimRequest.update(claim.id, {
        status: 'needs_more_info',
        reviewed_at: now,
        review_notes: note,
      });
      await svc.entities.ProviderClaimScopeSelection.update(scope.id, {
        review_note: note,
        reviewed_by_user_id: user.id,
        reviewed_at: now,
      });
      const notificationSent = await sendClaimEmail(base44, claim, 'VIASEE - informatii suplimentare necesare', [
        'Pentru a continua verificarea solicitarii avem nevoie de informatii suplimentare.',
        '',
        note,
        '',
        'Poti urmari starea solicitarii din contul tau VIASEE.',
      ]);
      await writeAudit(svc, user, claim, 'request_more_info_provider_scoped_claim', { status: claim.status }, {
        status: 'needs_more_info',
        notification_sent: notificationSent,
      }, note);
      return Response.json({ success: true, status: 'needs_more_info', notification_sent: notificationSent });
    }

    if (action === 'reject') {
      if (!REVIEWABLE_STATUSES.has(claim.status)) return Response.json({ error: 'Solicitarea nu mai poate fi respinsa.' }, { status: 409 });
      if (!note) return Response.json({ error: 'Respingerea necesita o explicatie.' }, { status: 400 });
      const now = new Date().toISOString();
      await svc.entities.ProviderClaimRequest.update(claim.id, {
        status: 'respinsa',
        reviewed_at: now,
        review_notes: note,
      });
      await svc.entities.ProviderClaimScopeSelection.update(scope.id, {
        approval_status: 'rejected',
        approved_location_count: 0,
        review_note: note,
        reviewed_by_user_id: user.id,
        reviewed_at: now,
      });
      for (const child of includedChildren) {
        await svc.entities.ProviderClaimLocationSelection.update(child.id, {
          request_status: 'rejected',
          reviewed_by_user_id: user.id,
          reviewed_at: now,
          review_note: note,
        });
        await resetPendingLocationIfUnused(svc, child, claim.id);
      }
      const notificationSent = await sendClaimEmail(base44, claim, 'VIASEE - solicitare respinsa', [
        'Solicitarea ta nu a putut fi aprobata.',
        '',
        note,
        '',
        'Poti trimite o solicitare noua dupa corectarea informatiilor.',
      ]);
      await writeAudit(svc, user, claim, 'reject_provider_scoped_claim', { status: claim.status }, {
        status: 'respinsa',
        claim_scope: scope.claim_scope,
        rejected_location_count: includedChildren.length,
        notification_sent: notificationSent,
      }, note);
      return Response.json({ success: true, status: 'respinsa', notification_sent: notificationSent });
    }

    if (action !== 'approve') return Response.json({ error: 'Actiune invalida.' }, { status: 400 });
    if (!REVIEWABLE_STATUSES.has(claim.status)) return Response.json({ error: 'Solicitarea nu mai poate fi aprobata.' }, { status: 409 });
    if (!claim.user_id) return Response.json({ error: 'Solicitarea nu are utilizator asociat.' }, { status: 409 });

    const includedIds = includedChildren.map((child) => child.location_id);
    const includedSet = new Set(includedIds);
    const approvedLocationIds = uniqueClaimLocationIds(input.approved_location_ids?.length ? input.approved_location_ids : includedIds);
    if (approvedLocationIds.length === 0) return Response.json({ error: 'Selecteaza cel putin o locatie pentru aprobare.' }, { status: 400 });
    if (approvedLocationIds.some((locationId) => !includedSet.has(locationId))) {
      return Response.json({ error: 'Aprobarea contine o locatie care nu a fost solicitata.' }, { status: 400 });
    }
    if (!approvedLocationIds.includes(scope.primary_location_id)) {
      return Response.json({ error: 'Locatia principala trebuie sa ramana inclusa in aprobarea solicitarii.' }, { status: 400 });
    }

    const approvedRole = clean(input.approved_role || scope.requested_membership_role, 80);
    if (!allowedRolesForClaimScope(scope.claim_scope).includes(approvedRole)
      || !isApprovedRoleAllowed(scope.claim_scope, claim.claimant_relationship, approvedRole)) {
      return Response.json({ error: 'Rolul aprobat nu este permis pentru acest tip de solicitare.' }, { status: 400 });
    }

    const approvedSet = new Set(approvedLocationIds);
    const now = new Date().toISOString();
    const membershipIds = [];
    const approvedLocations = [];
    for (const child of includedChildren) {
      if (!approvedSet.has(child.location_id)) continue;
      const location = await svc.entities.ProviderLocation.get(child.location_id).catch(() => null);
      if (!location) return Response.json({ error: 'Una dintre locatiile aprobate nu mai exista.' }, { status: 409 });
      if ((scope.organization_id || null) !== (location.organization_id || null)) {
        return Response.json({ error: 'Una dintre locatii nu mai apartine organizatiei verificate.' }, { status: 409 });
      }

      const currentlyControlled = CONTROLLED_PROFILE_STATUSES.has(clean(location.profile_control_status))
        || clean(location.claim_verification_status) === 'approved';
      if (!child.was_controlled && !currentlyControlled) {
        await svc.entities.ProviderLocation.update(location.id, {
          claim_verification_status: 'approved',
          profile_control_status: location.profile_control_status === 'verified' ? 'verified' : 'claimed',
          profile_control_status_updated_at: now,
          profile_control_status_reason: note || 'Revendicare multi-location aprobata',
        });
      }
      membershipIds.push(await ensureMembership(svc, {
        user_id: claim.user_id,
        organization_id: scope.organization_id || location.organization_id || null,
        location_id: location.id,
        role: approvedRole,
      }));
      approvedLocations.push(location);
      await svc.entities.ProviderClaimLocationSelection.update(child.id, {
        request_status: 'approved',
        approved_role: approvedRole,
        reviewed_by_user_id: user.id,
        reviewed_at: now,
        review_note: note,
      });
    }

    for (const child of includedChildren) {
      if (approvedSet.has(child.location_id)) continue;
      await svc.entities.ProviderClaimLocationSelection.update(child.id, {
        request_status: 'rejected',
        reviewed_by_user_id: user.id,
        reviewed_at: now,
        review_note: note || 'Locatia nu a fost inclusa in aprobarea finala.',
      });
      await resetPendingLocationIfUnused(svc, child, claim.id);
    }

    const submitted = parseJSON(claim.submitted_payload);
    await svc.entities.ProviderClaimRequest.update(claim.id, {
      status: 'aprobata',
      submitted_payload: JSON.stringify({
        ...submitted,
        approved_location_ids: approvedLocationIds,
        approved_membership_role: approvedRole,
      }),
      reviewed_at: now,
      review_notes: note,
    });
    await svc.entities.ProviderClaimScopeSelection.update(scope.id, {
      approval_status: 'approved',
      approved_membership_role: approvedRole,
      approved_location_count: approvedLocationIds.length,
      review_note: note,
      reviewed_by_user_id: user.id,
      reviewed_at: now,
    });

    const promotedDraftCount = await promotePreparedDrafts(svc, claim);
    const notificationSent = await sendClaimEmail(base44, claim, 'VIASEE - solicitare aprobata', [
      `Solicitarea ta a fost aprobata pentru ${approvedLocationIds.length} ${approvedLocationIds.length === 1 ? 'locatie' : 'locatii'}.`,
      `Rol acordat: ${approvedRole}.`,
      '',
      'Poti administra locatiile aprobate din contul tau VIASEE.',
    ]);
    await writeAudit(svc, user, claim, 'approve_provider_scoped_claim', {
      status: claim.status,
      claim_scope: scope.claim_scope,
    }, {
      status: 'aprobata',
      claim_scope: scope.claim_scope,
      approved_membership_role: approvedRole,
      approved_location_ids: approvedLocationIds,
      membership_count: membershipIds.length,
      promoted_drafts: promotedDraftCount,
      notification_sent: notificationSent,
    }, note);

    return Response.json({
      success: true,
      claim_scope: scope.claim_scope,
      approved_membership_role: approvedRole,
      approved_location_ids: approvedLocationIds,
      membership_ids: membershipIds,
      promoted_drafts: promotedDraftCount,
      notification_sent: notificationSent,
      approved_locations: approvedLocations.map((location) => ({ id: location.id, name: location.public_display_name || location.name })),
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Solicitarea nu a putut fi procesata.' }, { status: 500 });
  }
}