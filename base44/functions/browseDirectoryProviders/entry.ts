import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Separate, read-only general directory browse — used ONLY for locality-only
// searches with no service_keys selected. Never used for service/need matching
// (that remains exclusively matchProviders, unchanged). Does not query
// LocationService as an eligibility filter, does not score, does not rank,
// does not return Top 3 or medical recommendations.

const B2B_PROFILE_TYPES = ['optical_laboratory_b2b', 'future_b2b_distributor'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));

    const sirutaCode = String(payload.locality_siruta_code || '').trim();
    const city = (payload.city || '').trim(); // temporary fallback only
    const providerTypes = Array.isArray(payload.provider_types) ? payload.provider_types : [];
    const limit = Math.min(payload.limit || 20, 50);

    if (!sirutaCode && !city) {
      return Response.json({ results: [] });
    }

    const [locations, services] = await Promise.all([
      svc.entities.ProviderLocation.filter({ status: 'publicata' }, null, 500),
      svc.entities.LocationService.list(null, 2000),
    ]);

    const hasServiceMap = {};
    for (const s of services) {
      if (s.is_active === false) continue;
      hasServiceMap[s.location_id] = true;
    }

    const results = [];
    for (const loc of locations) {
      if (loc.public_visibility_status !== 'approved') continue;
      if (loc.profile_control_status !== 'verified') continue;
      if (loc.active_status === 'inactiva') continue;
      if (!loc.provider_profile_type || B2B_PROFILE_TYPES.includes(loc.provider_profile_type)) continue;
      if (providerTypes.length > 0 && !providerTypes.includes(loc.provider_type)) continue;

      if (sirutaCode) {
        if ((loc.locality_siruta_code || '') !== sirutaCode) continue;
      } else if (!loc.locality_siruta_code && city) {
        // Fallback on city only when the profile has no canonical SIRUTA at all.
        if (loc.city !== city) continue;
      } else {
        continue;
      }

      results.push({
        id: loc.id,
        name: loc.name,
        provider_type: loc.provider_type,
        city: loc.city,
        county: loc.county || null,
        address: loc.address || null,
        phone: loc.phone_public || null,
        website: loc.website || null,
        opening_hours: loc.opening_hours || null,
        saturday_hours: loc.saturday_hours || null,
        profile_control_status: loc.profile_control_status,
        result_type: 'directory',
        is_match_eligible: false,
        service_coverage_status: hasServiceMap[loc.id] ? 'listed' : 'not_listed',
      });
      if (results.length >= limit) break;
    }

    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});