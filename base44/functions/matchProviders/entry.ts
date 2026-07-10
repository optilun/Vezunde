import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  getCanonicalServiceDefinition,
  isServiceMatchingEligible,
  isServicePubliclyEligible,
  normalizeServiceKey,
} from '../../../shared/canonicalServiceRegistry.js';

// Safety rules remain disabled until reviewed by a qualified ophthalmologist.
const SAFETY_RULES = [
  { key: 'urgent_care_notice', enabled: false },
  { key: 'no_diagnosis_notice', enabled: false },
  { key: 'repair_no_guarantee', enabled: false },
  { key: 'child_under_3', enabled: false },
];

const AVAILABILITY_LABELS = {
  astazi: 'Primeste clienti fara programare',
  urmatoarele_zile: 'Primeste clienti si cu programare',
  saptamana_aceasta: 'Walk-in pentru optica, programare pentru consultatii',
  doar_programare: 'Doar cu programare',
};
const AVAILABILITY_STALE_DAYS = 30;

const FACILITY_REASONS = {
  laborator_optic_propriu: 'Are laborator optic propriu',
  atelier_service_propriu: 'Are atelier de service propriu',
  reparatii_pe_loc: 'Face reparatii pe loc',
  laborator_partener: 'Lucreaza cu laborator partener',
  montaj_lentile_in_locatie: 'Monteaza lentile in locatie',
};

const PATIENT_FACING_PROFILE_TYPES = [
  'independent_optical_store',
  'optical_chain',
  'ophthalmology_clinic',
  'ophthalmology_office',
];

const ROLE_CANONICAL = {
  medic_oftalmolog: 'ophthalmologist',
  ophthalmologist: 'ophthalmologist',
  optometrist: 'optometrist',
  optician: 'optician',
};

const OPHTHALMO_TYPES = ['clinica_oftalmologica', 'cabinet_oftalmologic'];
const OPTICAL_TYPES = ['optica_medicala', 'laborator_optic', 'cabinet_optometric'];
const REPAIR_FACILITIES = [
  'atelier_service_propriu',
  'reparatii_pe_loc',
  'laborator_optic_propriu',
  'laborator_partener',
  'montaj_lentile_in_locatie',
];
const FACILITY_INTENTS = ['reparatii_ochelari', 'ochelari_lentile', 'lentile_contact'];
const NEED_ORDER = { general: 0, technical: 1, specialized_medical: 2, unknown: 3 };

function needLevelOf(rawKey) {
  return getCanonicalServiceDefinition(rawKey)?.service_need_level || 'unknown';
}

function serviceNeedLevelOfRow(service) {
  const normalized = normalizeServiceKey(service?.service_key);
  if (!normalized.definition) return 'unknown';
  if (service.is_advanced_service || service.service_need_level === 'specialized_medical') {
    return 'specialized_medical';
  }
  if (service.service_need_level === 'technical' && normalized.definition.service_need_level === 'general') {
    return 'technical';
  }
  return normalized.definition.service_need_level;
}

function normalizeRequestKeys(rawKeys) {
  const canonicalKeys = [];
  const rawFallbackKeys = [];
  const statuses = [];
  for (const rawKey of rawKeys) {
    const normalized = normalizeServiceKey(rawKey);
    statuses.push(normalized.status);
    if (normalized.canonicalKey) canonicalKeys.push(normalized.canonicalKey);
    else rawFallbackKeys.push(String(rawKey || '').trim());
  }
  return {
    canonicalKeys: [...new Set(canonicalKeys.filter(Boolean))],
    rawFallbackKeys: [...new Set(rawFallbackKeys.filter(Boolean))],
    statuses,
  };
}

function rowMatchesRequest(service, request) {
  const rawKey = String(service?.service_key || '').trim();
  if (request.rawFallbackKeys.includes(rawKey)) return true;
  const normalized = normalizeServiceKey(rawKey);
  return Boolean(normalized.canonicalKey && request.canonicalKeys.includes(normalized.canonicalKey));
}

function isPublicSafeService(service, location) {
  if (service?.migration_review_required) return false;
  return isServicePubliclyEligible(service, location);
}

function toPublicService(service) {
  const normalized = normalizeServiceKey(service?.service_key);
  if (!normalized.definition || !normalized.canonicalKey) return null;
  return { key: normalized.canonicalKey, label: normalized.definition.label };
}

function requestNeedLevel(rawKeys, intent) {
  let level = intent === 'reparatii_ochelari' ? 'technical' : 'general';
  for (const rawKey of rawKeys) {
    const candidate = needLevelOf(rawKey);
    // Unknown and ambiguous request keys are fail-closed as medical.
    if (candidate === 'unknown') return 'specialized_medical';
    if (NEED_ORDER[candidate] > NEED_ORDER[level]) level = candidate;
  }
  return level;
}

