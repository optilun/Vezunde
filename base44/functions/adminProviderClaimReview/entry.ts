import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MEMBER_ROLES = ['organization_owner', 'location_manager', 'location_staff'];
const ROLE_BY_RELATIONSHIP = {
  owner: 'organization_owner',
  organization_representative: 'organization_owner',
  location_manager: 'location_manager',
  authorized_staff: 'location_staff',
};
const NEW_PROFILE_REQUESTS = ['new_patient_facing_location', 'new_b2b_supplier_profile', 'new_professional_profile'];

function parseJSON(value) {
  try { return value ? JSON.parse(value) : {}; } catch { return {}; }
}

function bad(message, status = 400) {
  return Response.json({ error: message }, { status });
}

async function audit(svc, user, record) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: record.entity_type,
    entity_id: record.entity_id || '',
    action_type: record.action_type,
    changed_fields: record.changed_fields || [],
    previous_values: JSON.stringify(record.previous || {}),
    new_values: JSON.stringify(record.next || {}),
    admin_user_id: user.id,
    admin_email: user.email,
    note: record.note || '',
    performed_at: new Date().toISOString(),
  });
}

function professionalRole(professionalType) {
  return professionalType === 'ophthalmologist'
    ? 'medic_oftalmolog'
    : professionalType === 'optometrist'
      ? 'optometrist'
      : 'optician';
}

async function ensureMembership(svc, { userId, organizationId, locationId, role, now }) {
  const rows = await svc.entities.ProviderMembership.filter({ user_id: userId, location_id: locationId }, '-created_date', 20).catch(() => []);
  const existing = rows.find((row) => row.status === 'active') || rows[0] || null;
  if (!existing) {
    return svc.entities.ProviderMembership.create({
      user_id: userId,
      organization_id: organizationId || null,
      location_id: locationId,
      role,
      status: 'active',
    });
  }
  const updates = {
    organization_id: organizationId || existing.organization_id || null,
    role,
    status: 'active',
  };
  if (existing.status !== 'active') {
    updates.reactivated_by_user_id = userId;
    updates.reactivated_at = now;
  }
  await svc.entities.ProviderMembership.update(existing.id, updates);
  return { ...existing, ...updates };
}

