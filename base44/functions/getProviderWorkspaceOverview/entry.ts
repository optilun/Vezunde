import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ACTIVE_CLAIM_STATUSES = ['in_asteptare', 'needs_more_info'];
const ACTIVE_SUBMISSION_STATUSES = ['draft', 'pending_review', 'needs_more_info'];
const PROVIDER_ALLOWED_SECTIONS = ['public_profile', 'location_details', 'operating_hours', 'services', 'team', 'media', 'article'];
const CLAIM_PREP_ALLOWED_SECTIONS = ['public_profile', 'operating_hours', 'services'];
const MEMBER_ROLES = ['organization_owner', 'location_manager', 'location_staff'];

function normalizeMemberRole(role) {
  if (role === 'owner') return 'organization_owner';
  if (role === 'staff') return 'location_staff';
  return MEMBER_ROLES.includes(role) ? role : '';
}

function highestRole(roles) {
  if (roles.includes('organization_owner')) return 'organization_owner';
  if (roles.includes('location_manager')) return 'location_manager';
  if (roles.includes('location_staff')) return 'location_staff';
  return '';
}

function invitationLocIds(invitation) {
  return Array.isArray(invitation.invited_location_ids) ? invitation.invited_location_ids.filter(Boolean) : [];
}

function clean(value) {
  return String(value ?? '').trim();
}

function parseJson(raw) {
  try { return raw ? JSON.parse(raw) : {}; } catch (_error) { return {}; }
}

function parsePendingChanges(raw) {
  return parseJson(raw);
}

function checklistResult(items) {
  const completed = items.filter((item) => item.done);
  return {
    percentage: items.length ? Math.round((completed.length / items.length) * 100) : 0,
    total_items: items.length,
    completed_count: completed.length,
    missing_count: items.length - completed.length,
    checklist: items.map((item) => ({
      key: item.key,
      label: item.label,
      done: item.done,
      status: item.done ? 'complete' : 'missing',
    })),
  };
}

function computeOrganizationCompleteness(organization) {
  const hasContact = !!(clean(organization?.public_phone) || clean(organization?.public_email));
  const hasWeb = !!(
    clean(organization?.website_url || organization?.website)
    || clean(organization?.facebook_url)
    || clean(organization?.instagram_url)
    || clean(organization?.linkedin_url)
  );
  return checklistResult([
    { key: 'identity', label: 'Numele public al organizatiei', done: !!clean(organization?.public_display_name) },
    { key: 'description', label: 'Descrierea organizatiei', done: !!clean(organization?.public_description) },
    { key: 'public_contact', label: 'Telefon sau email general', done: hasContact },
    { key: 'web_presence', label: 'Website sau retele sociale', done: hasWeb },
    { key: 'logo', label: 'Logo-ul organizatiei', done: !!clean(organization?.logo_url) },
  ]);
}

function computeLocationCompleteness(location) {
  return checklistResult([
    { key: 'identity', label: 'Numele si tipul locatiei', done: !!(clean(location?.public_display_name || location?.name) && location?.provider_type && location?.provider_profile_type) },
    { key: 'locality', label: 'Localitatea', done: !!clean(location?.locality_siruta_code) },
    { key: 'address', label: 'Adresa', done: !!clean(location?.address) },
    { key: 'public_contact', label: 'Telefon sau email public', done: !!(clean(location?.phone_public || location?.public_phone) || clean(location?.public_email)) },
    { key: 'opening_hours', label: 'Programul de functionare', done: !!(clean(location?.opening_hours) || clean(location?.opening_hours_json)) },
  ]);
}

async function getMemberSummary(svc, userId, locationId) {
  const ownMemberships = await svc.entities.ProviderMembership.filter({ user_id: userId, location_id: locationId, status: 'active' }, '-created_date', 20);
  const currentRole = highestRole(ownMemberships.map((membership) => normalizeMemberRole(membership.role)));
  const activeRows = await svc.entities.ProviderMembership.filter({ location_id: locationId, status: 'active' }, '-created_date', 200);
  const validRows = activeRows.filter((membership) => normalizeMemberRole(membership.role));
  const pendingInvitations = await svc.entities.ProviderMemberInvitation.filter({ status: 'pending' }, '-created_date', 200).catch(() => []);
  return {
    current_user_role: currentRole,
    assigned_locations: currentRole ? [locationId] : [],
    can_manage_members: currentRole === 'organization_owner',
    active_member_count: [...new Set(validRows.map((membership) => membership.user_id))].length,
    pending_invitation_count: pendingInvitations.filter((invitation) => invitationLocIds(invitation).includes(locationId)).length,
  };
}

