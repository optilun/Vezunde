import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// MODULE 3H.1C.2 — Public approved content read.
// Returns only approved/published services, team, media and articles. Drafts,
// rejected items, storage references under review, admin notes and submission
// metadata are never returned.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    if (!p.location_id) return Response.json({ error: 'location_id este obligatoriu' }, { status: 400 });

    const loc = await svc.entities.ProviderLocation.get(p.location_id).catch(() => null);
    if (!loc || loc.status === 'suspendata' || loc.profile_control_status === 'suspended') {
      return Response.json({ services: [], team: [], media: [], articles: [] });
    }

    const services = await svc.entities.LocationService.filter({ location_id: p.location_id, is_active: true }, 'service_key', 200);
    const specializations = await svc.entities.LocationSpecialization.filter({ location_id: p.location_id, is_active: true }, 'specialization_key', 100);
    const assignments = await svc.entities.ProfessionalLocationAssignment.filter({ location_id: p.location_id, active_status: 'activ', public_status: 'public' }, 'created_date', 100);
    const media = await svc.entities.ProviderMediaAsset.filter({ location_id: p.location_id, status: 'approved' }, 'sort_order', 100);
    const articles = await svc.entities.ProviderArticle.filter({ location_id: p.location_id, status: 'approved' }, '-published_at', 50);

    const team = [];
    for (const assignment of assignments) {
      const prof = await svc.entities.ProfessionalProfile.get(assignment.professional_id).catch(() => null);
      if (prof && prof.is_public !== false && prof.public_visibility_status !== 'rejected' && prof.public_visibility_status !== 'archived') {
        team.push({
          id: prof.id,
          full_name: prof.public_display_name || prof.full_name,
          professional_type: prof.professional_type || assignment.professional_type,
          public_title: prof.role || '',
          short_bio: prof.professional_bio || prof.bio || '',
          profile_photo_url: prof.profile_photo_url || '',
        });
      }
    }

    return Response.json({
      services: services.map((s) => ({ service_key: s.service_key, service_need_level: s.service_need_level || 'general' })),
      specialties: specializations.map((s) => ({ specialization_key: s.specialization_key })),
      team,
      media: media.map((m) => ({
        id: m.id,
        storage_reference: m.storage_reference,
        media_type: m.media_type,
        caption: m.caption || '',
        alt_text: m.alt_text || '',
        sort_order: m.sort_order || 0,
      })),
      articles: articles.filter((a) => !!a.published_at).map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        excerpt: a.excerpt || '',
        cover_media_id: a.cover_media_id || null,
        published_at: a.published_at,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});