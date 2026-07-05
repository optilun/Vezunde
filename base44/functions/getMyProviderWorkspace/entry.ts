import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// MODULE 3H.1C.1 — Provider Workspace read model.
// Returns ONLY data the authenticated user is permitted to manage (active
// ProviderMembership). No internal trust, audit or source-provenance fields
// leak. A patient-only account gets an empty workspace — no provider data.

const ALLOWED_SECTIONS = ['public_profile', 'location_details', 'operating_hours', 'services', 'team', 'media', 'article'];

// MODULE 3H.1C.1 Part 5 — deterministic V1 completeness checklist.
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
  const activeStatuses = ['draft', 'pending_review', 'needs_more_info'];
  const submissions = await svc.entities.ProviderWorkspaceSubmission.filter({ location_id: locationId, status: { $in: activeStatuses } }, '-created_date', 50);
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
    phone_public: loc.phone_public || loc.public_phone || '',
    public_email: loc.public_email || '',
    website: loc.website_url || loc.website || '',
    facebook_url: loc.facebook_url || '',
    instagram_url: loc.instagram_url || '',
    linkedin_url: loc.linkedin_url || '',
    opening_hours: loc.opening_hours || '',
    saturday_hours: loc.saturday_hours || '',
    availability_status: loc.availability_status || 'necunoscuta',
    status: loc.status || 'draft',
    profile_control_status: loc.profile_control_status || 'directory',
    claim_verification_status: loc.claim_verification_status || 'none',
    profile_completeness: computeCompleteness(loc),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    const svc = base44.asServiceRole;

    const memberships = await svc.entities.ProviderMembership.filter({
      user_id: user.id, status: 'active',
    });

    if (memberships.length === 0) {
      return Response.json({
        user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
        memberships: [],
        organizations: [],
        locations: [],
        pending_review_count: 0,
        allowed_sections: [],
      });
    }

    // Load locations + organizations individually (providers typically have 1-5).
    const locMap = new Map();
    const orgMap = new Map();
    for (const m of memberships) {
      if (m.location_id && !locMap.has(m.location_id)) {
        const loc = await svc.entities.ProviderLocation.get(m.location_id).catch(() => null);
        if (loc) locMap.set(loc.id, loc);
      }
      if (m.organization_id && !orgMap.has(m.organization_id)) {
        const org = await svc.entities.ProviderOrganization.get(m.organization_id).catch(() => null);
        if (org) orgMap.set(org.id, org);
      }
    }

    // Count pending submissions across all permitted locations.
    let pendingReviewCount = 0;
    for (const locId of locMap.keys()) {
      const subs = await svc.entities.ProviderWorkspaceSubmission.filter({
        location_id: locId,
        status: { $in: ['draft', 'pending_review', 'needs_more_info'] },
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
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
      memberships: membershipData,
      organizations: [...orgMap.values()].map((o) => ({ id: o.id, name: o.name, organization_type: o.organization_type })),
      locations: [...locMap.values()].map((loc) => ({ ...sanitizeLocation(loc, loc.organization_id ? orgMap.get(loc.organization_id)?.name : null), content_summary: contentSummaries.get(loc.id) })),
      pending_review_count: pendingReviewCount,
      allowed_sections: ALLOWED_SECTIONS,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});