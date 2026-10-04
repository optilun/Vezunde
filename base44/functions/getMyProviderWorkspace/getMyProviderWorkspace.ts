import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { expandOwnerWorkspaceScope } from '../../shared/providerOwnerWorkspaceScope.js';
import {
  capabilitiesForProviderRoles,
  highestProviderAccessRole,
  normalizeProviderAccessRole,
  providerAccessRoleFromMembership,
  providerRoleHasCapability,
} from '../../shared/providerRolePolicy.js';
import {
  filterByIdList,
  getManyByIds,
  groupRowsBy,
  loadLocationContentIndex,
  rowsFor,
} from '../../shared/providerWorkspaceBatchQueries.js';
import { countApprovedServiceKeys } from '../../shared/providerServiceCounts.js';

const PROVIDER_ALLOWED_SECTIONS = ['public_profile', 'location_details', 'services', 'team', 'media', 'article'];
const CLAIM_PREP_ALLOWED_SECTIONS = ['public_profile', 'operating_hours', 'services'];
const ACTIVE_CLAIM_STATUSES = ['in_asteptare', 'needs_more_info'];
const ACTIVE_SUBMISSION_STATUSES = ['draft', 'pending_review', 'needs_more_info'];
// 2026-10-03 (structura conturilor, pasul 3). Rolurile si drepturile vin din matricea comuna
// (shared/providerRolePolicy.js). Rolul se citeste cu marcajul de administrator: un administrator
// (salvat ca `location_manager` + `organization_role: organization_admin`) primeste drepturile de
// administrator, nu pe cele de manager.
function membershipAccessRole(membership) {
  return normalizeProviderAccessRole(providerAccessRoleFromMembership(membership));
}

function highestRole(roles) {
  return highestProviderAccessRole(roles);
}

function capabilitiesForRole(value) {
  return capabilitiesForProviderRoles([value]);
}

function mergeCapabilities(roles) {
  return capabilitiesForProviderRoles(roles);
}

function canManageMembersAs(role) {
  return providerRoleHasCapability(role, 'organization.manage_members') || providerRoleHasCapability(role, 'location.manage_members');
}

function unique(values) { return [...new Set(values.filter(Boolean))]; }
function invitationLocationIds(invitation) { return Array.isArray(invitation.invited_location_ids) ? invitation.invited_location_ids.filter(Boolean) : []; }
function parseJSON(value) { try { return value ? JSON.parse(value) : null; } catch (_e) { return null; } }

const CLAIM_STATUS_MESSAGES = {
  in_asteptare: 'Solicitarea este in verificare. Poti pregati datele profilului intre timp.',
  needs_more_info: 'Avem nevoie de cateva completari pentru solicitarea ta.',
  aprobata: 'Revendicarea a fost aprobata. Workspace-ul furnizorului este disponibil.',
  respinsa: 'Revendicarea a fost respinsa.',
};

function computeLocationCompleteness(location) {
  const items = [
    !!(location.name && location.provider_type && location.provider_profile_type),
    !!location.locality_siruta_code,
    !!String(location.address || '').trim(),
    !!(String(location.phone_public || '').trim() || String(location.public_phone || '').trim() || String(location.public_email || '').trim()),
    !!String(location.opening_hours || '').trim(),
  ];
  return Math.round((items.filter(Boolean).length / items.length) * 100);
}

function computeOrganizationCompleteness(organization, locations) {
  const items = [
    !!String(organization?.public_display_name || organization?.name || '').trim(),
    !!String(organization?.public_description || '').trim(),
    !!(String(organization?.public_phone || '').trim() || String(organization?.public_email || '').trim()),
    !!(String(organization?.website_url || organization?.website || '').trim() || String(organization?.facebook_url || '').trim() || String(organization?.instagram_url || '').trim() || String(organization?.linkedin_url || '').trim()),
    !!String(organization?.logo_url || '').trim(),
    locations.some((location) => location.active_status !== 'inactiva' && location.status !== 'suspendata'),
  ];
  return Math.round((items.filter(Boolean).length / items.length) * 100);
}

