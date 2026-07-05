import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Safety rule registry — architecture in place, DISABLED by default.
// Wording and trigger rules must be reviewed by a qualified ophthalmologist before enabling.
const SAFETY_RULES = [
  { key: 'urgent_care_notice', enabled: false },
  { key: 'no_diagnosis_notice', enabled: false },
  { key: 'repair_no_guarantee', enabled: false },
  { key: 'child_under_3', enabled: false },
];

// Availability is shown/ranked ONLY when explicitly published by the provider and not stale.
const AVAILABILITY_LABELS = {
  astazi: 'Disponibil astazi',
  urmatoarele_zile: 'Disponibil in urmatoarele zile',
  saptamana_aceasta: 'Disponibil saptamana aceasta',
  doar_programare: 'Doar cu programare',
};
const AVAILABILITY_STALE_DAYS = 30;

const SERVICE_LABELS = {
  control_vedere_adulti: 'control vedere adulti',
  control_vedere_copii: 'control vedere copii',
  consult_oftalmologic: 'consult oftalmologic',
  managementul_miopiei: 'managementul miopiei',
  ochi_uscat: 'servicii pentru ochi uscat',
  lentile_contact: 'lentile de contact',
  lentile_progresive: 'lentile progresive',
  reparatii_ochelari: 'reparatii ochelari',
  reglaj_rame: 'reglaj rame',
  montaj_lentile: 'montaj lentile',
  glaucom: 'servicii pentru glaucom',
  cataracta: 'servicii pentru cataracta',
  retina: 'servicii pentru retina',
  chirurgie_refractiva: 'chirurgie refractiva',
  oct: 'OCT',
  camp_vizual: 'camp vizual',
  tonometrie: 'tonometrie',
  fund_de_ochi: 'fund de ochi',
  topografie_corneana: 'topografie corneana',
};

const FACILITY_REASONS = {
  laborator_optic_propriu: 'Are laborator optic propriu',
  atelier_service_propriu: 'Are atelier de service propriu',
  reparatii_pe_loc: 'Face reparatii pe loc',
  laborator_partener: 'Lucreaza cu laborator partener',
  montaj_lentile_in_locatie: 'Monteaza lentile in locatie',
};

// Module 3H.1A: B2B profile classifications never enter patient discovery/matching.
const B2B_PROFILE_TYPES = ['optical_laboratory_b2b', 'future_b2b_distributor'];

const OPHTHALMO_TYPES = ['clinica_oftalmologica', 'cabinet_oftalmologic'];
const OPTICAL_TYPES = ['optica_medicala', 'laborator_optic', 'cabinet_optometric'];
const REPAIR_FACILITIES = ['atelier_service_propriu', 'reparatii_pe_loc', 'laborator_optic_propriu', 'laborator_partener', 'montaj_lentile_in_locatie'];
const FACILITY_INTENTS = ['reparatii_ochelari', 'ochelari_lentile', 'lentile_contact'];

// ===== Module 3A: central service catalog + Top-3 trust eligibility =====
// Single source of truth used by matching. Never based on: company size, paid
// status, chain status, price, Google data, fake availability, or the legacy
// is_verified / verification_state fields.
const SERVICE_NEED_LEVELS = {
  // general
  eyeglasses: 'general', frames: 'general', prescription_lenses: 'general', contact_lenses: 'general',
  optometry_consultation: 'general', ophthalmology_consultation: 'general',
  control_vedere_adulti: 'general', control_vedere_copii: 'general', consult_oftalmologic: 'general',
  lentile_contact: 'general', lentile_progresive: 'general',
  // technical
  eyeglasses_adjustment: 'technical', eyeglasses_repair: 'technical', lens_fitting: 'technical',
  reparatii_ochelari: 'technical', reglaj_rame: 'technical', montaj_lentile: 'technical',
  // specialized_medical
  oct: 'specialized_medical', retina_consultation: 'specialized_medical', glaucoma_consultation: 'specialized_medical',
  cataract_surgery: 'specialized_medical', refractive_surgery: 'specialized_medical',
  pediatric_ophthalmology: 'specialized_medical', myopia_management: 'specialized_medical', emergency_ophthalmology: 'specialized_medical',
  retina: 'specialized_medical', glaucom: 'specialized_medical', cataracta: 'specialized_medical',
  chirurgie_refractiva: 'specialized_medical', managementul_miopiei: 'specialized_medical',
};
const NEED_ORDER = { general: 0, technical: 1, specialized_medical: 2 };

