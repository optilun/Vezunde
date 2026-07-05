import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// MODULE 3H.1C.1/3 — Single-location workspace overview.
// Provider members get the full provider overview. Pending claimants get only
// their own claim status, safe location summary and private preparation drafts.

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

async function getMemberSummary(svc, userId, locationId) {
  const ownMemberships = await svc.entities.ProviderMembership.filter({ user_id: userId, location_id: locationId, status: 'active' }, '-created_date', 20);
  const currentRole = highestRole(ownMemberships.map((m) => normalizeMemberRole(m.role)));
  const canManageMembers = ['organization_owner', 'location_manager'].includes(currentRole);
  const activeRows = await svc.entities.ProviderMembership.filter({ location_id: locationId, status: 'active' }, '-created_date', 200);
  const validRows = activeRows.filter((m) => normalizeMemberRole(m.role));
  const pendingInvitations = await svc.entities.ProviderMemberInvitation.filter({ status: 'pending' }, '-created_date', 200).catch(() => []);
  const pendingInvitationCount = pendingInvitations.filter((inv) => invitationLocIds(inv).includes(locationId)).length;
  return {
    current_user_role: currentRole,
    assigned_locations: currentRole ? [locationId] : [],
    can_manage_members: canManageMembers,
    active_member_count: [...new Set(validRows.map((m) => m.user_id))].length,
    pending_invitation_count: pendingInvitationCount,
  };
}

const CLAIM_STATUS_MESSAGES = {
  in_asteptare: 'Solicitarea este in verificare. Poti pregati datele profilului intre timp.',
  needs_more_info: 'Avem nevoie de cateva completari pentru solicitarea ta.',
  aprobata: 'Revendicarea a fost aprobata. Workspace-ul furnizorului este disponibil.',
  respinsa: 'Revendicarea a fost respinsa.',
};

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

