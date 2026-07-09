import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// MODULE 3H.1C.1/3 — Provider Workspace read model.
// Returns one explicit mode:
// - none: no provider access and no active claim
// - applicant_preparation: own pending claim + private preparation drafts only
// - provider_workspace: active ProviderMembership access

const PROVIDER_ALLOWED_SECTIONS = ['organization_profile', 'location_details', 'services', 'team'];
const CLAIM_PREP_ALLOWED_SECTIONS = ['public_profile', 'operating_hours', 'services'];
const ACTIVE_CLAIM_STATUSES = ['in_asteptare', 'needs_more_info'];
const ACTIVE_SUBMISSION_STATUSES = ['draft', 'pending_review', 'needs_more_info'];

const LEGACY_PROVIDER_ROLE_MAP = { owner: 'organization_owner', staff: 'location_staff' };
const LEGACY_PROVIDER_STATUS_MAP = { revoked: 'inactive' };
function normalizeProviderMembership(membership) {
  if (!membership) return null;
  const role = LEGACY_PROVIDER_ROLE_MAP[membership.role] || membership.role;
  const status = LEGACY_PROVIDER_STATUS_MAP[membership.status] || membership.status;
  return { ...membership, role, status };
}
function activeProviderMemberships(rows) {
  return (rows || []).map(normalizeProviderMembership).filter((m) => m.status === 'active' && !!m.role);
}
async function getActiveProviderMemberships(svc, userId, options = {}) {
  const query = { user_id: userId, status: 'active' };
  if (options.locationId) query.location_id = options.locationId;
  const rows = await svc.entities.ProviderMembership.filter(query, null, options.limit || 100);
  return activeProviderMemberships(rows);
}
async function getActiveProviderLocationMemberships(svc, userId, locationId) {
  if (!userId || !locationId) return [];
  return getActiveProviderMemberships(svc, userId, { locationId, limit: 10 });
}
async function hasProviderLocationAccess(svc, user, locationId) {
  if (!user || !locationId) return false;
  if (user.role === 'admin') return true;
  const memberships = await getActiveProviderLocationMemberships(svc, user.id, locationId);
  return memberships.length > 0;
}
function getExplicitProviderLocationIds(memberships) {
  return [...new Set((memberships || []).filter((m) => m.status === 'active' && !!m.role).map((m) => m.location_id).filter(Boolean))];
}

const CLAIM_STATUS_MESSAGES = {
  in_asteptare: 'Solicitarea este in verificare. Poti pregati datele profilului intre timp.',
  needs_more_info: 'Avem nevoie de cateva completari pentru solicitarea ta.',
  aprobata: 'Revendicarea a fost aprobata. Workspace-ul furnizorului este disponibil.',
  respinsa: 'Revendicarea a fost respinsa.',
};

function parseJSON(value) {
  try { return value ? JSON.parse(value) : null; } catch (_e) { return null; }
}

// MODULE 3H.1C.1 Part 5 — deterministic V1 completeness checklist.
function computeOrganizationCompleteness(org) {
  const items = [
    { key: 'public_name', label: 'Numele public al organizatiei', done: !!(org?.public_display_name || org?.name) },
    { key: 'description', label: 'Descriere organizatie', done: !!String(org?.public_description || '').trim() },
    { key: 'contact', label: 'Telefon sau email general', done: !!(String(org?.public_phone || '').trim() || String(org?.public_email || '').trim()) },
    { key: 'website', label: 'Website sau social media', done: !!(String(org?.website_url || org?.website || '').trim() || String(org?.facebook_url || '').trim() || String(org?.instagram_url || '').trim() || String(org?.linkedin_url || '').trim()) },
  ];
  const completed = items.filter((i) => i.done);
  return { percentage: Math.round((completed.length / items.length) * 100), total_items: items.length, completed_count: completed.length, missing: items.filter((i) => !i.done).map((i) => ({ key: i.key, label: i.label })) };
}