function sanitizeOrganization(organization, locations) {
  return {
    id: organization.id,
    name: organization.name,
    legal_name: organization.legal_name || '',
    organization_type: organization.organization_type || '',
    public_display_name: organization.public_display_name || '',
    logo_url: organization.logo_url || '',
    cover_image_url: organization.cover_image_url || '',
    public_description: organization.public_description || '',
    website_url: organization.website_url || organization.website || '',
    public_phone: organization.public_phone || '',
    public_email: organization.public_email || '',
    facebook_url: organization.facebook_url || '',
    instagram_url: organization.instagram_url || '',
    linkedin_url: organization.linkedin_url || '',
    public_visibility_status: organization.public_visibility_status || 'draft',
    status: organization.status || 'activa',
    profile_completeness: computeOrganizationCompleteness(organization, locations),
  };
}

function sanitizeLocation(location, organizationName) {
  return {
    id: location.id,
    organization_id: location.organization_id || null,
    organization_name: organizationName || null,
    name: location.name,
    provider_type: location.provider_type,
    provider_profile_type: location.provider_profile_type,
    public_display_name: location.public_display_name || '',
    public_description: location.public_description || location.description || '',
    city: location.city || location.locality_name || '',
    county: location.county || location.county_name || '',
    locality_name: location.locality_name || location.city || '',
    locality_siruta_code: location.locality_siruta_code || '',
    county_name: location.county_name || location.county || '',
    address: location.address || '',
    lat: location.lat ?? null,
    lng: location.lng ?? null,
    place_id: location.place_id || '',
    map_precision: location.map_precision === 'exact' ? 'exact' : 'approximate',
    phone_public: location.phone_public || location.public_phone || '',
    public_phone: location.public_phone || location.phone_public || '',
    public_email: location.public_email || '',
    website: location.website_url || location.website || '',
    website_url: location.website_url || location.website || '',
    facebook_url: location.facebook_url || '',
    instagram_url: location.instagram_url || '',
    linkedin_url: location.linkedin_url || '',
    photo_url: location.photo_url || location.profile_photo_url || '',
    profile_photo_url: location.profile_photo_url || location.photo_url || '',
    gallery_urls: Array.isArray(location.gallery_urls) ? location.gallery_urls : [],
    opening_hours: location.opening_hours || '',
    saturday_hours: location.saturday_hours || '',
    availability_status: location.availability_status || 'necunoscuta',
    request_intake_status: location.request_intake_status || 'inactive',
    status: location.status || 'draft',
    active_status: location.active_status || 'activa',
    public_visibility_status: location.public_visibility_status || 'draft',
    profile_control_status: location.profile_control_status || 'directory',
    claim_verification_status: location.claim_verification_status || 'none',
    profile_completeness: computeLocationCompleteness(location),
  };
}

function buildOrganizationContexts(organizations, locations, memberships) {
  return organizations.map((organization) => {
    const contextMemberships = memberships.filter((membership) => membership.organization_id === organization.id);
    const contextLocations = locations
      .filter((location) => location.organization_id === organization.id)
      .map((location) => {
        const locationRoles = contextMemberships
          .filter((membership) => membership.location_id === location.id)
          .map((membership) => membership.role);
        const currentUserRole = highestRole(locationRoles);
        return { ...location, current_user_role: currentUserRole, capabilities: mergeCapabilities(locationRoles) };
      });
    const contextRoles = contextMemberships.map((membership) => membership.role);
    const currentUserRole = highestRole(contextRoles);
    return {
      organization,
      current_user_role: currentUserRole,
      capabilities: mergeCapabilities(contextRoles),
      can_manage_members: canManageMembersAs(currentUserRole),
      can_manage_settings: providerRoleHasCapability(currentUserRole, 'organization.manage_settings'),
      assigned_location_ids: contextLocations.map((location) => location.id),
      memberships: contextMemberships,
      locations: contextLocations,
    };
  });
}

