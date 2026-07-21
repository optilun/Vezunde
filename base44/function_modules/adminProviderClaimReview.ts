import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MEMBER_ROLES = ['organization_owner', 'location_manager', 'location_staff'];
const LOCATION_MEMBER_ROLES = ['location_manager', 'location_staff'];
const ACTIVE_CLAIM_STATUSES = ['in_asteptare', 'needs_more_info'];
const ROLE_BY_RELATIONSHIP = {
  owner: 'organization_owner',
  organization_representative: 'organization_owner',
  location_manager: 'location_manager',
  authorized_staff: 'location_staff',
};

function parseJSON(value) {
  try {
    return value ? JSON.parse(value) : {};
  } catch (_error) {
    return {};
  }
}

function clean(value) {
  return String(value || '').trim();
}

async function audit(svc, user, claim, actionType, previous, next, note) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: 'ProviderClaimRequest',
    entity_id: claim.id,
    action_type: actionType,
    changed_fields: Object.keys(next || {}),
    previous_values: JSON.stringify(previous || {}),
    new_values: JSON.stringify(next || {}),
    admin_user_id: user.id,
    admin_email: user.email,
    note: note || '',
    performed_at: new Date().toISOString(),
  });
}

async function ensureMembership(svc, values) {
  const existing = await svc.entities.ProviderMembership.filter({
    user_id: values.user_id,
    location_id: values.location_id,
    status: 'active',
  }, '-created_date', 20);
  if (existing[0]) {
    if (existing[0].role !== values.role || existing[0].organization_id !== values.organization_id) {
      await svc.entities.ProviderMembership.update(existing[0].id, {
        role: values.role,
        organization_id: values.organization_id || null,
      });
    }
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

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Neautentificat' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acces interzis' }, { status: 403 });

    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    const claim = await svc.entities.ProviderClaimRequest.get(p.claim_id).catch(() => null);
    if (!claim) return Response.json({ error: 'Solicitarea nu exista' }, { status: 404 });
    const note = clean(p.note);

    if (p.action === 'reject') {
      if (!ACTIVE_CLAIM_STATUSES.includes(claim.status)) {
        return Response.json({ error: 'Solicitarea nu mai poate fi respinsa' }, { status: 400 });
      }
      if (!note) return Response.json({ error: 'Respingerea necesita o explicatie' }, { status: 400 });
      const rejectedAt = new Date().toISOString();
      await svc.entities.ProviderClaimRequest.update(claim.id, {
        status: 'respinsa',
        reviewed_at: rejectedAt,
        review_notes: note,
      });
      if (claim.location_id) {
        const location = await svc.entities.ProviderLocation.get(claim.location_id).catch(() => null);
        if (location) {
          await svc.entities.ProviderLocation.update(location.id, {
            claim_verification_status: 'rejected',
            ...(claim.mode === 'new_location' ? { status: 'draft', public_visibility_status: 'draft' } : {}),
          });
        }
      }
      const drafts = await svc.entities.ProviderWorkspaceSubmission.filter({
        claim_request_id: claim.id,
        access_origin: 'claim_preparation',
      }, '-created_date', 100);
      let lockedDraftCount = 0;
      for (const draft of drafts) {
        if (draft.preparation_locked_at) continue;
        await svc.entities.ProviderWorkspaceSubmission.update(draft.id, {
          preparation_locked_at: rejectedAt,
          preparation_lock_reason: 'claim_rejected',
        });
        lockedDraftCount += 1;
      }
      await audit(svc, user, claim, 'reject_provider_onboarding', { status: claim.status }, { status: 'respinsa', locked_drafts: lockedDraftCount }, note);
      return Response.json({ success: true, locked_drafts: lockedDraftCount });
    }

    if (p.action !== 'approve') return Response.json({ error: 'Actiune invalida' }, { status: 400 });
    if (!ACTIVE_CLAIM_STATUSES.includes(claim.status)) {
      return Response.json({ error: 'Solicitarea nu mai poate fi aprobata' }, { status: 400 });
    }
    if (claim.mode === 'new_location_duplicate_review') {
      return Response.json({ error: 'Cererea de clarificare duplicat nu poate fi aprobata direct' }, { status: 400 });
    }
    if (!claim.location_id || !claim.user_id) {
      return Response.json({ error: 'Solicitarea nu are utilizator sau locatie asociata' }, { status: 400 });
    }

    const location = await svc.entities.ProviderLocation.get(claim.location_id).catch(() => null);
    if (!location) return Response.json({ error: 'Locatia nu exista' }, { status: 404 });
    const submitted = parseJSON(claim.submitted_payload);
    const isLocationScopedClaim = claim.mode === 'claim' || submitted.claim_scope === 'location';
    const rawRequestedRole = clean(
      submitted.requested_membership_role ||
      ROLE_BY_RELATIONSHIP[claim.claimant_relationship] ||
      'location_staff'
    );
    const requestedRole = isLocationScopedClaim && rawRequestedRole === 'organization_owner'
      ? 'location_manager'
      : rawRequestedRole;
    const isAccessRequest = submitted.request_type === 'access_request_existing_claimed_profile';
    const safeDefaultRole = isAccessRequest ? 'location_staff' : requestedRole;
    const approvedRole = clean(p.approved_role || safeDefaultRole);
    if (!MEMBER_ROLES.includes(approvedRole)) {
      return Response.json({ error: 'Rolul aprobat este invalid' }, { status: 400 });
    }
    if (isLocationScopedClaim && !LOCATION_MEMBER_ROLES.includes(approvedRole)) {
      return Response.json({
        error: 'Revendicarea unei locatii nu poate acorda rol de owner al organizatiei. Administrarea organizatiei necesita o solicitare separata.',
      }, { status: 400 });
    }

    const isNewLocation = claim.mode === 'new_location';
    const locationUpdates = {
      claim_verification_status: 'approved',
      profile_control_status: location.profile_control_status === 'verified' ? 'verified' : 'claimed',
      profile_control_status_updated_at: new Date().toISOString(),
      profile_control_status_reason: note || (isAccessRequest ? 'Cerere de acces aprobata' : 'Revendicare aprobata'),
      ...(isNewLocation ? { status: 'draft', public_visibility_status: 'draft' } : {}),
    };
    await svc.entities.ProviderLocation.update(location.id, locationUpdates);
    const updatedSubmitted = {
      ...submitted,
      claim_scope: isLocationScopedClaim ? 'location' : (submitted.claim_scope || ''),
      ...(rawRequestedRole !== requestedRole ? { original_requested_membership_role: rawRequestedRole } : {}),
      requested_membership_role: requestedRole,
      approved_membership_role: approvedRole,
    };
    await svc.entities.ProviderClaimRequest.update(claim.id, {
      status: 'aprobata',
      submitted_payload: JSON.stringify(updatedSubmitted),
      reviewed_at: new Date().toISOString(),
      review_notes: note,
    });

    const organizationId = location.organization_id || claim.organization_id || null;
    const membershipLocationIds = new Set([location.id]);
    if (!isLocationScopedClaim && approvedRole === 'organization_owner' && organizationId) {
      const organizationLocations = await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, '-created_date', 500);
      for (const organizationLocation of organizationLocations) membershipLocationIds.add(organizationLocation.id);
    }
    const membershipIds = [];
    for (const locationId of membershipLocationIds) {
      membershipIds.push(await ensureMembership(svc, {
        user_id: claim.user_id,
        organization_id: organizationId,
        location_id: locationId,
        role: approvedRole,
      }));
    }

    const drafts = await svc.entities.ProviderWorkspaceSubmission.filter({
      claim_request_id: claim.id,
      submitted_by_user_id: claim.user_id,
      access_origin: 'claim_preparation',
      status: { $in: ['draft', 'needs_more_info'] },
    }, '-created_date', 100);
    let promotedDraftCount = 0;
    for (const draft of drafts) {
      if (draft.preparation_locked_at) continue;
      await svc.entities.ProviderWorkspaceSubmission.update(draft.id, {
        access_origin: 'provider_workspace',
      });
      promotedDraftCount += 1;
    }

    await audit(
      svc,
      user,
      claim,
      isAccessRequest ? 'approve_provider_access_request' : 'approve_provider_onboarding',
      { status: claim.status, profile_control_status: location.profile_control_status },
      {
        status: 'aprobata',
        claim_scope: isLocationScopedClaim ? 'location' : (submitted.claim_scope || ''),
        requested_membership_role: requestedRole,
        approved_membership_role: approvedRole,
        membership_location_count: membershipLocationIds.size,
        promoted_drafts: promotedDraftCount,
        ...locationUpdates,
      },
      note,
    );

    return Response.json({
      success: true,
      claim_scope: isLocationScopedClaim ? 'location' : (submitted.claim_scope || ''),
      requested_membership_role: requestedRole,
      approved_membership_role: approvedRole,
      membership_ids: membershipIds,
      promoted_drafts: promotedDraftCount,
      location_status: locationUpdates.status || location.status,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Eroare neasteptata' }, { status: 500 });
  }
}