function evaluateEligibility(loc, matchedRows, needLevel) {
  const pcs = loc.profile_control_status || 'directory';
  if (pcs === 'suspended') return { eligible: false, reasons: ['profile_suspended'], pcs, qualifying: [] };

  const reasons = [];
  if (loc.migration_review_required) reasons.push('migration_review_required');
  const requiredPcs = needLevel === 'specialized_medical' ? ['verified'] : ['claimed', 'verified'];
  if (!requiredPcs.includes(pcs)) {
    reasons.push(needLevel === 'specialized_medical' ? 'profile_not_verified' : 'profile_not_claimed_or_verified');
  }

  if (matchedRows.length === 0) {
    reasons.push('service_not_present');
  } else {
    const qualifying = matchedRows.filter((service) => (
      service.matching_allowed === true
      && !service.migration_review_required
      && isServiceMatchingEligible(service, loc)
    ));
    if (qualifying.length === 0) {
      if (!matchedRows.some((service) => service.matching_allowed === true)) reasons.push('matching_not_allowed');
      reasons.push(needLevel === 'specialized_medical' ? 'service_not_vezunde_verified' : 'service_not_confirmed');
    }
    if (reasons.length === 0) return { eligible: true, reasons: [], pcs, qualifying };
  }

  return { eligible: false, reasons, pcs, qualifying: [] };
}

function classifyMatchBucket(eligibility, matchedRows, needLevel, loc) {
  if (eligibility.eligible) return 'eligible';
  if (needLevel === 'specialized_medical' || eligibility.pcs === 'suspended') return 'excluded';
  if (matchedRows.length === 0) return 'excluded';

  const directorySafeRows = matchedRows.filter((service) => {
    const level = serviceNeedLevelOfRow(service);
    return level === 'general' || level === 'technical';
  });
  if (directorySafeRows.length === 0) return 'excluded';

  const directoryQualifies = needLevel === 'general' && directorySafeRows.some((service) => (
    service.matching_allowed === true
    && !service.migration_review_required
    && isServicePubliclyEligible(service, loc)
  ));
  if (eligibility.pcs === 'directory' && !directoryQualifies) return 'excluded';
  return 'extended_directory';
}

function hasCoordinates(value) {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function distanceKm(a, b) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const lat1 = Number(a.lat);
  const lng1 = Number(a.lng);
  const lat2 = Number(b.lat);
  const lng2 = Number(b.lng);
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 = Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(s1 + s2), Math.sqrt(1 - s1 - s2));
}

function defaultRadiusKm(loc) {
  if (Number.isFinite(Number(loc.service_radius_km)) && Number(loc.service_radius_km) > 0) {
    return Number(loc.service_radius_km);
  }
  const profileType = loc.provider_profile_type || '';
  if (profileType === 'ophthalmology_clinic') return 50;
  if (profileType === 'ophthalmology_office') return 35;
  if (profileType === 'independent_optical_store' || profileType === 'optical_chain') return 15;
  if (loc.provider_type === 'clinica_oftalmologica') return 50;
  if (loc.provider_type === 'cabinet_oftalmologic') return 35;
  return 20;
}

function serviceReason(rawKey) {
  const normalized = normalizeServiceKey(rawKey);
  return `Ofera ${normalized.definition?.label || rawKey}`;
}