// 2026-10-03. Continutul tuturor locatiilor se citeste o singura data, grupat (vezi
// base44/shared/providerWorkspaceBatchQueries.js); aici doar se numara pentru o locatie.
function visibleLocationSubmissions(contentIndex, locationId, userId) {
  return rowsFor(contentIndex.submissions, locationId).filter((submission) => !submission.claim_request_id || submission.submitted_by_user_id === userId);
}

function getContentSummary(contentIndex, locationId, userId) {
  const submissions = visibleLocationSubmissions(contentIndex, locationId, userId);
  const services = rowsFor(contentIndex.services, locationId);
  const specialties = rowsFor(contentIndex.specialties, locationId);
  const team = rowsFor(contentIndex.team, locationId);
  const media = rowsFor(contentIndex.media, locationId);
  const articles = rowsFor(contentIndex.articles, locationId);
  const pendingCount = (section) => submissions.filter((submission) => submission.section === section).length;
  return {
    approved_service_count: countApprovedServiceKeys(services, specialties),
    pending_service_review_count: pendingCount('services'),
    approved_public_team_count: team.length,
    pending_team_review_count: pendingCount('team'),
    approved_media_count: media.length,
    pending_media_review_count: pendingCount('media'),
    approved_published_article_count: articles.filter((article) => !!article.published_at).length,
    pending_article_review_count: pendingCount('article'),
  };
}

async function getMemberSummary(svc, memberships, locationIds) {
  const roleByLocation = {};
  for (const locationId of locationIds) roleByLocation[locationId] = highestRole(memberships.filter((membership) => membership.location_id === locationId).map(membershipAccessRole));
  // Locatiile la care utilizatorul poate invita: proprietar si administrator peste tot, managerul
  // la locatiile lui (membri), membrul nicaieri.
  const ownerLocationIds = unique(memberships.filter((membership) => canManageMembersAs(membershipAccessRole(membership))).map((membership) => membership.location_id));
  const activeRowsById = new Map();
  const perLocation = {};
  const rowsByLocation = groupRowsBy(
    await filterByIdList(svc.entities.ProviderMembership, 'location_id', locationIds, { status: 'active' }, { sort: '-created_date' }),
    'location_id',
  );
  for (const locationId of locationIds) {
    const valid = rowsFor(rowsByLocation, locationId).filter((membership) => membershipAccessRole(membership));
    perLocation[locationId] = unique(valid.map((membership) => membership.user_id)).length;
    for (const membership of valid) activeRowsById.set(membership.id, membership);
  }
  const activeRows = [...activeRowsById.values()];
  const pendingInvitations = await svc.entities.ProviderMemberInvitation.filter({ status: 'pending' }, '-created_date', 500).catch(() => []);
  return {
    current_user_role: highestRole(Object.values(roleByLocation)),
    current_user_role_by_location: roleByLocation,
    assigned_location_ids: locationIds,
    can_manage_members: ownerLocationIds.length > 0,
    active_member_count: unique(activeRows.map((membership) => membership.user_id)).length,
    pending_invitation_count: pendingInvitations.filter((invitation) => invitationLocationIds(invitation).some((id) => ownerLocationIds.includes(id))).length,
    counters: {
      active_members_total: unique(activeRows.map((membership) => membership.user_id)).length,
      active_members_per_location: perLocation,
      organization_owners_count: unique(activeRows.filter((membership) => membershipAccessRole(membership) === 'organization_owner').map((membership) => membership.user_id)).length,
      organization_admins_count: unique(activeRows.filter((membership) => membershipAccessRole(membership) === 'organization_admin').map((membership) => membership.user_id)).length,
      location_managers_count: unique(activeRows.filter((membership) => membershipAccessRole(membership) === 'location_manager').map((membership) => membership.user_id)).length,
      location_staff_count: unique(activeRows.filter((membership) => membershipAccessRole(membership) === 'location_staff').map((membership) => membership.user_id)).length,
    },
  };
}

function sanitizeClaim(claim) {
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
    latest_admin_note: claim.status === 'needs_more_info' ? (claim.review_notes || '') : '',
  };
}

