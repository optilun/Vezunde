import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Module 3E.1: public whitelist endpoint for the search location selector.
// Returns ONLY the list of cities that have publicly visible providers —
// never location records, provenance, trust or internal fields.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const locations = await svc.entities.ProviderLocation.filter({ status: 'publicata' }, null, 500);
    const cities = [...new Set(
      locations
        .filter((l) => l.active_status !== 'inactiva'
          && (l.profile_control_status || 'directory') !== 'suspended'
          // Module 3H.1A: B2B profiles never appear in patient search coverage.
          && !['optical_laboratory_b2b', 'future_b2b_distributor'].includes(l.provider_profile_type))
        .map((l) => l.city)
        .filter(Boolean)
    )].sort();
    return Response.json({ cities });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});