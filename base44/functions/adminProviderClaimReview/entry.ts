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
      if (claim.status !== 'in_asteptare' && claim.status !== 'needs_more_info') return bad('Solicitarea nu mai este in asteptare.');
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

      await svc.entities.ProviderLocation.update(location.id, locationUpdates);
      await svc.entities.ProviderClaimRequest.update(claim.id, {
        status: 'aprobata',
        verification_status: 'approved',
        reviewed_at: now,
        review_notes: note,
        requested_membership_role: requestedRole,
      });

      let membership = null;
      let professionalProfile = null;
      if (isProfessional) {
        const identity = submitted.professional_identity || {};
        const existingProfiles = await svc.entities.ProfessionalProfile.filter({ user_id: claim.user_id }, '-created_date', 10).catch(() => []);
        professionalProfile = existingProfiles[0] || null;
        if (!professionalProfile) {
          professionalProfile = await svc.entities.ProfessionalProfile.create({
            user_id: claim.user_id,
            full_name: identity.full_name || claim.contact_name || claim.business_name,
            public_display_name: identity.full_name || claim.contact_name || claim.business_name,
            professional_type: identity.professional_type,
            role: professionalRole(identity.professional_type),
            verification_status: 'unverified',
            public_visibility_status: 'draft',
            profile_review_status: 'draft',
            profile_completeness: 0,
            is_public: false,
          });
        }
      } else if (claim.user_id) {
        const existing = await svc.entities.ProviderMembership.filter({ user_id: claim.user_id, location_id: location.id, status: 'active' }, '-created_date', 10).catch(() => []);
        membership = existing[0] || null;
        if (!membership) {
          membership = await svc.entities.ProviderMembership.create({
            user_id: claim.user_id,
            location_id: location.id,
            organization_id: location.organization_id || claim.organization_id || null,
            role: approvedRole,
            status: 'active',
          });
        } else if (membership.role !== approvedRole) {
          await svc.entities.ProviderMembership.update(membership.id, { role: approvedRole });
          membership = { ...membership, role: approvedRole };
        }
      }

      let promotedDraftCount = 0;
      if (membership && claim.user_id) {
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
        changed_fields: ['status', 'verification_status', 'profile_control_status', isProfessional ? 'professional_profile' : 'membership_role'],
        previous: { status: claim.status, profile_control_status: location.profile_control_status },
        next: {
          status: 'aprobata',
          request_type: requestType,
          requested_membership_role: requestedRole,
          approved_membership_role: isProfessional ? null : approvedRole,
          professional_profile_id: professionalProfile?.id || null,
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
        professional_profile_id: professionalProfile?.id || null,
        promoted_preparation_drafts: promotedDraftCount,
      });
    }

    if (p.action === 'reject') {
      if (claim.status !== 'in_asteptare' && claim.status !== 'needs_more_info') return bad('Solicitarea nu mai este in asteptare.');
      if (!note) return bad('Respingerea necesita o nota.');
      const now = new Date().toISOString();
      await svc.entities.ProviderClaimRequest.update(claim.id, {
        status: 'respinsa',
        verification_status: 'rejected',
        reviewed_at: now,
        review_notes: note,
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