async function getLocationContentSummary(svc, location, userId) {
  const locationId = location.id;
  const rawSubmissions = await svc.entities.ProviderWorkspaceSubmission.filter({
    location_id: locationId,
    access_origin: 'provider_workspace',
    status: { $in: ACTIVE_SUBMISSION_STATUSES },
  }, '-created_date', 50);
  const submissions = rawSubmissions.filter((submission) => !submission.claim_request_id || submission.submitted_by_user_id === userId);
  const services = await svc.entities.LocationService.filter({ location_id: locationId, is_active: true });
  const specialties = await svc.entities.LocationSpecialization.filter({ location_id: locationId, is_active: true });
  const team = await svc.entities.ProfessionalLocationAssignment.filter({ location_id: locationId, active_status: 'activ', public_status: 'public' });
  const media = await svc.entities.ProviderMediaAsset.filter({ location_id: locationId, status: 'approved' });
  const articles = await svc.entities.ProviderArticle.filter({ location_id: locationId, status: 'approved' });
  const pendingCount = (section) => submissions.filter((submission) => submission.section === section).length;
  const approvedMediaReferences = new Set(media.map((asset) => clean(asset.storage_reference)).filter(Boolean));
  const primaryPhoto = clean(location.photo_url);
  if (primaryPhoto) approvedMediaReferences.add(primaryPhoto);

  return {
    approved_service_count: services.length + specialties.length,
    pending_service_review_count: pendingCount('services'),
    approved_public_team_count: team.length,
    pending_team_review_count: pendingCount('team'),
    approved_media_count: approvedMediaReferences.size,
    approved_media_asset_count: media.length,
    approved_primary_photo_count: primaryPhoto ? 1 : 0,
    pending_media_review_count: pendingCount('media'),
    approved_published_article_count: articles.filter((article) => !!article.published_at).length,
    pending_article_review_count: pendingCount('article'),
    has_opening_hours: !!(clean(location.opening_hours) || clean(location.opening_hours_json)),
    has_primary_photo: !!primaryPhoto,
  };
}

async function getAggregateContentSummary(svc, locations, userId) {
  const summaries = [];
  for (const location of locations) summaries.push(await getLocationContentSummary(svc, location, userId));
  return summaries.reduce((total, summary) => ({
    approved_service_count: total.approved_service_count + summary.approved_service_count,
    pending_service_review_count: total.pending_service_review_count + summary.pending_service_review_count,
    approved_public_team_count: total.approved_public_team_count + summary.approved_public_team_count,
    pending_team_review_count: total.pending_team_review_count + summary.pending_team_review_count,
    approved_media_count: total.approved_media_count + summary.approved_media_count,
    approved_media_asset_count: total.approved_media_asset_count + summary.approved_media_asset_count,
    approved_primary_photo_count: total.approved_primary_photo_count + summary.approved_primary_photo_count,
    pending_media_review_count: total.pending_media_review_count + summary.pending_media_review_count,
    approved_published_article_count: total.approved_published_article_count + summary.approved_published_article_count,
    pending_article_review_count: total.pending_article_review_count + summary.pending_article_review_count,
    locations_with_opening_hours: total.locations_with_opening_hours + (summary.has_opening_hours ? 1 : 0),
    locations_with_photo: total.locations_with_photo + (summary.has_primary_photo ? 1 : 0),
  }), {
    approved_service_count: 0,
    pending_service_review_count: 0,
    approved_public_team_count: 0,
    pending_team_review_count: 0,
    approved_media_count: 0,
    approved_media_asset_count: 0,
    approved_primary_photo_count: 0,
    pending_media_review_count: 0,
    approved_published_article_count: 0,
    pending_article_review_count: 0,
    locations_with_opening_hours: 0,
    locations_with_photo: 0,
  });
}