function computeCompleteness(loc) {
  const items = [
    { key: 'identity', label: 'Identitatea locatiei', done: !!(loc.name && loc.provider_type && loc.provider_profile_type) },
    { key: 'locality', label: 'Localitatea canonica', done: !!loc.locality_siruta_code },
    { key: 'address', label: 'Adresa', done: !!String(loc.address || '').trim() },
    { key: 'public_contact', label: 'Telefon sau email public', done: !!(String(loc.phone_public || '').trim() || String(loc.public_phone || '').trim() || String(loc.public_email || '').trim()) },
    { key: 'description', label: 'Descriere publica', done: !!(String(loc.public_description || '').trim() || String(loc.description || '').trim()) },
    { key: 'web_presence', label: 'Website sau social media', done: !!(String(loc.website_url || '').trim() || String(loc.website || '').trim() || String(loc.facebook_url || '').trim() || String(loc.instagram_url || '').trim() || String(loc.linkedin_url || '').trim()) },
    { key: 'opening_hours', label: 'Program de functionare', done: !!String(loc.opening_hours || '').trim() },
  ];
  const completed = items.filter((i) => i.done);
  const missing = items.filter((i) => !i.done);
  return {
    percentage: Math.round((completed.length / items.length) * 100),
    total_items: items.length,
    completed_count: completed.length,
    completed: completed.map((i) => ({ key: i.key, label: i.label })),
    missing: missing.map((i) => ({ key: i.key, label: i.label })),
  };
}

async function getContentSummary(svc, locationId) {
  const submissions = await svc.entities.ProviderWorkspaceSubmission.filter({ location_id: locationId, status: { $in: ACTIVE_SUBMISSION_STATUSES } }, '-created_date', 50);
  const services = await svc.entities.LocationService.filter({ location_id: locationId, is_active: true });
  const specialties = await svc.entities.LocationSpecialization.filter({ location_id: locationId, is_active: true });
  const team = await svc.entities.ProfessionalLocationAssignment.filter({ location_id: locationId, active_status: 'activ', public_status: 'public' });
  const media = await svc.entities.ProviderMediaAsset.filter({ location_id: locationId, status: 'approved' });
  const articles = await svc.entities.ProviderArticle.filter({ location_id: locationId, status: 'approved' });
  const pendingCount = (section) => submissions.filter((s) => s.section === section).length;
  return {
    approved_service_count: services.length + specialties.length,
    approved_service_keys: services.map((s) => s.service_key).filter(Boolean),
    approved_specialization_keys: specialties.map((s) => s.specialization_key).filter(Boolean),
    pending_service_review_count: pendingCount('services'),
    approved_public_team_count: team.length,
    pending_team_review_count: pendingCount('team'),
    approved_media_count: media.length,
    pending_media_review_count: pendingCount('media'),
    approved_published_article_count: articles.filter((a) => !!a.published_at).length,
    pending_article_review_count: pendingCount('article'),
  };
}

// Provider-safe location view — no source provenance, research, migration,
// trust-internals or pending_changes staging data.
function sanitizeLocation(loc, orgName) {
  return {
    id: loc.id,
    organization_id: loc.organization_id || null,
    organization_name: orgName || null,
    name: loc.name,
    provider_type: loc.provider_type,
    provider_profile_type: loc.provider_profile_type,
    public_display_name: loc.public_display_name || '',
    public_description: loc.public_description || loc.description || '',
    city: loc.city || loc.locality_name || '',
    county: loc.county || loc.county_name || '',
    locality_name: loc.locality_name || '',
    locality_siruta_code: loc.locality_siruta_code || '',
    address: loc.address || '',
    lat: typeof loc.lat === 'number' ? loc.lat : null,
    lng: typeof loc.lng === 'number' ? loc.lng : null,
    place_id: loc.place_id || '',
    phone_public: loc.phone_public || loc.public_phone || '',
    public_email: loc.public_email || '',
    website: loc.website_url || loc.website || '',
    facebook_url: loc.facebook_url || '',
    instagram_url: loc.instagram_url || '',
    linkedin_url: loc.linkedin_url || '',
    opening_hours: loc.opening_hours || '',
    saturday_hours: loc.saturday_hours || '',
    availability_status: loc.availability_status || 'necunoscuta',
    request_intake_status: loc.request_intake_status || 'inactive',
    opening_hours_json: loc.opening_hours_json || '',
    status: loc.status || 'draft',
    profile_control_status: loc.profile_control_status || 'directory',
    claim_verification_status: loc.claim_verification_status || 'none',
    profile_completeness: computeCompleteness(loc),
  };
}

