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

function invitationLocIds(inv) {
  return Array.isArray(inv.invited_location_ids) ? inv.invited_location_ids.filter(Boolean) : [];
}

function clean(value) {
  return String(value ?? '').trim();
}

function parsePendingChanges(raw) {
  try { return raw ? JSON.parse(raw) : {}; } catch (_error) { return {}; }
}

function checklistResult(items) {
  const completed = items.filter((item) => item.done);
  return {
    percentage: items.length ? Math.round((completed.length / items.length) * 100) : 0,
    total_items: items.length,
    completed_count: completed.length,
    checklist: items.map((item) => ({
      key: item.key,
      label: item.label,
      done: item.done,
      status: item.done ? 'complete' : 'missing',
    })),
  };
}

function computeOrganizationCompleteness(org, locations) {
  const hasContact = !!(clean(org?.public_phone) || clean(org?.public_email));
  const hasWeb = !!(
    clean(org?.website_url || org?.website)
    || clean(org?.facebook_url)
    || clean(org?.instagram_url)
    || clean(org?.linkedin_url)
  );
  return checklistResult([
    { key: 'identity', label: 'Numele public al organizatiei', done: !!clean(org?.public_display_name) },
    { key: 'description', label: 'Descrierea organizatiei', done: !!clean(org?.public_description) },
    { key: 'public_contact', label: 'Telefon sau email general', done: hasContact },
    { key: 'web_presence', label: 'Website sau retele sociale', done: hasWeb },
    { key: 'logo', label: 'Logo-ul organizatiei', done: !!clean(org?.logo_url) },
    { key: 'locations', label: 'Cel putin o locatie activa', done: locations.some((loc) => loc.active_status !== 'inactiva' && loc.status !== 'suspendata') },
  ]);
}

