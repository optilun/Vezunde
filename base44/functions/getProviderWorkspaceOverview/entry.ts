import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ACTIVE_CLAIM_STATUSES = ['in_asteptare', 'needs_more_info'];
const ACTIVE_SUBMISSION_STATUSES = ['draft', 'pending_review', 'needs_more_info'];
const PROVIDER_ALLOWED_SECTIONS = ['public_profile', 'location_details', 'services', 'team', 'media', 'article'];
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

function parsePendingChanges(raw) {
  try { return raw ? JSON.parse(raw) : {}; } catch (_e) { return {}; }
}

function checklistResult(items) {
  const completed = items.filter((item) => item.done);
  return {
    percentage: items.length ? Math.round((completed.length / items.length) * 100) : 0,
    total_items: items.length,
    completed_count: completed.length,
    checklist: items.map((item) => ({ key: item.key, label: item.label, done: item.done, status: item.done ? 'complete' : 'missing' })),
  };
}

function computeOrganizationCompleteness(org, locations) {
  const hasContact = !!(String(org?.public_phone || '').trim() || String(org?.public_email || '').trim());
  const hasWeb = !!(
    String(org?.website_url || org?.website || '').trim()
    || String(org?.facebook_url || '').trim()
    || String(org?.instagram_url || '').trim()
    || String(org?.linkedin_url || '').trim()
  );
  return checklistResult([
    { key: 'identity', label: 'Numele public al organizatiei', done: !!String(org?.public_display_name || org?.name || '').trim() },
    { key: 'description', label: 'Descrierea organizatiei', done: !!String(org?.public_description || '').trim() },
    { key: 'public_contact', label: 'Telefon sau email general', done: hasContact },
    { key: 'web_presence', label: 'Website sau retele sociale', done: hasWeb },
    { key: 'logo', label: 'Logo-ul organizatiei', done: !!String(org?.logo_url || '').trim() },
    { key: 'locations', label: 'Cel putin o locatie activa', done: locations.some((loc) => loc.active_status !== 'inactiva' && loc.status !== 'suspendata') },
  ]);
}