function sanitizeOrganization(org) {
  return {
    id: org.id,
    name: org.name || '',
    organization_type: org.organization_type || '',
    public_display_name: org.public_display_name || org.name || '',
    logo_url: org.logo_url || '',
    public_description: org.public_description || '',
    public_phone: org.public_phone || '',
    public_email: org.public_email || '',
    website_url: org.website_url || org.website || '',
    facebook_url: org.facebook_url || '',
    instagram_url: org.instagram_url || '',
    linkedin_url: org.linkedin_url || '',
    public_visibility_status: org.public_visibility_status || 'draft',
    status: org.status || 'activa',
    profile_completeness: computeOrganizationCompleteness(org),
  };
}

function sanitizeClaim(claim) {
  const showAdminNote = claim.status === 'needs_more_info';
  return {
    id: claim.id,
    status: claim.status,
    mode: claim.mode || '',
    claim_subject_type: claim.claim_subject_type || '',
    claimant_relationship: claim.claimant_relationship || '',
    business_name: claim.business_name || '',
    contact_name: claim.contact_name || '',
    role: claim.role || '',
    email: claim.email || '',
    phone: claim.phone || '',
    location_id: claim.location_id || '',
    created_date: claim.created_date || null,
    reviewed_at: claim.reviewed_at || null,
    status_message: CLAIM_STATUS_MESSAGES[claim.status] || '',
    latest_admin_note: showAdminNote ? (claim.review_notes || '') : '',
  };
}

function sanitizeClaimLocation(loc, claim) {
  const submitted = parseJSON(claim.submitted_payload) || {};
  const proposed = submitted.proposed_location || {};
  if (!loc) {
    return {
      id: claim.location_id || '',
      name: proposed.name || claim.business_name || '',
      provider_type: proposed.provider_type || '',
      provider_profile_type: proposed.provider_profile_type || '',
      locality_name: proposed.locality_name || '',
      locality_siruta_code: proposed.locality_siruta_code || '',
      county_name: proposed.county_name || '',
      address: proposed.address || '',
      status: 'in_verificare',
    };
  }
  return {
    id: loc.id,
    name: loc.name,
    provider_type: loc.provider_type || '',
    provider_profile_type: loc.provider_profile_type || '',
    public_display_name: loc.public_display_name || '',
    locality_name: loc.locality_name || loc.city || '',
    locality_siruta_code: loc.locality_siruta_code || '',
    county_name: loc.county_name || loc.county || '',
    address: loc.address || '',
    status: loc.status || 'draft',
    profile_control_status: loc.profile_control_status || 'directory',
    claim_verification_status: loc.claim_verification_status || 'pending',
  };
}

function sanitizePreparationDraft(sub) {
  return {
    id: sub.id,
    location_id: sub.location_id,
    claim_request_id: sub.claim_request_id || '',
    access_origin: sub.access_origin || 'claim_preparation',
    section: sub.section,
    item_key: sub.item_key || '',
    status: sub.status,
    payload_json: sub.payload_json || '{}',
    created_date: sub.created_date || null,
    updated_date: sub.updated_date || null,
  };
}