function routingReason(entry) {
  if (Number.isFinite(entry.distance_km)) {
    return `La ${entry.distance_km.toFixed(1)} km de locatia ta, in perimetrul de ${Math.round(entry.service_radius_km)} km al locatiei.`;
  }
  if (entry.tier === 'oras') return 'Potrivire dupa localitatea selectata.';
  return 'Potrivire nationala, fara locatie exacta a clientului.';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));

    const intent = payload.intent || null;
    const serviceKeys = Array.isArray(payload.service_keys) ? payload.service_keys.map(String) : [];
    const requestKeys = normalizeRequestKeys(serviceKeys);
    const providerTypes = Array.isArray(payload.provider_types) ? payload.provider_types : [];
    const requiredRoles = Array.isArray(payload.required_professional_types)
      ? payload.required_professional_types.map((role) => ROLE_CANONICAL[role] || role)
      : [];
    const sirutaCode = String(payload.locality_siruta_code || '').trim();
    const city = String(payload.city || '').trim();
    const clientLocation = { lat: Number(payload.client_lat), lng: Number(payload.client_lng) };
    const hasClientCoords = hasCoordinates(clientLocation);
    const clientLocationSource = hasClientCoords ? (payload.client_location_source || 'browser') : '';
    const clientAddressText = String(payload.client_address_text || '').trim();
    const scope = payload.scope || (hasClientCoords ? 'nearby' : ((sirutaCode || city) ? 'city' : 'national'));
    const limit = Math.min(payload.limit || 20, 50);
    const needLevel = requestNeedLevel(serviceKeys, intent);

    const [locations, services, specializations, assignments, facilities] = await Promise.all([
      svc.entities.ProviderLocation.filter({ status: 'publicata' }, null, 500),
      svc.entities.LocationService.list(null, 2000),
      svc.entities.LocationSpecialization.list(null, 2000),
      svc.entities.ProfessionalLocationAssignment.filter({ active_status: 'activ' }, null, 2000),
      svc.entities.LocationFacility.list(null, 2000),
    ]);

    const serviceRowsByLocation = {};
    for (const service of services) {
      if (service.is_active === false) continue;
      if (!serviceRowsByLocation[service.location_id]) serviceRowsByLocation[service.location_id] = [];
      serviceRowsByLocation[service.location_id].push(service);
    }

    const specializationsByLocation = {};
    for (const specialization of specializations) {
      if (specialization.is_active === false) continue;
      if (!specializationsByLocation[specialization.location_id]) specializationsByLocation[specialization.location_id] = [];
      specializationsByLocation[specialization.location_id].push(specialization.specialization_key);
    }

    const rolesByLocation = {};
    for (const assignment of assignments) {
      if (!rolesByLocation[assignment.location_id]) rolesByLocation[assignment.location_id] = [];
      rolesByLocation[assignment.location_id].push(ROLE_CANONICAL[assignment.professional_type] || assignment.professional_type);
    }

    const facilitiesByLocation = {};
    for (const facility of facilities) {
      if (facility.is_active === false) continue;
      if (!facilitiesByLocation[facility.location_id]) facilitiesByLocation[facility.location_id] = [];
      facilitiesByLocation[facility.location_id].push(facility.facility_key);
    }

    const now = Date.now();
    const scored = [];
    const excludedList = [];

    for (const loc of locations) {
      if (loc.active_status === 'inactiva') continue;
      if (!loc.provider_profile_type || !PATIENT_FACING_PROFILE_TYPES.includes(loc.provider_profile_type)) continue;
      if (providerTypes.length > 0 && !providerTypes.includes(loc.provider_type)) continue;

      const locRows = serviceRowsByLocation[loc.id] || [];
      const roles = rolesByLocation[loc.id] || [];
      const locFacilities = facilitiesByLocation[loc.id] || [];
      const matchedRows = serviceKeys.length > 0
        ? locRows.filter((service) => rowMatchesRequest(service, requestKeys))
        : locRows;
      const matched = [...new Set(matchedRows.map((service) => normalizeServiceKey(service.service_key).canonicalKey).filter(Boolean))];

      if (intent === 'simptome_oftalmologice' || intent === 'investigatii') {
        if (!OPHTHALMO_TYPES.includes(loc.provider_type) && !roles.includes('ophthalmologist')) continue;
      }
      if (intent === 'reparatii_ochelari') {
        if (!OPTICAL_TYPES.includes(loc.provider_type)) continue;
        const hasRepairFacility = locFacilities.some((key) => REPAIR_FACILITIES.includes(key));
        if (matched.length === 0 && !hasRepairFacility) continue;
      } else if (serviceKeys.length > 0 && matchedRows.length === 0) {
        continue;
      }
      if (requiredRoles.length > 0 && !requiredRoles.some((role) => roles.includes(role))) continue;

      let tier = 'national';
      let distance_km = null;
      const radius = defaultRadiusKm(loc);
      if (hasClientCoords) {
        if (!hasCoordinates(loc)) continue;
        distance_km = distanceKm(clientLocation, loc);
        if (!Number.isFinite(distance_km) || distance_km > radius) continue;
        tier = 'apropiere';
      } else if (scope !== 'national') {
        if (sirutaCode) {
          if ((loc.locality_siruta_code || '') !== sirutaCode) continue;
        } else if (city) {
          if (loc.city !== city) continue;
        }
        tier = 'oras';
      }

      const locSpecs = specializationsByLocation[loc.id] || [];
      const specMatched = locSpecs.filter((key) => {
        const normalized = normalizeServiceKey(key);
        return normalized.canonicalKey && requestKeys.canonicalKeys.includes(normalized.canonicalKey);
      });
      const relevantFacilities = FACILITY_INTENTS.includes(intent)
        ? locFacilities.filter((key) => REPAIR_FACILITIES.includes(key))
        : [];

      let availabilityLabel = null;
      if (loc.availability_status && loc.availability_status !== 'necunoscuta' && loc.availability_updated_at) {
        const ageDays = (now - new Date(loc.availability_updated_at).getTime()) / 86400000;
        if (ageDays >= 0 && ageDays <= AVAILABILITY_STALE_DAYS) {
          availabilityLabel = AVAILABILITY_LABELS[loc.availability_status] || null;
        }
      }

      const eligibility = evaluateEligibility(loc, matchedRows, needLevel);
      const bucket = classifyMatchBucket(eligibility, matchedRows, needLevel, loc);
      const directoryMatchType = bucket === 'extended_directory' && serviceKeys.length > 0
        ? 'service_alias_match'
        : null;

      const safeMatchedRows = matchedRows.filter((service) => isPublicSafeService(service, loc));
      const safeLocRows = locRows.filter((service) => isPublicSafeService(service, loc));
      let score = matched.length * 3 + specMatched.length * 2 + Math.min(relevantFacilities.length, 2);
      const reasons = safeMatchedRows.slice(0, 2).map((service) => serviceReason(service.service_key));
      for (const facilityKey of relevantFacilities.slice(0, 1)) {
        if (FACILITY_REASONS[facilityKey]) reasons.push(FACILITY_REASONS[facilityKey]);
      }
      if (eligibility.pcs === 'verified') score += 2;
      else if (eligibility.pcs === 'claimed') score += 1;
      if (Number.isFinite(distance_km)) score += Math.max(0, 3 - Math.min(distance_km / 10, 3));
      if (availabilityLabel) {
        score += 1;
        reasons.push('Mod de primire publicat de furnizor');
      }
      if (directoryMatchType) reasons.push(directoryMatchType);

      const entry = {
        loc,
        matched,
        tier,
        score,
        reasons,
        availabilityLabel,
        safeLocRows,
        safeMatchedRows,
        eligibility,
        bucket,
        directoryMatchType,
        distance_km,
        service_radius_km: radius,
      };
      entry.routing_reason = routingReason(entry);
      if (bucket === 'excluded') excludedList.push(entry);
      else scored.push(entry);
    }

    scored.sort((a, b) => {
      if (Number.isFinite(a.distance_km) && Number.isFinite(b.distance_km)) {
        return a.distance_km - b.distance_km || b.score - a.score;
      }
      return b.score - a.score;
    });

    const eligibleSorted = scored.filter((entry) => entry.bucket === 'eligible');
    const directorySorted = scored.filter((entry) => entry.bucket === 'extended_directory');
    eligibleSorted.forEach((entry, index) => {
      entry.finalBucket = index < 3 ? 'top3' : 'extended_confirmed';
      entry.bucketRank = index < 3 ? index + 1 : index - 2;
    });
    directorySorted.forEach((entry, index) => {
      entry.finalBucket = 'extended_directory';
      entry.bucketRank = index + 1;
    });

    const finalVisible = [...eligibleSorted, ...directorySorted].slice(0, limit);
    const results = finalVisible.map((entry) => ({
      id: entry.loc.id,
      name: entry.loc.name,
      provider_type: entry.loc.provider_type,
      city: entry.loc.city,
      county: entry.loc.county || null,
      address: entry.loc.address || null,
      phone: entry.loc.phone_public || entry.loc.public_phone || null,
      website: entry.loc.website || entry.loc.website_url || null,
      opening_hours: entry.loc.opening_hours || null,
      saturday_hours: entry.loc.saturday_hours || null,
      profile_control_status: entry.eligibility.pcs,
      public_services: entry.safeLocRows.map(toPublicService).filter(Boolean),
      matched_public_services: entry.safeMatchedRows.map(toPublicService).filter(Boolean),
      availability_label: entry.availabilityLabel,
      match_reasons: entry.reasons,
      directory_match_type: entry.directoryMatchType || null,
      expansion_tier: entry.tier,
      result_bucket: entry.finalBucket,
      bucket_rank: entry.bucketRank,
      is_top3_eligible: entry.bucket === 'eligible',
      distance_km: Number.isFinite(entry.distance_km) ? Math.round(entry.distance_km * 10) / 10 : null,
      service_radius_km: Math.round(entry.service_radius_km),
      routing_reason: entry.routing_reason,
    }));

    const body = {
      results,
      need_level: needLevel,
      safety_message_keys: SAFETY_RULES.filter((rule) => rule.enabled).map((rule) => rule.key),
      client_location_source: clientLocationSource || null,
      client_address_text: clientAddressText || null,
      routing_mode: hasClientCoords ? 'perimeter' : (scope === 'national' ? 'national' : 'locality'),
      service_key_statuses: requestKeys.statuses,
    };
    if (scope !== 'national' && !hasClientCoords && (sirutaCode || city) && results.length === 0) {
      body.coverage_status = 'no_local_results';
      body.selected_locality_siruta_code = sirutaCode || null;
      body.can_expand_to_county = true;
      body.can_expand_nationally = true;
    }
    if (hasClientCoords && results.length === 0) {
      body.coverage_status = 'no_perimeter_results';
      body.can_expand_to_county = false;
      body.can_expand_nationally = true;
    }

    return Response.json(body);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