function computeLocationCompleteness(loc) {
  return checklistResult([
    { key: 'identity', label: 'Identitatea locatiei', done: !!(clean(loc?.public_display_name || loc?.name) && loc?.provider_type && loc?.provider_profile_type) },
    { key: 'locality', label: 'Localitatea canonica', done: !!clean(loc?.locality_siruta_code) },
    { key: 'address', label: 'Adresa', done: !!clean(loc?.address) },
    { key: 'public_contact', label: 'Telefon sau email public', done: !!(clean(loc?.phone_public || loc?.public_phone) || clean(loc?.public_email)) },
    { key: 'opening_hours', label: 'Program de functionare', done: !!(clean(loc?.opening_hours) || clean(loc?.opening_hours_json)) },
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
  const approvedMediaReferences = new Set(
    media.map((asset) => clean(asset.storage_reference)).filter(Boolean),
  );
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

function safeLocationSummary(loc) {
  const completion = computeLocationCompleteness(loc);
  return {
    id: loc.id,
    organization_id: loc.organization_id || null,
    name: loc.name,
    provider_type: loc.provider_type || '',
    provider_profile_type: loc.provider_profile_type || '',
    public_display_name: loc.public_display_name || '',
    locality_name: loc.locality_name || loc.city || '',
    locality_siruta_code: loc.locality_siruta_code || '',
    county_name: loc.county_name || loc.county || '',
    address: loc.address || '',
    public_phone: loc.public_phone || loc.phone_public || '',
    public_email: loc.public_email || '',
    photo_url: loc.photo_url || '',
    opening_hours: loc.opening_hours || '',
    opening_hours_json: loc.opening_hours_json || '',
    status: loc.status || 'draft',
    active_status: loc.active_status || 'activa',
    profile_control_status: loc.profile_control_status || 'directory',
    claim_verification_status: loc.claim_verification_status || 'pending',
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

function buildOrganizationProfileState(org, fallbackLocation) {
  const canonical = {
    public_display_name: clean(org?.public_display_name),
    public_description: clean(org?.public_description),
    public_phone: clean(org?.public_phone),
    public_email: clean(org?.public_email),
    website_url: clean(org?.website_url || org?.website),
    facebook_url: clean(org?.facebook_url),
    instagram_url: clean(org?.instagram_url),
    linkedin_url: clean(org?.linkedin_url),
    logo_url: clean(org?.logo_url),
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

  return { canonical, fallback, effective, sources, fallbackFields, missingFields };
}

const CLAIM_STATUS_MESSAGES = {
  in_asteptare: 'Solicitarea este in verificare. Poti pregati datele profilului intre timp.',
  needs_more_info: 'Avem nevoie de cateva completari pentru solicitarea ta.',
  aprobata: 'Revendicarea a fost aprobata. Workspace-ul furnizorului este disponibil.',
  respinsa: 'Revendicarea a fost respinsa.',
};

async function applicantOverview(svc, user, loc, claim) {
  const rawDrafts = await svc.entities.ProviderWorkspaceSubmission.filter({
    location_id: loc.id,
    claim_request_id: claim.id,
    submitted_by_user_id: user.id,
    access_origin: 'claim_preparation',
  }, '-created_date', 50);
  const drafts = rawDrafts.filter((submission) => !submission.preparation_locked_at && submission.preparation_lock_reason !== 'claim_rejected');
  const locationNames = { [loc.id]: loc.public_display_name || loc.name || 'Locatie' };
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
    location: safeLocationSummary(loc),
    preparation_drafts: drafts.map((submission) => sanitizeSubmission(submission, locationNames)),
    pending_submissions: drafts.map((submission) => sanitizeSubmission(submission, locationNames)),
    recent_submissions: drafts.map((submission) => sanitizeSubmission(submission, locationNames)),
    allowed_sections: CLAIM_PREP_ALLOWED_SECTIONS,
    public_preview: {
      display_name: loc.public_display_name || loc.name,
      address: loc.address || '',
      city: loc.city || loc.locality_name || '',
      county: loc.county || loc.county_name || '',
      photo_url: loc.photo_url || '',
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

    const loc = await svc.entities.ProviderLocation.get(payload.location_id).catch(() => null);
    if (!loc) return Response.json({ error: 'Locatia nu a fost gasita' }, { status: 404 });
    if (!hasProviderAccess) return Response.json(await applicantOverview(svc, user, loc, activeClaim));

    const org = loc.organization_id ? await svc.entities.ProviderOrganization.get(loc.organization_id).catch(() => null) : null;
    if (user.role === 'admin') {
      ownMemberships = await svc.entities.ProviderMembership.filter({ location_id: loc.id, status: 'active' }, '-created_date', 20);
    } else {
      ownMemberships = await svc.entities.ProviderMembership.filter({ user_id: user.id, status: 'active' }, '-created_date', 200);
    }

    const permittedLocations = [];
    for (const membership of ownMemberships) {
      if (!normalizeMemberRole(membership.role) || !membership.location_id) continue;
      const candidate = await svc.entities.ProviderLocation.get(membership.location_id).catch(() => null);
      if (!candidate) continue;
      if (loc.organization_id ? candidate.organization_id === loc.organization_id : candidate.id === loc.id) permittedLocations.push(candidate);
    }
    if (!permittedLocations.some((candidate) => candidate.id === loc.id)) permittedLocations.push(loc);
    const uniqueLocations = [...new Map(permittedLocations.map((candidate) => [candidate.id, candidate])).values()];
    const permittedLocationIds = uniqueLocations.map((candidate) => candidate.id);
    const locationNames = Object.fromEntries(uniqueLocations.map((candidate) => [candidate.id, candidate.public_display_name || candidate.name || 'Locatie']));

    const activeRows = [];
    if (org) {
      activeRows.push(...await svc.entities.ProviderWorkspaceSubmission.filter({
        organization_id: org.id,
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
    if (org) {
      recentRows.push(...await svc.entities.ProviderWorkspaceSubmission.filter({ organization_id: org.id }, '-updated_date', 100));
    }
    for (const candidate of uniqueLocations) {
      recentRows.push(...await svc.entities.ProviderWorkspaceSubmission.filter({ location_id: candidate.id }, '-updated_date', 50));
    }
    const recentSubs = dedupeSubmissions(recentRows)
      .filter((submission) => submission.access_origin === 'provider_workspace')
      .filter((submission) => submission.section === 'public_profile' || permittedLocationIds.includes(submission.location_id))
      .sort((a, b) => submissionTimestamp(b) - submissionTimestamp(a))
      .slice(0, 20);

    const reviewedSubs = recentSubs.filter((submission) => ['needs_more_info', 'rejected', 'approved'].includes(submission.status));
    const latestReview = reviewedSubs[0] || null;
    const completion = org ? computeOrganizationCompleteness(org, uniqueLocations) : computeLocationCompleteness(loc);
    const contentSummary = await getAggregateContentSummary(svc, uniqueLocations, user.id);
    const memberSummary = await getMemberSummary(svc, user.id, loc.id);

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
      id: org?.id || null,
      name: org?.name || loc.name,
      legal_name: org?.legal_name || '',
      organization_type: org?.organization_type || loc.provider_profile_type || '',
      public_display_name: org?.public_display_name || '',
      public_description: org?.public_description || '',
      public_phone: org?.public_phone || '',
      public_email: org?.public_email || '',
      website_url: org?.website_url || org?.website || '',
      facebook_url: org?.facebook_url || '',
      instagram_url: org?.instagram_url || '',
      linkedin_url: org?.linkedin_url || '',
      logo_url: org?.logo_url || '',
      profile_completeness: completion.percentage,
      public_visibility_status: org?.public_visibility_status || 'draft',
      status: org?.status || 'activa',
    };

    const activeLocations = uniqueLocations.filter((candidate) => candidate.active_status !== 'inactiva' && candidate.status !== 'suspendata');
    const verifiedLocationCount = activeLocations.filter((candidate) => candidate.profile_control_status === 'verified').length;
    const verificationStatus = activeLocations.length > 0 && verifiedLocationCount === activeLocations.length
      ? 'all_verified'
      : verifiedLocationCount > 0
        ? 'partially_verified'
        : 'unverified';
    const fallbackLocation = activeLocations[0] || uniqueLocations[0] || loc;
    const organizationProfileState = buildOrganizationProfileState(org, fallbackLocation);

    return Response.json({
      mode: 'provider_workspace',
      organization: organizationPublic,
      organization_profile_uses_location_fallback: organizationProfileState.fallbackFields.length > 0,
      organization_profile_sources: organizationProfileState.sources,
      organization_profile_fallback_fields: organizationProfileState.fallbackFields,
      organization_profile_missing_fields: organizationProfileState.missingFields,
      organization_summary: {
        location_count: uniqueLocations.length,
        active_location_count: activeLocations.length,
        verified_location_count: verifiedLocationCount,
        verification_status: verificationStatus,
        public_profile_status: organizationPublic.public_visibility_status,
        profile_completeness: completion.percentage,
      },
      location: safeLocationSummary(loc),
      locations: uniqueLocations.map(safeLocationSummary),
      completion,
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
        display_name: organizationProfileState.effective.public_display_name || org?.name || loc.name,
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