async function getApplicantPreparationWorkspace(svc, user) {
  const claims = await svc.entities.ProviderClaimRequest.filter({ user_id: user.id }, '-created_date', 20);
  const activeClaim = claims.find((c) => ACTIVE_CLAIM_STATUSES.includes(c.status));
  if (!activeClaim) {
    const latestClaim = claims[0] || null;
    return {
      mode: 'none',
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
      memberships: [],
      organizations: [],
      locations: [],
      pending_review_count: 0,
      allowed_sections: [],
      latest_claim_status: latestClaim ? {
        id: latestClaim.id,
        status: latestClaim.status,
        status_message: CLAIM_STATUS_MESSAGES[latestClaim.status] || '',
        reviewed_at: latestClaim.reviewed_at || null,
      } : null,
    };
  }

  const loc = activeClaim.location_id ? await svc.entities.ProviderLocation.get(activeClaim.location_id).catch(() => null) : null;
  const drafts = await svc.entities.ProviderWorkspaceSubmission.filter({
    claim_request_id: activeClaim.id,
    submitted_by_user_id: user.id,
    access_origin: 'claim_preparation',
  }, '-created_date', 50);

  return {
    mode: 'applicant_preparation',
    user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
    memberships: [],
    organizations: [],
    locations: [],
    pending_review_count: 0,
    allowed_sections: CLAIM_PREP_ALLOWED_SECTIONS,
    claim: sanitizeClaim(activeClaim),
    location_summary: sanitizeClaimLocation(loc, activeClaim),
    preparation_drafts: drafts.map(sanitizePreparationDraft),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    const svc = base44.asServiceRole;

    const memberships = await getActiveProviderMemberships(svc, user.id);

    if (memberships.length === 0) {
      return Response.json(await getApplicantPreparationWorkspace(svc, user));
    }

    // Load locations + organizations individually (providers typically have 1-5).
    const locMap = new Map();
    const orgMap = new Map();
    for (const m of memberships) {
      if (m.location_id && !locMap.has(m.location_id)) {
        const loc = await svc.entities.ProviderLocation.get(m.location_id).catch(() => null);
        if (loc) locMap.set(loc.id, loc);
      }
      const orgId = m.organization_id || locMap.get(m.location_id)?.organization_id || '';
      if (orgId && !orgMap.has(orgId)) {
        const org = await svc.entities.ProviderOrganization.get(orgId).catch(() => null);
        if (org) orgMap.set(org.id, org);
      }
    }

    // Count pending submissions across all permitted locations.
    let pendingReviewCount = 0;
    for (const locId of locMap.keys()) {
      const subs = await svc.entities.ProviderWorkspaceSubmission.filter({
        location_id: locId,
        status: { $in: ACTIVE_SUBMISSION_STATUSES },
      });
      pendingReviewCount += subs.length;
    }

    const contentSummaries = new Map();
    for (const locId of locMap.keys()) {
      contentSummaries.set(locId, await getContentSummary(svc, locId));
    }

    const membershipData = memberships
      .filter((m) => locMap.has(m.location_id))
      .map((m) => {
        const loc = locMap.get(m.location_id);
        const org = m.organization_id ? orgMap.get(m.organization_id) : null;
        return {
          membership_id: m.id,
          role: m.role,
          organization_id: m.organization_id || null,
          organization_name: org?.name || null,
          location_id: m.location_id,
          location_name: loc.name,
          location_status: loc.status,
          profile_control_status: loc.profile_control_status || 'directory',
          claim_verification_status: loc.claim_verification_status || 'none',
          profile_completeness: computeCompleteness(loc).percentage,
          content_summary: contentSummaries.get(m.location_id),
        };
      });

    return Response.json({
      mode: 'provider_workspace',
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
      memberships: membershipData,
      organizations: [...orgMap.values()].map(sanitizeOrganization),
      locations: [...locMap.values()].map((loc) => ({ ...sanitizeLocation(loc, loc.organization_id ? orgMap.get(loc.organization_id)?.name : null), content_summary: contentSummaries.get(loc.id) })),
      pending_review_count: pendingReviewCount,
      allowed_sections: PROVIDER_ALLOWED_SECTIONS,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});