function sanitizeClaimLocation(location, claim) {
  const submitted = parseJSON(claim.submitted_payload) || {};
  const proposed = submitted.proposed_location || {};
  if (!location) return { id: claim.location_id || '', name: proposed.name || claim.business_name || '', provider_type: proposed.provider_type || '', provider_profile_type: proposed.provider_profile_type || '', locality_name: proposed.locality_name || '', locality_siruta_code: proposed.locality_siruta_code || '', county_name: proposed.county_name || '', address: proposed.address || '', status: 'in_verificare' };
  return { id: location.id, name: location.name, provider_type: location.provider_type || '', provider_profile_type: location.provider_profile_type || '', public_display_name: location.public_display_name || '', locality_name: location.locality_name || location.city || '', locality_siruta_code: location.locality_siruta_code || '', county_name: location.county_name || location.county || '', address: location.address || '', status: location.status || 'draft', profile_control_status: location.profile_control_status || 'directory', claim_verification_status: location.claim_verification_status || 'pending' };
}

function sanitizePreparationDraft(submission) {
  return { id: submission.id, location_id: submission.location_id, claim_request_id: submission.claim_request_id || '', access_origin: submission.access_origin || 'claim_preparation', section: submission.section, item_key: submission.item_key || '', status: submission.status, payload_json: submission.payload_json || '{}', created_date: submission.created_date || null, updated_date: submission.updated_date || null };
}