function safeLocationSummary(location) {
  const completion = computeLocationCompleteness(location);
  return {
    id: location.id,
    organization_id: location.organization_id || null,
    name: location.name,
    provider_type: location.provider_type || '',
    provider_profile_type: location.provider_profile_type || '',
    public_display_name: location.public_display_name || '',
    locality_name: location.locality_name || location.city || '',
    locality_siruta_code: location.locality_siruta_code || '',
    county_name: location.county_name || location.county || '',
    address: location.address || '',
    public_phone: location.public_phone || location.phone_public || '',
    public_email: location.public_email || '',
    photo_url: location.photo_url || '',
    opening_hours: location.opening_hours || '',
    opening_hours_json: location.opening_hours_json || '',
    status: location.status || 'draft',
    active_status: location.active_status || 'activa',
    profile_control_status: location.profile_control_status || 'directory',
    claim_verification_status: location.claim_verification_status || 'pending',
    profile_completeness: completion.percentage,
    profile_completion: completion,
  };
}

function sanitizeSubmission(submission, locationNames = {}) {
  return {
    id: submission.id,
    organization_id: submission.organization_id || null,
    location_id: submission.location_id || null,
    location_name: submission.location_id ? (locationNames[submission.location_id] || '') : '',
    section: submission.section,
    item_key: submission.item_key || '',
    access_origin: submission.access_origin || 'provider_workspace',
    status: submission.status,
    submitted_by_user_id: submission.submitted_by_user_id || null,
    submitted_at: submission.submitted_at || null,
    reviewed_at: submission.reviewed_at || null,
    created_date: submission.created_date || null,
    updated_date: submission.updated_date || null,
  };
}

function submissionTimestamp(submission) {
  return new Date(submission.reviewed_at || submission.updated_date || submission.submitted_at || submission.created_date || 0).getTime() || 0;
}

function dedupeSubmissions(rows) {
  return [...new Map(rows.filter(Boolean).map((submission) => [submission.id, submission])).values()];
}

function buildOrganizationProfileState(organization, fallbackLocation, activeSubmission = null) {
  const canonical = {
    public_display_name: clean(organization?.public_display_name),
    public_description: clean(organization?.public_description),
    public_phone: clean(organization?.public_phone),
    public_email: clean(organization?.public_email),
    website_url: clean(organization?.website_url || organization?.website),
    facebook_url: clean(organization?.facebook_url),
    instagram_url: clean(organization?.instagram_url),
    linkedin_url: clean(organization?.linkedin_url),
    logo_url: clean(organization?.logo_url),
  };
  const fallback = {
    public_display_name: clean(fallbackLocation?.public_display_name || fallbackLocation?.name),
    public_description: clean(fallbackLocation?.public_description || fallbackLocation?.description),
    public_phone: clean(fallbackLocation?.public_phone || fallbackLocation?.phone_public),
    public_email: clean(fallbackLocation?.public_email),
    website_url: clean(fallbackLocation?.website_url || fallbackLocation?.website),
    facebook_url: clean(fallbackLocation?.facebook_url),
    instagram_url: clean(fallbackLocation?.instagram_url),
    linkedin_url: clean(fallbackLocation?.linkedin_url),
    logo_url: '',
  };

  const sources = {};
  const effective = {};
  const fallbackFields = [];
  const missingFields = [];
  for (const key of Object.keys(canonical)) {
    if (canonical[key]) {
      sources[key] = 'organization';
      effective[key] = canonical[key];
    } else if (fallback[key]) {
      sources[key] = 'location_fallback';
      effective[key] = fallback[key];
      fallbackFields.push(key);
    } else {
      sources[key] = 'missing';
      effective[key] = '';
      missingFields.push(key);
    }
  }

  const publishedCompletion = computeOrganizationCompleteness(organization || {});
  const draftPayload = activeSubmission?.section === 'public_profile' ? parseJson(activeSubmission.payload_json) : {};
  const projectedOrganization = { ...(organization || {}), ...draftPayload };
  const projectedCompletion = activeSubmission ? computeOrganizationCompleteness(projectedOrganization) : publishedCompletion;

  return {
    canonical,
    fallback,
    effective,
    sources,
    fallbackFields,
    missingFields,
    publishedCompletion,
    projectedCompletion,
    activeSubmission: activeSubmission ? sanitizeSubmission(activeSubmission) : null,
  };
}

