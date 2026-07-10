import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  isServicePubliclyEligible,
  normalizeServiceKey,
} from '../../../shared/canonicalServiceRegistry.js';

// Read-only locality browse. It does not score or match by service.
const PATIENT_FACING_PROFILE_TYPES = [
  'independent_optical_store',
  'optical_chain',
  'ophthalmology_clinic',
  'ophthalmology_office',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));

    const sirutaCode = String(payload.locality_siruta_code || '').trim();
    const city = String(payload.city || '').trim();
    const providerTypes = Array.isArray(payload.provider_types) ? payload.provider_types : [];
    const limit = Math.min(payload.limit || 20, 50);

    if (!sirutaCode && !city) return Response.json({ results: [] });

    const [locations, services] = await Promise.all([
      svc.entities.ProviderLocation.filter({ status: 'publicata' }, null, 500),
      svc.entities.LocationService.list(null, 2000),
    ]);

    const servicesByLocation = {};
    for (const service of services) {
      if (service.is_active === false) continue;
      if (!normalizeServiceKey(service.service_key).definition) continue;
      if (!servicesByLocation[service.location_id]) servicesByLocation[service.location_id] = [];
      servicesByLocation[service.location_id].push(service);
    }

    const results = [];
    for (const loc of locations) {
      if (loc.public_visibility_status !== 'approved') continue;
      if (loc.profile_control_status !== 'verified') continue;
      if (loc.active_status === 'inactiva') continue;
      if (!loc.provider_profile_type || !PATIENT_FACING_PROFILE_TYPES.includes(loc.provider_profile_type)) continue;
      if (providerTypes.length > 0 && !providerTypes.includes(loc.provider_type)) continue;

      if (sirutaCode) {
        if ((loc.locality_siruta_code || '') !== sirutaCode) continue;
      } else if (!loc.locality_siruta_code && city) {
        if (loc.city !== city) continue;
      } else {
        continue;
      }

      const hasPublicService = (servicesByLocation[loc.id] || []).some((service) => (
        !service.migration_review_required && isServicePubliclyEligible(service, loc)
      ));

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
        service_coverage_status: hasPublicService ? 'listed' : 'not_listed',
      });
      if (results.length >= limit) break;
    }

    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
