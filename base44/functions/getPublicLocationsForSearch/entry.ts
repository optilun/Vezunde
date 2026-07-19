import { loadAllPublicLocationsByCounty } from '../../../shared/locationScopedEntityQuery.js';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Module 3E.1: public whitelist endpoint for the search location selector.
// Returns ONLY the list of cities that have publicly visible providers —
// never location records, provenance, trust or internal fields.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const locations = await loadAllPublicLocationsByCounty(svc);
    const cities = [...new Set(
      locations
        .filter((l) => l.active_status !== 'inactiva'
          && (l.profile_control_status || 'directory') !== 'suspended'
          // Module 3H.1A.1: fail closed — missing classification or B2B profile
          // types never appear in patient search coverage.
          && !!l.provider_profile_type
          && !['optical_laboratory_b2b', 'future_b2b_distributor'].includes(l.provider_profile_type))
        .map((l) => l.locality_name || l.city)
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'ro'));
    return Response.json({ cities, query_scope: 'county_partitions' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
