import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ACTIVE_CLAIM_STATUSES = ['in_asteptare', 'needs_more_info'];

function parseJSON(value) {
  try {
    return value ? JSON.parse(value) : {};
  } catch (_error) {
    return {};
  }
}

function sanitizeClaim(claim) {
  const submitted = parseJSON(claim.submitted_payload);
  return {
    id: claim.id,
    status: claim.status,
    mode: claim.mode || '',
    claim_subject_type: claim.claim_subject_type || submitted.claim_subject_type || '',
    claimant_relationship: claim.claimant_relationship || submitted.claimant_relationship || '',
    requested_membership_role: claim.requested_membership_role || submitted.requested_membership_role || '',
    business_name: claim.business_name || submitted.organization_name || '',
    contact_name: claim.contact_name || '',
    email: claim.email || '',
    phone: claim.phone || '',
    location_id: claim.location_id || submitted.location_id || '',
    created_date: claim.created_date || null,
    reviewed_at: claim.reviewed_at || null,
    latest_admin_note: claim.status === 'needs_more_info' ? (claim.review_notes || '') : '',
  };
}

function sanitizeLocation(location, claim) {
  const submitted = parseJSON(claim.submitted_payload);
  const proposed = submitted.proposed_location || {};
  if (!location) {
    return {
      id: claim.location_id || submitted.location_id || '',
      organization_id: claim.organization_id || '',
      organization_name: submitted.organization_name || '',
      name: proposed.name || claim.business_name || '',
      provider_type: proposed.provider_type || '',
      provider_profile_type: proposed.provider_profile_type || '',
      city: proposed.locality_name || '',
      locality_name: proposed.locality_name || '',
      locality_siruta_code: proposed.locality_siruta_code || '',
      county_name: proposed.county_name || '',
      address: proposed.address || '',
      phone_public: proposed.phone_public || '',
      public_email: proposed.public_email || '',
      status: 'in_verificare',
      public_visibility_status: 'draft',
      profile_control_status: 'directory',
      claim_verification_status: 'pending',
    };
  }
  return {
    id: location.id,
    organization_id: location.organization_id || claim.organization_id || '',
    name: location.public_display_name || location.name || claim.business_name || '',
    provider_type: location.provider_type || '',
    provider_profile_type: location.provider_profile_type || '',
    city: location.locality_name || location.city || '',
    locality_name: location.locality_name || location.city || '',
    locality_siruta_code: location.locality_siruta_code || '',
    county_name: location.county_name || location.county || '',
    address: location.address || '',
    phone_public: location.phone_public || location.public_phone || '',
    public_email: location.public_email || '',
    status: location.status || 'draft',
    public_visibility_status: location.public_visibility_status || 'draft',
    profile_control_status: location.profile_control_status || 'directory',
    claim_verification_status: location.claim_verification_status || 'pending',
  };
}

function sanitizeDraft(submission) {
  return {
    id: submission.id,
    location_id: submission.location_id,
    organization_id: submission.organization_id || '',
    claim_request_id: submission.claim_request_id || '',
    access_origin: submission.access_origin || 'claim_preparation',
    section: submission.section,
    item_key: submission.item_key || '',
    status: submission.status,
    payload_json: submission.payload_json || '{}',
    created_date: submission.created_date || null,
    updated_date: submission.updated_date || null,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    const svc = base44.asServiceRole;
    await req.json().catch(() => ({}));

    const claims = await svc.entities.ProviderClaimRequest.filter({ user_id: user.id }, '-created_date', 50);
    const activeClaim = claims.find((claim) => (
      ACTIVE_CLAIM_STATUSES.includes(claim.status)
      && claim.mode !== 'new_location_duplicate_review'
      && Boolean(claim.location_id)
    ));
    if (!activeClaim) {
      return Response.json({
        mode: 'none',
        latest_claim_status: claims[0] ? {
          id: claims[0].id,
          status: claims[0].status,
          mode: claims[0].mode || '',
          reviewed_at: claims[0].reviewed_at || null,
        } : null,
      });
    }

    const location = await svc.entities.ProviderLocation.get(activeClaim.location_id).catch(() => null);
    if (!location) {
      return Response.json({
        mode: 'none',
        latest_claim_status: {
          id: activeClaim.id,
          status: activeClaim.status,
          mode: activeClaim.mode || '',
          reviewed_at: activeClaim.reviewed_at || null,
        },
      });
    }

    const drafts = await svc.entities.ProviderWorkspaceSubmission.filter({
      claim_request_id: activeClaim.id,
      submitted_by_user_id: user.id,
      access_origin: 'claim_preparation',
    }, '-created_date', 100);
    const activeDrafts = drafts.filter((draft) => !draft.preparation_locked_at && draft.preparation_lock_reason !== 'claim_rejected');

    return Response.json({
      mode: 'applicant_preparation',
      user: { id: user.id, full_name: user.full_name || user.name || '', email: user.email || '' },
      claim: sanitizeClaim(activeClaim),
      location_summary: sanitizeLocation(location, activeClaim),
      preparation_drafts: activeDrafts.map(sanitizeDraft),
      allowed_sections: ['public_profile', 'operating_hours', 'services'],
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Eroare neasteptata' }, { status: 500 });
  }
});