function buildLocationsCompletion(locations) {
  const items = locations.map((location) => ({
    id: location.id,
    name: location.public_display_name || location.name || 'Locatie',
    locality_name: location.locality_name || location.city || '',
    active_status: location.active_status || 'activa',
    profile_control_status: location.profile_control_status || 'directory',
    completion: computeLocationCompleteness(location),
  }));
  const activeItems = items.filter((item) => item.active_status !== 'inactiva');
  const average = activeItems.length
    ? Math.round(activeItems.reduce((sum, item) => sum + item.completion.percentage, 0) / activeItems.length)
    : 0;
  return {
    average_percentage: average,
    complete_count: activeItems.filter((item) => item.completion.percentage === 100).length,
    active_count: activeItems.length,
    items,
  };
}

const CLAIM_STATUS_MESSAGES = {
  in_asteptare: 'Solicitarea este in verificare. Poti pregati datele profilului intre timp.',
  needs_more_info: 'Avem nevoie de cateva completari pentru solicitarea ta.',
  aprobata: 'Revendicarea a fost aprobata. Workspace-ul furnizorului este disponibil.',
  respinsa: 'Revendicarea a fost respinsa.',
};

async function applicantOverview(svc, user, location, claim) {
  const rawDrafts = await svc.entities.ProviderWorkspaceSubmission.filter({
    location_id: location.id,
    claim_request_id: claim.id,
    submitted_by_user_id: user.id,
    access_origin: 'claim_preparation',
  }, '-created_date', 50);
  const drafts = rawDrafts.filter((submission) => !submission.preparation_locked_at && submission.preparation_lock_reason !== 'claim_rejected');
  const locationNames = { [location.id]: location.public_display_name || location.name || 'Locatie' };
  return {
    mode: 'applicant_preparation',
    claim: {
      id: claim.id,
      status: claim.status,
      mode: claim.mode || '',
      business_name: claim.business_name || '',
      contact_name: claim.contact_name || '',
      role: claim.role || '',
      email: claim.email || '',
      phone: claim.phone || '',
      status_message: CLAIM_STATUS_MESSAGES[claim.status] || '',
      latest_admin_note: claim.status === 'needs_more_info' ? (claim.review_notes || '') : '',
    },
    location: safeLocationSummary(location),
    preparation_drafts: drafts.map((submission) => sanitizeSubmission(submission, locationNames)),
    pending_submissions: drafts.map((submission) => sanitizeSubmission(submission, locationNames)),
    recent_submissions: drafts.map((submission) => sanitizeSubmission(submission, locationNames)),
    allowed_sections: CLAIM_PREP_ALLOWED_SECTIONS,
    public_preview: {
      display_name: location.public_display_name || location.name,
      address: location.address || '',
      city: location.city || location.locality_name || '',
      county: location.county || location.county_name || '',
      photo_url: location.photo_url || '',
    },
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    if (!payload.location_id) return Response.json({ error: 'location_id este obligatoriu' }, { status: 400 });

    let hasProviderAccess = user.role === 'admin';
    let activeClaim = null;
    let ownMemberships = [];
    if (!hasProviderAccess) {
      ownMemberships = await svc.entities.ProviderMembership.filter({ user_id: user.id, location_id: payload.location_id, status: 'active' });
      hasProviderAccess = ownMemberships.some((membership) => normalizeMemberRole(membership.role));
      if (!hasProviderAccess) {
        const claims = await svc.entities.ProviderClaimRequest.filter({
          user_id: user.id,
          location_id: payload.location_id,
          status: { $in: ACTIVE_CLAIM_STATUSES },
        }, '-created_date', 5);
        activeClaim = claims[0] || null;
        if (!activeClaim) return Response.json({ error: 'Nu ai acces la aceasta locatie' }, { status: 403 });
      }
    }

    const location = await svc.entities.ProviderLocation.get(payload.location_id).catch(() => null);
    if (!location) return Response.json({ error: 'Locatia nu a fost gasita' }, { status: 404 });
    if (!hasProviderAccess) return Response.json(await applicantOverview(svc, user, location, activeClaim));

    const organization = location.organization_id
      ? await svc.entities.ProviderOrganization.get(location.organization_id).catch(() => null)
      : null;

    if (user.role === 'admin') {
      ownMemberships = await svc.entities.ProviderMembership.filter({ location_id: location.id, status: 'active' }, '-created_date', 20);
    } else {
      ownMemberships = await svc.entities.ProviderMembership.filter({ user_id: user.id, status: 'active' }, '-created_date', 200);
    }

    const permittedLocations = [];
    for (const membership of ownMemberships) {
      if (!normalizeMemberRole(membership.role) || !membership.location_id) continue;
      const candidate = await svc.entities.ProviderLocation.get(membership.location_id).catch(() => null);
      if (!candidate) continue;
      if (location.organization_id ? candidate.organization_id === location.organization_id : candidate.id === location.id) permittedLocations.push(candidate);
    }
    if (!permittedLocations.some((candidate) => candidate.id === location.id)) permittedLocations.push(location);
    const uniqueLocations = [...new Map(permittedLocations.map((candidate) => [candidate.id, candidate])).values()];
    const permittedLocationIds = uniqueLocations.map((candidate) => candidate.id);
    const locationNames = Object.fromEntries(uniqueLocations.map((candidate) => [candidate.id, candidate.public_display_name || candidate.name || 'Locatie']));

    const activeRows = [];
    if (organization) {
      activeRows.push(...await svc.entities.ProviderWorkspaceSubmission.filter({
        organization_id: organization.id,
        access_origin: 'provider_workspace',
        status: { $in: ACTIVE_SUBMISSION_STATUSES },
      }, '-updated_date', 200));
    }
    for (const candidate of uniqueLocations) {
      activeRows.push(...await svc.entities.ProviderWorkspaceSubmission.filter({
        location_id: candidate.id,
        access_origin: 'provider_workspace',
        status: { $in: ACTIVE_SUBMISSION_STATUSES },
      }, '-updated_date', 100));
    }
    const pendingSubs = dedupeSubmissions(activeRows)
      .filter((submission) => submission.section === 'public_profile' || permittedLocationIds.includes(submission.location_id))
      .filter((submission) => !submission.claim_request_id)
      .sort((a, b) => submissionTimestamp(b) - submissionTimestamp(a));

    const recentRows = [];
    if (organization) recentRows.push(...await svc.entities.ProviderWorkspaceSubmission.filter({ organization_id: organization.id }, '-updated_date', 100));
    for (const candidate of uniqueLocations) recentRows.push(...await svc.entities.ProviderWorkspaceSubmission.filter({ location_id: candidate.id }, '-updated_date', 50));
    const recentSubs = dedupeSubmissions(recentRows)
      .filter((submission) => submission.access_origin === 'provider_workspace')
      .filter((submission) => submission.section === 'public_profile' || permittedLocationIds.includes(submission.location_id))
      .sort((a, b) => submissionTimestamp(b) - submissionTimestamp(a))
      .slice(0, 20);

    const reviewedSubs = recentSubs.filter((submission) => ['needs_more_info', 'rejected', 'approved'].includes(submission.status));
    const latestReview = reviewedSubs[0] || null;
    const activeOrganizationSubmission = pendingSubs.find((submission) => submission.section === 'public_profile' && submission.organization_id === organization?.id) || null;
    const contentSummary = await getAggregateContentSummary(svc, uniqueLocations, user.id);
    const memberSummary = await getMemberSummary(svc, user.id, location.id);

    let pendingLogoUrl = '';
    let pendingLogoLocationId = '';
    let pendingLogoReview = {};
    for (const candidate of uniqueLocations) {
      const pendingChanges = parsePendingChanges(candidate.pending_changes);
      const pendingFields = pendingChanges.fields || {};
      const candidateLogo = typeof pendingFields.photo_url === 'string' ? pendingFields.photo_url : '';
      if (candidateLogo && pendingChanges.media_review?.target_type === 'organization_logo') {
        pendingLogoUrl = candidateLogo;
        pendingLogoLocationId = candidate.id;
        pendingLogoReview = pendingChanges.media_review || {};
        break;
      }
    }

    const organizationPublic = {
      id: organization?.id || null,
      name: organization?.name || location.name,
      legal_name: organization?.legal_name || '',
      organization_type: organization?.organization_type || location.provider_profile_type || '',
      public_display_name: organization?.public_display_name || '',
      public_description: organization?.public_description || '',
      public_phone: organization?.public_phone || '',
      public_email: organization?.public_email || '',
      website_url: organization?.website_url || organization?.website || '',
      facebook_url: organization?.facebook_url || '',
      instagram_url: organization?.instagram_url || '',
      linkedin_url: organization?.linkedin_url || '',
      logo_url: organization?.logo_url || '',
      public_visibility_status: organization?.public_visibility_status || 'draft',
      status: organization?.status || 'activa',
    };

    const activeLocations = uniqueLocations.filter((candidate) => candidate.active_status !== 'inactiva' && candidate.status !== 'suspendata');
    const verifiedLocationCount = activeLocations.filter((candidate) => candidate.profile_control_status === 'verified').length;
    const verificationStatus = activeLocations.length > 0 && verifiedLocationCount === activeLocations.length
      ? 'all_verified'
      : verifiedLocationCount > 0
        ? 'partially_verified'
        : 'unverified';
    const fallbackLocation = activeLocations[0] || uniqueLocations[0] || location;
    const organizationProfileState = buildOrganizationProfileState(organization, fallbackLocation, activeOrganizationSubmission);
    const locationsCompletion = buildLocationsCompletion(uniqueLocations);
    organizationPublic.profile_completeness = organizationProfileState.publishedCompletion.percentage;

    return Response.json({
      mode: 'provider_workspace',
      organization: organizationPublic,
      organization_profile_state: {
        canonical: organizationProfileState.canonical,
        fallback: organizationProfileState.fallback,
        effective: organizationProfileState.effective,
        sources: organizationProfileState.sources,
        fallback_fields: organizationProfileState.fallbackFields,
        missing_fields: organizationProfileState.missingFields,
        published_completion: organizationProfileState.publishedCompletion,
        projected_completion: organizationProfileState.projectedCompletion,
        active_submission: organizationProfileState.activeSubmission,
        fallback_location_id: fallbackLocation?.id || null,
        fallback_location_name: fallbackLocation?.public_display_name || fallbackLocation?.name || '',
      },
      organization_profile_uses_location_fallback: organizationProfileState.fallbackFields.length > 0,
      organization_profile_sources: organizationProfileState.sources,
      organization_profile_fallback_fields: organizationProfileState.fallbackFields,
      organization_profile_missing_fields: organizationProfileState.missingFields,
      organization_profile_fallback_values: organizationProfileState.fallback,
      organization_summary: {
        location_count: uniqueLocations.length,
        active_location_count: activeLocations.length,
        verified_location_count: verifiedLocationCount,
        verification_status: verificationStatus,
        public_profile_status: organizationPublic.public_visibility_status,
        profile_completeness: organizationProfileState.publishedCompletion.percentage,
      },
      location_completion_summary: locationsCompletion,
      location: safeLocationSummary(location),
      locations: uniqueLocations.map(safeLocationSummary),
      completion: organizationProfileState.publishedCompletion,
      content_summary: contentSummary,
      member_summary: memberSummary,
      current_user_role: memberSummary.current_user_role,
      assigned_locations: permittedLocationIds,
      can_manage_members: memberSummary.can_manage_members,
      active_member_count: memberSummary.active_member_count,
      pending_invitation_count: memberSummary.pending_invitation_count,
      pending_profile_changes: {
        has_pending_changes: !!pendingLogoUrl,
        has_pending_logo: !!pendingLogoUrl,
        pending_logo_url: pendingLogoUrl,
        pending_logo_location_id: pendingLogoLocationId || null,
        media_review: pendingLogoReview,
      },
      pending_submissions: pendingSubs.map((submission) => ({
        ...sanitizeSubmission(submission, locationNames),
        owned_by_current_user: submission.submitted_by_user_id === user.id,
        conflict: submission.submitted_by_user_id !== user.id,
      })),
      recent_submissions: recentSubs.map((submission) => sanitizeSubmission(submission, locationNames)),
      ...(latestReview ? {
        latest_admin_note: latestReview.admin_note || '',
        latest_review_status: latestReview.status,
        latest_reviewed_at: latestReview.reviewed_at || null,
      } : {}),
      public_preview: {
        display_name: organizationProfileState.effective.public_display_name || organization?.name || location.name,
        description: organizationProfileState.effective.public_description,
        phone: organizationProfileState.effective.public_phone,
        email: organizationProfileState.effective.public_email,
        website: organizationProfileState.effective.website_url,
        facebook: organizationProfileState.effective.facebook_url,
        instagram: organizationProfileState.effective.instagram_url,
        linkedin: organizationProfileState.effective.linkedin_url,
        photo_url: organizationProfileState.canonical.logo_url,
        sources: organizationProfileState.sources,
      },
      allowed_sections: PROVIDER_ALLOWED_SECTIONS,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
