import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// MODULE 3H.1C.2B — Public approved content read.
// Reuses getPublicProviderProfile as the canonical public eligibility gate and
// service visibility source. Never returns drafts, raw storage keys, admin notes,
// owner ids, review metadata or private contact data.

async function safeSignedMediaUrl(svc, storageReference) {
  const ref = String(storageReference || '').trim();
  if (!ref) return '';
  const signed = await svc.integrations.Core.CreateFileSignedUrl({ file_uri: ref, expires_in: 300 }).catch(() => null);
  const url = signed?.signed_url || '';
  return typeof url === 'string' && url.startsWith('https://') ? url : '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    if (!p.location_id) return Response.json({ error: 'location_id este obligatoriu' }, { status: 400 });

    // Canonical public eligibility + service filtering comes from the existing
    // public profile endpoint. Failure returns empty content without disclosing why.
    const profileRes = await base44.functions.invoke('getPublicProviderProfile', { location_id: p.location_id }).catch(() => null);
    const publicProfile = profileRes?.data?.profile || null;
    if (!publicProfile?.id) return Response.json({ services: [], specialties: [], team: [], media: [], articles: [] });

    const locationId = publicProfile.id;
    const [assignments, mediaAssets, articles] = await Promise.all([
      svc.entities.ProfessionalLocationAssignment.filter({ location_id: locationId, active_status: 'activ', public_status: 'public' }, 'created_date', 100),
      svc.entities.ProviderMediaAsset.filter({ location_id: locationId, status: 'approved' }, 'sort_order', 100),
      svc.entities.ProviderArticle.filter({ location_id: locationId, status: 'approved' }, '-published_at', 50),
    ]);

    const mediaById = {};
    const publicMedia = [];
    for (const asset of mediaAssets) {
      const publicUrl = await safeSignedMediaUrl(svc, asset.storage_reference);
      if (!publicUrl) continue;
      const safe = {
        id: asset.id,
        url: publicUrl,
        media_type: asset.media_type,
        caption: asset.caption || '',
        alt_text: asset.alt_text || '',
        sort_order: asset.sort_order || 0,
      };
      mediaById[asset.id] = safe;
      publicMedia.push(safe);
    }

    const team = [];
    for (const assignment of assignments) {
      const prof = await svc.entities.ProfessionalProfile.get(assignment.professional_id).catch(() => null);
      if (!prof || prof.is_public === false || prof.public_visibility_status === 'rejected' || prof.public_visibility_status === 'archived') continue;
      const photo = prof.profile_photo_url && mediaById[prof.profile_photo_url]?.media_type === 'team_photo'
        ? mediaById[prof.profile_photo_url].url
        : '';
      team.push({
        id: prof.id,
        full_name: prof.public_display_name || prof.full_name,
        professional_type: prof.professional_type || assignment.professional_type,
        public_title: prof.role || '',
        short_bio: prof.professional_bio || prof.bio || '',
        profile_photo_url: photo,
        affiliation_status: assignment.affiliation_status || 'location_added',
      });
    }

    const publicArticles = articles
      .filter((a) => !!a.published_at)
      .map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        excerpt: a.excerpt || '',
        body: a.body || '',
        cover_media_url: a.cover_media_id && mediaById[a.cover_media_id] ? mediaById[a.cover_media_id].url : '',
        published_at: a.published_at,
      }));

    return Response.json({
      services: (publicProfile.services || []).map((service_key) => ({ service_key })),
      specialties: [],
      team,
      media: publicMedia,
      articles: publicArticles,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});