function computeLocationCompleteness(loc) {
  return checklistResult([
    { key: 'identity', label: 'Identitatea locatiei', done: !!(loc.name && loc.provider_type && loc.provider_profile_type) },
    { key: 'locality', label: 'Localitatea canonica', done: !!loc.locality_siruta_code },
    { key: 'address', label: 'Adresa', done: !!String(loc.address || '').trim() },
    { key: 'public_contact', label: 'Telefon sau email public', done: !!(String(loc.phone_public || '').trim() || String(loc.public_phone || '').trim() || String(loc.public_email || '').trim()) },
    { key: 'opening_hours', label: 'Program de functionare', done: !!String(loc.opening_hours || '').trim() },
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

async function getLocationContentSummary(svc, locationId, userId) {
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
  const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
  return {
    approved_service_count: services.length + specialties.length,
    pending_service_review_count: pendingCount('services'),
    approved_public_team_count: team.length,
    pending_team_review_count: pendingCount('team'),
    approved_media_count: media.length,
    pending_media_review_count: pendingCount('media'),
    approved_published_article_count: articles.filter((article) => !!article.published_at).length,
    pending_article_review_count: pendingCount('article'),
    has_opening_hours: !!String(location?.opening_hours || '').trim(),
  };
}

async function getAggregateContentSummary(svc, locations, userId) {
  const summaries = [];
  for (const location of locations) summaries.push(await getLocationContentSummary(svc, location.id, userId));
  return summaries.reduce((total, summary) => ({
    approved_service_count: total.approved_service_count + summary.approved_service_count,
    pending_service_review_count: total.pending_service_review_count + summary.pending_service_review_count,
    approved_public_team_count: total.approved_public_team_count + summary.approved_public_team_count,
    pending_team_review_count: total.pending_team_review_count + summary.pending_team_review_count,
    approved_media_count: total.approved_media_count + summary.approved_media_count,
    pending_media_review_count: total.pending_media_review_count + summary.pending_media_review_count,
    approved_published_article_count: total.approved_published_article_count + summary.approved_published_article_count,
    pending_article_review_count: total.pending_article_review_count + summary.pending_article_review_count,
    locations_with_opening_hours: total.locations_with_opening_hours + (summary.has_opening_hours ? 1 : 0),
  }), {
    approved_service_count: 0,
    pending_service_review_count: 0,
    approved_public_team_count: 0,
    pending_team_review_count: 0,
    approved_media_count: 0,
    pending_media_review_count: 0,
    approved_published_article_count: 0,
    pending_article_review_count: 0,
    locations_with_opening_hours: 0,
  });
}

function safeLocationSummary(loc) {
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
    active_status: loc.active_status || 'activa',
    profile_control_status: loc.profile_control_status || 'directory',
    claim_verification_status: loc.claim_verification_status || 'pending',
    profile_completeness: computeLocationCompleteness(loc),
  };
}

function sanitizeSubmission(submission) {
  return {
    id: submission.id,
    organization_id: submission.organization_id || null,
    location_id: submission.location_id || null,
    section: submission.section,
    item_key: submission.item_key || '',
    access_origin: submission.access_origin || 'provider_workspace',
    status: submission.status,
    submitted_at: submission.submitted_at || null,
    reviewed_at: submission.reviewed_at || null,
    created_date: submission.created_date || null,
    updated_date: submission.updated_date || null,
  };
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
    preparation_drafts: drafts.map(sanitizeSubmission),
    pending_submissions: drafts.map(sanitizeSubmission),
    recent_submissions: drafts.map(sanitizeSubmission),
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

    const organizationPending = org ? await svc.entities.ProviderWorkspaceSubmission.filter({
      organization_id: org.id,
      section: 'public_profile',
      access_origin: 'provider_workspace',
      status: { $in: ACTIVE_SUBMISSION_STATUSES },
    }, '-created_date', 50) : [];
    const locationPending = await svc.entities.ProviderWorkspaceSubmission.filter({
      location_id: loc.id,
      access_origin: 'provider_workspace',
      status: { $in: ACTIVE_SUBMISSION_STATUSES },
    }, '-created_date', 50);
    const pendingSubs = [...organizationPending, ...locationPending]
      .filter((submission, index, rows) => rows.findIndex((item) => item.id === submission.id) === index)
      .filter((submission) => !submission.claim_request_id || submission.submitted_by_user_id === user.id);

    const recentRaw = org
      ? await svc.entities.ProviderWorkspaceSubmission.filter({ organization_id: org.id }, '-updated_date', 30)
      : await svc.entities.ProviderWorkspaceSubmission.filter({ location_id: loc.id }, '-updated_date', 30);
    const recentSubs = recentRaw
      .filter((submission) => submission.section === 'public_profile' || permittedLocationIds.includes(submission.location_id))
      .filter((submission) => submission.submitted_by_user_id === user.id)
      .slice(0, 8);

    const reviewedSubs = recentSubs.filter((submission) => ['needs_more_info', 'rejected', 'approved'].includes(submission.status));
    const latestReview = reviewedSubs[0] || null;
    const completion = org ? computeOrganizationCompleteness(org, uniqueLocations) : computeLocationCompleteness(loc);
    const contentSummary = await getAggregateContentSummary(svc, uniqueLocations, user.id);
    const memberSummary = await getMemberSummary(svc, user.id, loc.id);
    const pendingChanges = parsePendingChanges(loc.pending_changes);
    const pendingFields = pendingChanges.fields || {};
    const pendingLogoUrl = typeof pendingFields.photo_url === 'string' ? pendingFields.photo_url : '';

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
      public_visibility_status: org?.public_visibility_status || 'draft',
      status: org?.status || 'activa',
    };
    const usingLocationFallback = !!org && !(
      organizationPublic.public_display_name
      || organizationPublic.public_description
      || organizationPublic.public_phone
      || organizationPublic.public_email
      || organizationPublic.website_url
      || organizationPublic.logo_url
    );

    return Response.json({
      mode: 'provider_workspace',
      organization: organizationPublic,
      organization_profile_uses_location_fallback: usingLocationFallback,
      organization_summary: {
        location_count: uniqueLocations.length,
        active_location_count: uniqueLocations.filter((candidate) => candidate.active_status !== 'inactiva' && candidate.status !== 'suspendata').length,
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
        has_pending_changes: !!loc.pending_changes,
        has_pending_logo: !!pendingLogoUrl,
        pending_logo_url: pendingLogoUrl,
        media_review: pendingChanges.media_review || {},
      },
      pending_submissions: pendingSubs.map((submission) => submission.submitted_by_user_id === user.id ? sanitizeSubmission(submission) : ({
        conflict: true,
        section: submission.section,
        status: submission.status,
        message: 'Exista deja o modificare in lucru pentru aceasta sectiune.',
      })),
      recent_submissions: recentSubs.map(sanitizeSubmission),
      ...(latestReview ? {
        latest_admin_note: latestReview.admin_note || '',
        latest_review_status: latestReview.status,
        latest_reviewed_at: latestReview.reviewed_at || null,
      } : {}),
      public_preview: {
        display_name: organizationPublic.public_display_name || loc.public_display_name || org?.name || loc.name,
        description: organizationPublic.public_description || loc.public_description || loc.description || '',
        phone: organizationPublic.public_phone || loc.public_phone || loc.phone_public || '',
        email: organizationPublic.public_email || loc.public_email || '',
        website: organizationPublic.website_url || loc.website_url || loc.website || '',
        facebook: organizationPublic.facebook_url || loc.facebook_url || '',
        instagram: organizationPublic.instagram_url || loc.instagram_url || '',
        linkedin: organizationPublic.linkedin_url || loc.linkedin_url || '',
        photo_url: organizationPublic.logo_url || loc.photo_url || '',
      },
      allowed_sections: PROVIDER_ALLOWED_SECTIONS,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});