// ===== Module 3B: read-only canonical service alias layer =====
// Used ONLY during matching. Never changes stored service_key values and never
// upgrades confirmation_level, matching_allowed, profile status or Top 3 rules.
// Only safe, unambiguous, non-specialized pairs. Bidirectional.
const SERVICE_ALIAS_PAIRS = [
  ['contact_lenses', 'lentile_contact'],
  ['ophthalmology_consultation', 'consult_oftalmologic'],
  ['prescription_lenses', 'lentile_progresive'],
  ['eyeglasses_adjustment', 'reglaj_rame'],
  ['eyeglasses_repair', 'reparatii_ochelari'],
];
const SERVICE_ALIASES = {};
for (const [a, b] of SERVICE_ALIAS_PAIRS) { SERVICE_ALIASES[a] = b; SERVICE_ALIASES[b] = a; }

// Module 3B fix: provider-type discovery fallback REMOVED. A directory profile
// may appear in extended_directory only with an explicit matching LocationService
// that is publicly_listed/provider_confirmed/vezunde_verified AND matching_allowed,
// and only for general-need requests.
const DIRECTORY_OK_CONF = ['publicly_listed', 'provider_confirmed', 'vezunde_verified'];
const CONF_ORDER = { not_confirmed: 0, publicly_listed: 1, provider_confirmed: 2, vezunde_verified: 3 };

function needLevelOf(key) {
  // Module 3E: unknown/uncategorized service keys are 'unknown' — never eligible for
  // specialized or confirmed matching; they require manual classification/review.
  return SERVICE_NEED_LEVELS[key] || 'unknown';
}

// Module 3E.1: shared public-safe service visibility rule (mirrored in
// getPublicProviderProfile — backend functions cannot share local imports).
// Only these services may ever surface publicly; raw LocationService rows,
// confirmation levels and trust metadata never leave this function.
function isPublicSafeService(s, pcs) {
  if (s.is_active === false) return false;
  if (s.migration_review_required) return false;
  if (!DIRECTORY_OK_CONF.includes(s.confirmation_level)) return false;
  const level = (s.is_advanced_service || s.service_need_level === 'specialized_medical')
    ? 'specialized_medical'
    : needLevelOf(s.service_key);
  if (level === 'specialized_medical' || level === 'unknown') {
    return s.confirmation_level === 'vezunde_verified' && pcs === 'verified';
  }
  return true;
}

function toPublicService(s) {
  return { key: s.service_key, label: SERVICE_LABELS[s.service_key] || s.service_key };
}

function requestNeedLevel(serviceKeys, intent) {
  let level = intent === 'reparatii_ochelari' ? 'technical' : 'general';
  for (const k of serviceKeys) {
    const l = needLevelOf(k);
    if (l === 'unknown') continue; // unknown keys never influence the need level
    if (NEED_ORDER[l] > NEED_ORDER[level]) level = l;
  }
  return level;
}

// Central Top-3 eligibility function (Module 3A rules A/B/C).
function evaluateEligibility(loc, matchedRows, needLevel, hasServiceFilter) {
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
    const okConf = needLevel === 'specialized_medical' ? ['vezunde_verified'] : ['provider_confirmed', 'vezunde_verified'];
    const qualifying = matchedRows.filter((s) => s.matching_allowed === true && okConf.includes(s.confirmation_level) && !s.migration_review_required && needLevelOf(s.service_key) !== 'unknown');
    if (qualifying.length === 0) {
      if (!matchedRows.some((s) => s.matching_allowed === true)) reasons.push('matching_not_allowed');
      reasons.push(needLevel === 'specialized_medical' ? 'service_not_vezunde_verified' : 'service_not_confirmed');
    }
    if (reasons.length === 0) return { eligible: true, reasons: [], pcs, qualifying };
  }
  return { eligible: false, reasons, pcs, qualifying: [] };
}