async function getContentSummary(svc, locationId, userId) {
  const rawSubmissions = await svc.entities.ProviderWorkspaceSubmission.filter({ location_id: locationId, access_origin: 'provider_workspace', status: { $in: ACTIVE_SUBMISSION_STATUSES } }, '-created_date', 50);
  const submissions = rawSubmissions.filter((s) => !s.claim_request_id || s.submitted_by_user_id === userId);
  const services = await svc.entities.LocationService.filter({ location_id: locationId, is_active: true });
  const specialties = await svc.entities.LocationSpecialization.filter({ location_id: locationId, is_active: true });
  const team = await svc.entities.ProfessionalLocationAssignment.filter({ location_id: locationId, active_status: 'activ', public_status: 'public' });
  const media = await svc.entities.ProviderMediaAsset.filter({ location_id: locationId, status: 'approved' });
  const articles = await svc.entities.ProviderArticle.filter({ location_id: locationId, status: 'approved' });
  const pendingCount = (section) => submissions.filter((s) => s.section === section).length;
  return {
    approved_service_count: services.length + specialties.length,
    pending_service_review_count: pendingCount('services'),
    approved_public_team_count: team.length,
    pending_team_review_count: pendingCount('team'),
    approved_media_count: media.length,
    pending_media_review_count: pendingCount('media'),
    approved_published_article_count: articles.filter((a) => !!a.published_at).length,
    pending_article_review_count: pendingCount('article'),
  };
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

async function applicantOverview(svc, user, loc, claim) {
  const rawDrafts = await svc.entities.ProviderWorkspaceSubmission.filter({
    location_id: loc.id,
    claim_request_id: claim.id,
    submitted_by_user_id: user.id,
    access_origin: 'claim_preparation',
  }, '-created_date', 50);
  const drafts = rawDrafts.filter((s) => !s.preparation_locked_at && s.preparation_lock_reason !== 'claim_rejected');
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
    preparation_drafts: drafts.map(sanitizePreparationDraft),
    pending_submissions: drafts.map(sanitizePreparationDraft),
    allowed_sections: CLAIM_PREP_ALLOWED_SECTIONS,
    public_preview: {
      display_name: loc.public_display_name || loc.name,
      address: loc.address || '',
      city: loc.city || loc.locality_name || '',
      county: loc.county || loc.county_name || '',
    },
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));

    if (!p.location_id) return Response.json({ error: 'location_id este obligatoriu' }, { status: 400 });

    let hasProviderAccess = user.role === 'admin';
    let activeClaim = null;
    if (!hasProviderAccess) {
      const memberships = await svc.entities.ProviderMembership.filter({
        user_id: user.id, location_id: p.location_id, status: 'active',
      });
      hasProviderAccess = memberships.some((m) => normalizeMemberRole(m.role));
      if (!hasProviderAccess) {
        const claims = await svc.entities.ProviderClaimRequest.filter({
          user_id: user.id,
          location_id: p.location_id,
          status: { $in: ACTIVE_CLAIM_STATUSES },
        }, '-created_date', 5);
        activeClaim = claims[0] || null;
        if (!activeClaim) return Response.json({ error: 'Nu ai acces la aceasta locatie' }, { status: 403 });
      }
    }

    const loc = await svc.entities.ProviderLocation.get(p.location_id).catch(() => null);
    if (!loc) return Response.json({ error: 'Locatia nu a fost gasita' }, { status: 404 });

    if (!hasProviderAccess) return Response.json(await applicantOverview(svc, user, loc, activeClaim));

    let orgName = null;
    if (loc.organization_id) {
      const org = await svc.entities.ProviderOrganization.get(loc.organization_id).catch(() => null);
      orgName = org?.name || null;
    }

    const rawPendingSubs = await svc.entities.ProviderWorkspaceSubmission.filter({
      location_id: p.location_id,
      access_origin: 'provider_workspace',
      status: { $in: ACTIVE_SUBMISSION_STATUSES },
    }, '-created_date', 50);
    const pendingSubs = rawPendingSubs.filter((s) => !s.claim_request_id || s.submitted_by_user_id === user.id);

    const reviewedSubs = await svc.entities.ProviderWorkspaceSubmission.filter({
      location_id: p.location_id,
      status: { $in: ['needs_more_info', 'rejected', 'approved'] },
    }, '-reviewed_at', 10);
    const latestReview = reviewedSubs[0] || null;

    const completeness = computeCompleteness(loc);
    const contentSummary = await getContentSummary(svc, p.location_id, user.id);
    const ownLatestReview = latestReview?.submitted_by_user_id === user.id ? latestReview : null;
    const memberSummary = await getMemberSummary(svc, user.id, p.location_id);

    return Response.json({
      mode: 'provider_workspace',
      location: {
        id: loc.id,
        name: loc.name,
        provider_type: loc.provider_type,
        provider_profile_type: loc.provider_profile_type,
        organization_id: loc.organization_id || null,
        organization_name: orgName,
        public_display_name: loc.public_display_name || '',
        status: loc.status || 'draft',
        profile_control_status: loc.profile_control_status || 'directory',
        claim_verification_status: loc.claim_verification_status || 'none',
      },
      completion: {
        percentage: completeness.percentage,
        total_items: completeness.total_items,
        completed_count: completeness.completed_count,
        checklist: [...completeness.completed, ...completeness.missing],
      },
      content_summary: contentSummary,
      member_summary: memberSummary,
      current_user_role: memberSummary.current_user_role,
      assigned_locations: memberSummary.assigned_locations,
      can_manage_members: memberSummary.can_manage_members,
      active_member_count: memberSummary.active_member_count,
      pending_invitation_count: memberSummary.pending_invitation_count,
      pending_submissions: pendingSubs.map((s) => s.submitted_by_user_id === user.id ? ({
        id: s.id,
        section: s.section,
        item_key: s.item_key || '',
        access_origin: s.access_origin || 'provider_workspace',
        status: s.status,
        submitted_at: s.submitted_at || null,
      }) : ({
        conflict: true,
        section: s.section,
        status: s.status,
        message: 'Exista deja o modificare in lucru pentru aceasta sectiune.',
      })),
      ...(ownLatestReview ? {
        latest_admin_note: ownLatestReview.admin_note || '',
        latest_review_status: ownLatestReview.status,
        latest_reviewed_at: ownLatestReview.reviewed_at || null,
      } : {}),
      public_preview: {
        display_name: loc.public_display_name || loc.name,
        description: loc.public_description || loc.description || '',
        address: loc.address || '',
        city: loc.city || loc.locality_name || '',
        county: loc.county || loc.county_name || '',
        phone: loc.public_phone || loc.phone_public || '',
        email: loc.public_email || '',
        website: loc.website_url || loc.website || '',
        facebook: loc.facebook_url || '',
        instagram: loc.instagram_url || '',
        linkedin: loc.linkedin_url || '',
        opening_hours: loc.opening_hours || '',
        saturday_hours: loc.saturday_hours || '',
      },
      allowed_sections: PROVIDER_ALLOWED_SECTIONS,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});