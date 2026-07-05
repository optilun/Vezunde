import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// MODULE 3H.1C.1 — Single-location workspace overview.
// Provider-scoped: membership verified before any data is returned.
// Returns a preview-safe public profile summary + deterministic completeness.

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));

    if (!p.location_id) return Response.json({ error: 'location_id este obligatoriu' }, { status: 400 });

    // Verify membership (admin bypasses — admin can view any location).
    if (user.role !== 'admin') {
      const memberships = await svc.entities.ProviderMembership.filter({
        user_id: user.id, location_id: p.location_id, status: 'active',
      });
      if (memberships.length === 0) {
        return Response.json({ error: 'Nu ai acces la aceasta locatie' }, { status: 403 });
      }
    }

    const loc = await svc.entities.ProviderLocation.get(p.location_id).catch(() => null);
    if (!loc) return Response.json({ error: 'Locatia nu a fost gasita' }, { status: 404 });

    let orgName = null;
    if (loc.organization_id) {
      const org = await svc.entities.ProviderOrganization.get(loc.organization_id).catch(() => null);
      orgName = org?.name || null;
    }

    // Pending submissions for this location.
    const pendingSubs = await svc.entities.ProviderWorkspaceSubmission.filter({
      location_id: p.location_id,
      status: { $in: ['draft', 'pending_review', 'needs_more_info'] },
    }, '-created_date', 50);

    // Latest admin review note (from needs_more_info / rejected / approved).
    const reviewedSubs = await svc.entities.ProviderWorkspaceSubmission.filter({
      location_id: p.location_id,
      status: { $in: ['needs_more_info', 'rejected', 'approved'] },
    }, '-reviewed_at', 10);
    const latestReview = reviewedSubs[0] || null;

    const completeness = computeCompleteness(loc);

    return Response.json({
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
      pending_submissions: pendingSubs.map((s) => ({
        id: s.id,
        section: s.section,
        status: s.status,
        submitted_at: s.submitted_at || null,
      })),
      latest_admin_note: latestReview?.admin_note || null,
      latest_review_status: latestReview?.status || null,
      latest_reviewed_at: latestReview?.reviewed_at || null,
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
      allowed_sections: ['public_profile', 'location_details', 'operating_hours'],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});