async function getApplicantPreparationWorkspace(svc, user) {
  const claims = await svc.entities.ProviderClaimRequest.filter({ user_id: user.id }, '-created_date', 20);
  const activeClaim = claims.find((claim) => ACTIVE_CLAIM_STATUSES.includes(claim.status));
  if (!activeClaim) {
    const latestClaim = claims[0] || null;
    return { mode: 'none', user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role }, memberships: [], organizations: [], locations: [], pending_review_count: 0, allowed_sections: [], latest_claim_status: latestClaim ? { id: latestClaim.id, status: latestClaim.status, status_message: CLAIM_STATUS_MESSAGES[latestClaim.status] || '', reviewed_at: latestClaim.reviewed_at || null } : null };
  }
  const location = activeClaim.location_id ? await svc.entities.ProviderLocation.get(activeClaim.location_id).catch(() => null) : null;
  const rawDrafts = await svc.entities.ProviderWorkspaceSubmission.filter({ claim_request_id: activeClaim.id, submitted_by_user_id: user.id, access_origin: 'claim_preparation' }, '-created_date', 50);
  const drafts = rawDrafts.filter((submission) => !submission.preparation_locked_at && submission.preparation_lock_reason !== 'claim_rejected');
  return { mode: 'applicant_preparation', user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role }, memberships: [], organizations: [], locations: [], pending_review_count: 0, allowed_sections: CLAIM_PREP_ALLOWED_SECTIONS, claim: sanitizeClaim(activeClaim), location_summary: sanitizeClaimLocation(location, activeClaim), preparation_drafts: drafts.map(sanitizePreparationDraft) };
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    const svc = base44.asServiceRole;
    const rawMemberships = await svc.entities.ProviderMembership.filter({ user_id: user.id, status: 'active' }, '-created_date', 500);
    let memberships = rawMemberships.filter((membership) => membershipAccessRole(membership) && membership.location_id);
    if (memberships.length === 0) return Response.json(await getApplicantPreparationWorkspace(svc, user));

    // Locatiile si organizatiile se citesc grupat; ordinea ramane cea a membership-urilor.
    const fetchedLocations = await getManyByIds(svc.entities.ProviderLocation, memberships.map((membership) => membership.location_id));
    const locationMap = new Map();
    for (const membership of memberships) {
      const location = fetchedLocations.get(membership.location_id);
      if (location && !locationMap.has(location.id)) locationMap.set(location.id, location);
    }
    const organizationIds = unique(memberships.map((membership) => membership.organization_id || locationMap.get(membership.location_id)?.organization_id || ''));
    const fetchedOrganizations = await getManyByIds(svc.entities.ProviderOrganization, organizationIds);
    const organizationMap = new Map();
    for (const organizationId of organizationIds) {
      const organization = fetchedOrganizations.get(organizationId);
      if (organization) organizationMap.set(organization.id, organization);
    }

    const expandedOwnerScope = await expandOwnerWorkspaceScope(svc, user, memberships, [...locationMap.values()]);
    memberships = expandedOwnerScope.memberships;
    for (const location of expandedOwnerScope.locations) locationMap.set(location.id, location);
    const missingOrganizationIds = unique(expandedOwnerScope.locations.map((location) => location.organization_id || '').filter((organizationId) => !organizationMap.has(organizationId)));
    if (missingOrganizationIds.length > 0) {
      const extraOrganizations = await getManyByIds(svc.entities.ProviderOrganization, missingOrganizationIds);
      for (const organizationId of missingOrganizationIds) {
        const organization = extraOrganizations.get(organizationId);
        if (organization) organizationMap.set(organization.id, organization);
      }
    }

    const locationIds = [...locationMap.keys()];
    const contentIndex = await loadLocationContentIndex(svc, locationIds);
    let pendingReviewCount = 0;
    for (const locationId of locationIds) pendingReviewCount += visibleLocationSubmissions(contentIndex, locationId, user.id).length;
    const organizationSubmissions = await filterByIdList(svc.entities.ProviderWorkspaceSubmission, 'organization_id', [...organizationMap.keys()], { section: 'public_profile', access_origin: 'provider_workspace', status: { $in: ACTIVE_SUBMISSION_STATUSES } });
    pendingReviewCount += organizationSubmissions.filter((submission) => submission.submitted_by_user_id === user.id && !submission.location_id).length;

    const contentSummaries = new Map();
    for (const locationId of locationIds) contentSummaries.set(locationId, getContentSummary(contentIndex, locationId, user.id));
    const membershipData = memberships.filter((membership) => locationMap.has(membership.location_id)).map((membership) => {
      const location = locationMap.get(membership.location_id);
      const organizationId = membership.organization_id || location.organization_id || null;
      const organization = organizationId ? organizationMap.get(organizationId) : null;
      const normalizedRole = membershipAccessRole(membership);
      return { membership_id: membership.id || null, virtual_owner_access: membership.virtual_owner_access === true, role: normalizedRole, capabilities: capabilitiesForRole(normalizedRole), organization_id: organizationId, organization_name: organization?.public_display_name || organization?.name || null, location_id: membership.location_id, location_name: location.public_display_name || location.name, location_status: location.status, profile_control_status: location.profile_control_status || 'directory', claim_verification_status: location.claim_verification_status || 'none', profile_completeness: computeLocationCompleteness(location), content_summary: contentSummaries.get(membership.location_id) };
    });
    const memberSummary = await getMemberSummary(svc, memberships, [...locationMap.keys()]);
    const organizations = [...organizationMap.values()].map((organization) => sanitizeOrganization(organization, [...locationMap.values()].filter((location) => location.organization_id === organization.id)));
    const sanitizedLocations = [...locationMap.values()].map((location) => ({ ...sanitizeLocation(location, location.organization_id ? (organizationMap.get(location.organization_id)?.public_display_name || organizationMap.get(location.organization_id)?.name) : null), content_summary: contentSummaries.get(location.id) }));
    const organizationContexts = buildOrganizationContexts(organizations, sanitizedLocations, membershipData);

    return Response.json({
      mode: 'provider_workspace',
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
      memberships: membershipData,
      organizations,
      locations: sanitizedLocations,
      organization_contexts: organizationContexts,
      capability_catalog_version: 1,
      current_user_capabilities: mergeCapabilities(membershipData.map((membership) => membership.role)),
      pending_review_count: pendingReviewCount,
      member_summary: memberSummary,
      current_user_role: memberSummary.current_user_role,
      assigned_location_ids: memberSummary.assigned_location_ids,
      can_manage_members: memberSummary.can_manage_members,
      active_member_count: memberSummary.active_member_count,
      pending_invitation_count: memberSummary.pending_invitation_count,
      allowed_sections: PROVIDER_ALLOWED_SECTIONS,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