async function ensureProfessionalAssignment(svc, { professionalId, locationId, professionalType, now }) {
  const rows = await svc.entities.ProfessionalLocationAssignment.filter({ professional_id: professionalId, location_id: locationId }, '-created_date', 20).catch(() => []);
  const existing = rows[0] || null;
  const values = {
    professional_type: professionalType,
    confirmed_by_professional_at: now,
    active_status: 'activ',
    public_status: 'privat',
  };
  if (!existing) {
    return svc.entities.ProfessionalLocationAssignment.create({
      professional_id: professionalId,
      location_id: locationId,
      ...values,
    });
  }
  await svc.entities.ProfessionalLocationAssignment.update(existing.id, values);
  return { ...existing, ...values };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return bad('Neautentificat', 401);
    if (user.role !== 'admin') return bad('Acces interzis: doar administratori VIASEE', 403);

    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    const claim = await svc.entities.ProviderClaimRequest.get(p.claim_id).catch(() => null);
    if (!claim) return bad('Solicitarea nu exista', 404);
    const submitted = parseJSON(claim.submitted_payload);
    const requestType = claim.request_type || submitted.request_type || (claim.mode === 'claim' ? 'claim_existing_directory_profile' : 'new_patient_facing_location');
    const requestedRole = claim.requested_membership_role || submitted.requested_membership_role || ROLE_BY_RELATIONSHIP[claim.claimant_relationship] || 'location_staff';
    const note = String(p.note || '').trim();

    if (p.action === 'approve') {
      if (claim.mode === 'new_location_duplicate_review') return bad('Cererea de clarificare duplicat nu poate fi aprobata direct.');
      if (!['in_asteptare', 'needs_more_info'].includes(claim.status)) return bad('Solicitarea nu mai este in asteptare.');
      if (!claim.location_id) return bad('Solicitarea nu are locatie asociata.');

      const location = await svc.entities.ProviderLocation.get(claim.location_id).catch(() => null);
      if (!location) return bad('Locatia asociata nu exista.');
      if (!location.provider_profile_type) return bad('Locatia nu are tipul de profil clasificat.');

      const approvedRole = MEMBER_ROLES.includes(p.membership_role) ? p.membership_role : requestedRole;
      if (!MEMBER_ROLES.includes(approvedRole)) return bad('Rolul aprobat este invalid.');
      const isNewProfile = NEW_PROFILE_REQUESTS.includes(requestType);
      const isProfessional = requestType === 'new_professional_profile';
      const now = new Date().toISOString();
      const locationUpdates = {
        claim_verification_status: 'approved',
        profile_control_status: location.profile_control_status === 'verified' ? 'verified' : 'claimed',
        profile_control_status_updated_at: now,
        profile_control_status_reason: note || 'Solicitare aprobata',
      };
      if (isNewProfile) {
        locationUpdates.status = 'draft';
        locationUpdates.public_visibility_status = 'draft';
        locationUpdates.request_intake_status = 'inactive';
      }

      const approvedPayload = JSON.stringify({
        ...submitted,
        request_type: requestType,
        requested_membership_role: requestedRole,
        approved_membership_role: isProfessional ? null : approvedRole,
        verification_status: 'approved',
      });
      await svc.entities.ProviderLocation.update(location.id, locationUpdates);
      await svc.entities.ProviderClaimRequest.update(claim.id, {
        status: 'aprobata',
        reviewed_at: now,
        review_notes: note,
        submitted_payload: approvedPayload,
      });

      let primaryMembership = null;
      let membershipCount = 0;
      let professionalProfile = null;
      let professionalAssignment = null;

      if (isProfessional) {
        const identity = submitted.professional_identity || {};
        const professionalType = identity.professional_type;
        const existingProfiles = await svc.entities.ProfessionalProfile.filter({ user_id: claim.user_id }, '-created_date', 10).catch(() => []);
        professionalProfile = existingProfiles[0] || null;
        if (!professionalProfile) {
          professionalProfile = await svc.entities.ProfessionalProfile.create({
            user_id: claim.user_id,
            full_name: identity.full_name || claim.contact_name || claim.business_name,
            public_display_name: identity.full_name || claim.contact_name || claim.business_name,
            professional_type: professionalType,
            role: professionalRole(professionalType),
            verification_status: 'unverified',
            public_visibility_status: 'draft',
            profile_review_status: 'draft',
            profile_completeness: 0,
            is_public: false,
          });
        }
        professionalAssignment = await ensureProfessionalAssignment(svc, {
          professionalId: professionalProfile.id,
          locationId: location.id,
          professionalType,
          now,
        });
      } else if (claim.user_id) {
        const organizationId = location.organization_id || claim.organization_id || null;
        const accessLocations = approvedRole === 'organization_owner' && organizationId
          ? await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, '-created_date', 500).catch(() => [location])
          : [location];
        const uniqueLocations = [...new Map(accessLocations.filter(Boolean).map((row) => [row.id, row])).values()];
        for (const accessLocation of uniqueLocations) {
          const membership = await ensureMembership(svc, {
            userId: claim.user_id,
            organizationId,
            locationId: accessLocation.id,
            role: approvedRole,
            now,
          });
          membershipCount += 1;
          if (accessLocation.id === location.id) primaryMembership = membership;
        }
      }

      let promotedDraftCount = 0;
      if (primaryMembership && claim.user_id) {
        const drafts = await svc.entities.ProviderWorkspaceSubmission.filter({
          claim_request_id: claim.id,
          submitted_by_user_id: claim.user_id,
          access_origin: 'claim_preparation',
          location_id: location.id,
          status: { $in: ['draft', 'needs_more_info'] },
        }, '-created_date', 100).catch(() => []);
        for (const draft of drafts) {
          if (draft.preparation_locked_at) continue;
          await svc.entities.ProviderWorkspaceSubmission.update(draft.id, { access_origin: 'provider_workspace' });
          promotedDraftCount += 1;
        }
      }

      await audit(svc, user, {
        entity_type: 'ProviderClaimRequest',
        entity_id: claim.id,
        action_type: requestType === 'access_request_existing_claimed_profile' ? 'approve_access_request' : 'approve_provider_onboarding',
        changed_fields: ['status', 'verification_status', 'profile_control_status', isProfessional ? 'professional_profile_assignment' : 'membership_role'],
        previous: { status: claim.status, profile_control_status: location.profile_control_status },
        next: {
          status: 'aprobata',
          request_type: requestType,
          requested_membership_role: requestedRole,
          approved_membership_role: isProfessional ? null : approvedRole,
          membership_location_count: membershipCount,
          professional_profile_id: professionalProfile?.id || null,
          professional_assignment_id: professionalAssignment?.id || null,
          location_status: locationUpdates.status || location.status,
          promoted_preparation_drafts: promotedDraftCount,
        },
        note,
      });

      return Response.json({
        success: true,
        request_type: requestType,
        requested_membership_role: requestedRole,
        approved_membership_role: isProfessional ? null : approvedRole,
        membership_location_count: membershipCount,
        professional_profile_id: professionalProfile?.id || null,
        professional_assignment_id: professionalAssignment?.id || null,
        promoted_preparation_drafts: promotedDraftCount,
      });
    }

    if (p.action === 'reject') {
      if (!['in_asteptare', 'needs_more_info'].includes(claim.status)) return bad('Solicitarea nu mai este in asteptare.');
      if (!note) return bad('Respingerea necesita o nota.');
      const now = new Date().toISOString();
      const rejectedPayload = JSON.stringify({
        ...submitted,
        request_type: requestType,
        requested_membership_role: requestedRole,
        verification_status: 'rejected',
      });
      await svc.entities.ProviderClaimRequest.update(claim.id, {
        status: 'respinsa',
        reviewed_at: now,
        review_notes: note,
        submitted_payload: rejectedPayload,
      });

      let location = null;
      if (claim.location_id) location = await svc.entities.ProviderLocation.get(claim.location_id).catch(() => null);
      if (location) {
        if (NEW_PROFILE_REQUESTS.includes(requestType)) {
          await svc.entities.ProviderLocation.update(location.id, {
            claim_verification_status: 'rejected',
            status: 'suspendata',
            public_visibility_status: 'archived',
            active_status: 'inactiva',
            profile_control_status: 'suspended',
            profile_control_status_updated_at: now,
            profile_control_status_reason: note,
          });
          if (location.organization_id) {
            const siblings = await svc.entities.ProviderLocation.filter({ organization_id: location.organization_id }, '-created_date', 500).catch(() => []);
            const otherActive = siblings.some((row) => row.id !== location.id && row.active_status !== 'inactiva' && row.status !== 'suspendata');
            if (!otherActive) {
              await svc.entities.ProviderOrganization.update(location.organization_id, { status: 'inactiva', public_visibility_status: 'archived' });
            }
          }
        } else if (requestType === 'claim_existing_directory_profile') {
          await svc.entities.ProviderLocation.update(location.id, {
            claim_verification_status: 'rejected',
            profile_control_status: location.profile_control_status === 'directory' ? 'directory' : location.profile_control_status,
          });
        }
      }

      const drafts = await svc.entities.ProviderWorkspaceSubmission.filter({ claim_request_id: claim.id, access_origin: 'claim_preparation' }, '-created_date', 100).catch(() => []);
      let lockedDraftCount = 0;
      for (const draft of drafts) {
        if (draft.preparation_locked_at) continue;
        await svc.entities.ProviderWorkspaceSubmission.update(draft.id, { preparation_locked_at: now, preparation_lock_reason: 'claim_rejected' });
        lockedDraftCount += 1;
      }

      await audit(svc, user, {
        entity_type: 'ProviderClaimRequest',
        entity_id: claim.id,
        action_type: 'reject_provider_onboarding',
        changed_fields: ['status', 'verification_status', 'location_lifecycle', 'preparation_draft_lock'],
        previous: { status: claim.status },
        next: { status: 'respinsa', request_type: requestType, locked_preparation_drafts: lockedDraftCount },
        note,
      });
      return Response.json({ success: true, request_type: requestType, locked_preparation_drafts: lockedDraftCount });
    }

    return bad('Actiune necunoscuta.');
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