// Module 3F.2.1: haversine/radius/coordinate matching REMOVED. lat/lng/place_id
// remain on ProviderLocation only for protected onboarding compatibility and
// never influence public matching, ranking or search.

function serviceReason(key) {
  if (key === 'control_vedere_copii') return 'Potrivit pentru control vedere copii';
  if (key === 'consult_oftalmologic') return 'Are consult oftalmologic';
  return `Ofera ${SERVICE_LABELS[key] || key}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));

    const intent = payload.intent || null;
    const serviceKeys = Array.isArray(payload.service_keys) ? payload.service_keys : [];
    const providerTypes = Array.isArray(payload.provider_types) ? payload.provider_types : [];
    const requiredRoles = Array.isArray(payload.required_professional_types) ? payload.required_professional_types : [];
    // Module 3F.2.1: locality_siruta_code is the PRIMARY geographic matching key
    // (canonical GeographicLocality). city is kept ONLY as a temporary compatibility
    // fallback for old requests that genuinely lack a siruta code, and as a display mirror.
    const sirutaCode = String(payload.locality_siruta_code || '').trim();
    const city = (payload.city || '').trim();
    const scope = payload.scope || ((sirutaCode || city) ? 'city' : 'national');
    const limit = Math.min(payload.limit || 20, 50);
    const needLevel = requestNeedLevel(serviceKeys, intent);
    // Module 3B: alias expansion is read-only and NEVER applied to specialized medical requests.
    const expandedServiceKeys = needLevel === 'specialized_medical'
      ? serviceKeys
      : [...new Set(serviceKeys.flatMap((k) => (SERVICE_ALIASES[k] ? [k, SERVICE_ALIASES[k]] : [k])))];

    const [locations, services, specs, assigns, facilities] = await Promise.all([
      svc.entities.ProviderLocation.filter({ status: 'publicata' }, null, 500),
      svc.entities.LocationService.list(null, 2000),
      svc.entities.LocationSpecialization.list(null, 2000),
      svc.entities.ProfessionalLocationAssignment.filter({ active_status: 'activ' }, null, 2000),
      svc.entities.LocationFacility.list(null, 2000),
    ]);

    // Full LocationService rows per location — trust fields are needed for eligibility.
    const svcRowMap = {};
    for (const s of services) {
      if (s.is_active === false) continue;
      if (!svcRowMap[s.location_id]) svcRowMap[s.location_id] = [];
      svcRowMap[s.location_id].push(s);
    }
    const specMap = {};
    for (const s of specs) {
      if (s.is_active === false) continue;
      if (!specMap[s.location_id]) specMap[s.location_id] = [];
      specMap[s.location_id].push(s.specialization_key);
    }
    const roleMap = {};
    for (const a of assigns) {
      if (!roleMap[a.location_id]) roleMap[a.location_id] = [];
      roleMap[a.location_id].push(a.professional_type);
    }
    const facMap = {};
    for (const f of facilities) {
      if (f.is_active === false) continue;
      if (!facMap[f.location_id]) facMap[f.location_id] = [];
      facMap[f.location_id].push(f.facility_key);
    }

    const now = Date.now();

    // Ranking uses ONLY: service/specialization/facility match, provider type,
    // professional roles, geographic tier, profile trust status, and
    // provider-published fresh availability.
    const scored = [];
    const excludedList = [];
    for (const loc of locations) {
      if (loc.active_status === 'inactiva') continue;
      // Module 3H.1A: B2B laboratories/distributors are hard-excluded from patient matching.
      if (B2B_PROFILE_TYPES.includes(loc.provider_profile_type)) continue;
      if (providerTypes.length > 0 && !providerTypes.includes(loc.provider_type)) continue;

      const locRows = svcRowMap[loc.id] || [];
      const roles = roleMap[loc.id] || [];
      const locFacilities = facMap[loc.id] || [];
      const matchedRows = serviceKeys.length > 0 ? locRows.filter((r) => expandedServiceKeys.includes(r.service_key)) : locRows;
      const matched = serviceKeys.length > 0 ? matchedRows.map((r) => r.service_key) : [];

      // Intent-based hard constraints
      if (intent === 'simptome_oftalmologice' || intent === 'investigatii') {
        if (!OPHTHALMO_TYPES.includes(loc.provider_type) && !roles.includes('medic_oftalmolog')) continue;
      }
      if (intent === 'reparatii_ochelari') {
        if (!OPTICAL_TYPES.includes(loc.provider_type)) continue;
        const hasRepairFacility = locFacilities.some((k) => REPAIR_FACILITIES.includes(k));
        if (matched.length === 0 && !hasRepairFacility) continue;
      } else if (serviceKeys.length > 0 && matched.length === 0) {
        continue;
      }

      if (requiredRoles.length > 0 && !requiredRoles.some((r) => roles.includes(r))) continue;

      // Module 3F.2.1: STRICT canonical geographic scope. No automatic county,
      // national, nearby or coordinate-based expansion. Future expansion requires
      // explicit patient approval via a separate request parameter.
      let tier = 'national';
      if (scope !== 'national') {
        if (sirutaCode) {
          // Primary key: exact canonical locality (SIRUTA). city/county are never geographic truth.
          if ((loc.locality_siruta_code || '') !== sirutaCode) continue;
        } else if (city) {
          // TEMPORARY compatibility fallback ONLY for old requests without a siruta code.
          if (loc.city !== city) continue;
        }
        tier = 'oras';
      }

      const locSpecs = specMap[loc.id] || [];
      const specMatched = locSpecs.filter((k) => serviceKeys.includes(k));
      const relevantFacilities = FACILITY_INTENTS.includes(intent)
        ? locFacilities.filter((k) => REPAIR_FACILITIES.includes(k))
        : [];

      let availabilityLabel = null;
      if (loc.availability_status && loc.availability_status !== 'necunoscuta' && loc.availability_updated_at) {
        const ageDays = (now - new Date(loc.availability_updated_at).getTime()) / 86400000;
        if (ageDays >= 0 && ageDays <= AVAILABILITY_STALE_DAYS) {
          availabilityLabel = AVAILABILITY_LABELS[loc.availability_status] || null;
        }
      }

      // Module 3A trust evaluation (central eligibility function).
      const elig = evaluateEligibility(loc, matchedRows, needLevel, serviceKeys.length > 0);
      let bucket;
      let directoryMatchType = null;
      if (elig.eligible) bucket = 'eligible';
      else if (needLevel === 'specialized_medical') bucket = 'excluded';
      else if (elig.pcs === 'suspended') bucket = 'excluded';
      else if (matchedRows.length > 0) {
        // Directory profiles require an explicit, confirmed, matching-allowed service
        // and a general-need request; claimed/verified profiles keep Module 3A behavior.
        const directoryQualifies = needLevel === 'general' && matchedRows.some(
          (s) => s.matching_allowed === true && DIRECTORY_OK_CONF.includes(s.confirmation_level) && needLevelOf(s.service_key) !== 'unknown'
        );
        if (elig.pcs === 'directory' && !directoryQualifies) {
          bucket = 'excluded';
        } else {
          bucket = 'extended_directory';
          if (serviceKeys.length > 0) directoryMatchType = 'service_alias_match';
        }
      } else {
        bucket = 'excluded';
      }

      // Module 3E.1: public display uses ONLY public-safe services — an unsafe
      // service never surfaces just because it matched internally.
      const pcsForDisplay = loc.profile_control_status || 'directory';
      const safeMatchedRows = matchedRows.filter((s) => isPublicSafeService(s, pcsForDisplay));
      const safeLocRows = locRows.filter((s) => isPublicSafeService(s, pcsForDisplay));
      let score = matched.length * 3 + specMatched.length * 2 + Math.min(relevantFacilities.length, 2);
      // Module 3E.2: match reasons are built ONLY from public-safe services and
      // trust/availability signals — never from unconfirmed specializations,
      // facilities or professional capability data.
      const reasons = safeMatchedRows.slice(0, 2).map((s) => serviceReason(s.service_key));
      if (elig.pcs === 'verified') score += 2;
      else if (elig.pcs === 'claimed') score += 1;
      if (availabilityLabel) { score += 1; reasons.push('Disponibilitate publicata de furnizor'); }
      if (directoryMatchType) reasons.push(directoryMatchType);

      const entry = { loc, matched, matchedRows, tier, score, reasons, availabilityLabel, safeLocRows, safeMatchedRows, locSpecs, roles, locFacilities, relevantFacilities, elig, bucket, directoryMatchType };
      if (bucket === 'excluded') excludedList.push(entry);
      else scored.push(entry);
    }

    // Module 3F.2.1: expansion ladder REMOVED — results are already strictly scoped above.
    scored.sort((a, b) => b.score - a.score);
    const visible = scored;

    // Bucketize: Top 3 = first 3 ELIGIBLE results only (never rank position alone).
    const eligibleSorted = visible.filter((r) => r.bucket === 'eligible');
    const directorySorted = visible.filter((r) => r.bucket === 'extended_directory');
    eligibleSorted.forEach((r, i) => {
      r.finalBucket = i < 3 ? 'top3' : 'extended_confirmed';
      r.bucketRank = i < 3 ? i + 1 : i - 2;
    });
    directorySorted.forEach((r, i) => { r.finalBucket = 'extended_directory'; r.bucketRank = i + 1; });
    const finalVisible = [...eligibleSorted, ...directorySorted].slice(0, limit);

    // Public field whitelist only — never internal/verification/patient data.
    const results = finalVisible.map((r) => ({
      id: r.loc.id,
      name: r.loc.name,
      provider_type: r.loc.provider_type,
      city: r.loc.city,
      county: r.loc.county || null,
      address: r.loc.address || null,
      phone: r.loc.phone_public || null,
      website: r.loc.website || null,
      opening_hours: r.loc.opening_hours || null,
      saturday_hours: r.loc.saturday_hours || null,
      profile_control_status: r.elig.pcs,
      // Module 3E.2: specializations, professional_types and facilities are
      // internal capability data without a confirmation model — never returned.
      public_services: r.safeLocRows.map(toPublicService),
      matched_public_services: r.safeMatchedRows.map(toPublicService),
      availability_label: r.availabilityLabel,
      match_reasons: r.reasons,
      directory_match_type: r.directoryMatchType || null,
      expansion_tier: r.tier,
      result_bucket: r.finalBucket,
      bucket_rank: r.bucketRank,
      is_top3_eligible: r.bucket === 'eligible',
    }));

    const safetyKeys = SAFETY_RULES.filter((rule) => rule.enabled).map((rule) => rule.key);

    // Module 3D.1: matchProviders is fully READ-ONLY. It never persists RequestMatch,
    // SafetyFlag or any other patient-related record. A request_id in the payload is
    // ignored safely (no lookup, no error, no existence disclosure). RequestMatch will
    // be created only by a future protected server-side request-delivery workflow.

    const body = { results, need_level: needLevel, safety_message_keys: safetyKeys };
    // Module 3F.2.1: explicit empty-coverage state — expansion is NEVER executed
    // automatically; it must be requested explicitly by the patient in the future.
    if (scope !== 'national' && (sirutaCode || city) && results.length === 0) {
      body.coverage_status = 'no_local_results';
      body.selected_locality_siruta_code = sirutaCode || null;
      body.can_expand_to_county = true;
      body.can_expand_nationally = true;
    }
    return Response.json(body);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});