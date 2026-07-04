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
const CONF_ORDER = { not_confirmed: 0, publicly_listed: 1, provider_confirmed: 2, vezunde_verified: 3 };

function needLevelOf(key) {
  // Unknown/uncategorized services default to general (and are never matching_allowed by data rules).
  return SERVICE_NEED_LEVELS[key] || 'general';
}

function requestNeedLevel(serviceKeys, intent) {
  let level = intent === 'reparatii_ochelari' ? 'technical' : 'general';
  for (const k of serviceKeys) {
    const l = needLevelOf(k);
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
    const qualifying = matchedRows.filter((s) => s.matching_allowed === true && okConf.includes(s.confirmation_level) && !s.migration_review_required);
    if (qualifying.length === 0) {
      if (!matchedRows.some((s) => s.matching_allowed === true)) reasons.push('matching_not_allowed');
      reasons.push(needLevel === 'specialized_medical' ? 'service_not_vezunde_verified' : 'service_not_confirmed');
    }
    if (reasons.length === 0) return { eligible: true, reasons: [], pcs, qualifying };
  }
  return { eligible: false, reasons, pcs, qualifying: [] };
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
    const city = (payload.city || '').trim();
    const scope = payload.scope || (city ? 'city' : 'national');
    const userLat = typeof payload.lat === 'number' ? payload.lat : null;
    const userLng = typeof payload.lng === 'number' ? payload.lng : null;
    const limit = Math.min(payload.limit || 20, 50);
    const needLevel = requestNeedLevel(serviceKeys, intent);

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

    const cityLoc = city ? locations.find((l) => l.city === city) : null;
    const cityCounty = cityLoc ? cityLoc.county || '' : '';
    const refLat = userLat ?? (cityLoc && typeof cityLoc.lat === 'number' ? cityLoc.lat : null);
    const refLng = userLng ?? (cityLoc && typeof cityLoc.lng === 'number' ? cityLoc.lng : null);
    const now = Date.now();

    // Ranking uses ONLY: service/specialization/facility match, provider type,
    // professional roles, geographic tier, profile trust status, and
    // provider-published fresh availability.
    const scored = [];
    const excludedList = [];
    for (const loc of locations) {
      if (loc.active_status === 'inactiva') continue;
      if (providerTypes.length > 0 && !providerTypes.includes(loc.provider_type)) continue;

      const locRows = svcRowMap[loc.id] || [];
      const locServices = locRows.map((r) => r.service_key);
      const roles = roleMap[loc.id] || [];
      const locFacilities = facMap[loc.id] || [];
      const matchedRows = serviceKeys.length > 0 ? locRows.filter((r) => serviceKeys.includes(r.service_key)) : locRows;
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

      // Geographic expansion tier
      let tier = 'national';
      if (city) {
        if (loc.city === city) tier = 'oras';
        else if (refLat !== null && refLng !== null && typeof loc.lat === 'number' && typeof loc.lng === 'number'
          && haversineKm(refLat, refLng, loc.lat, loc.lng) <= 40) tier = 'apropiere';
        else if (cityCounty && loc.county === cityCounty) tier = 'judet';
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
      if (elig.eligible) bucket = 'eligible';
      else if (needLevel === 'specialized_medical') bucket = 'excluded';
      else if (elig.pcs === 'suspended') bucket = 'excluded';
      else if (matchedRows.length === 0) bucket = 'excluded';
      else bucket = 'extended_directory';

      let score = matched.length * 3 + specMatched.length * 2 + Math.min(relevantFacilities.length, 2);
      const reasons = matched.slice(0, 2).map(serviceReason);
      if (relevantFacilities.length > 0) reasons.push(FACILITY_REASONS[relevantFacilities[0]]);
      if (specMatched.length > 0) reasons.push('Specializare potrivita');
      if (elig.pcs === 'verified') score += 2;
      else if (elig.pcs === 'claimed') score += 1;
      if (availabilityLabel) { score += 1; reasons.push('Disponibilitate publicata de furnizor'); }

      const entry = { loc, matched, matchedRows, tier, score, reasons, availabilityLabel, locServices, locSpecs, roles, locFacilities, relevantFacilities, elig, bucket };
      if (bucket === 'excluded') excludedList.push(entry);
      else scored.push(entry);
    }

    const tierOrder = { oras: 0, apropiere: 1, judet: 2, national: 3 };
    scored.sort((a, b) => (tierOrder[a.tier] - tierOrder[b.tier]) || (b.score - a.score));

    // Expansion ladder: city -> nearby -> county; nationwide only when the user
    // chose national scope or too few local results exist.
    let visible = scored;
    if (city && scope !== 'national') {
      const local = scored.filter((r) => r.tier !== 'national');
      visible = local.length >= 3 ? local : scored;
    }

    // Bucketize: Top 3 = first 3 ELIGIBLE results only (never rank position alone).
    const eligibleSorted = visible.filter((r) => r.bucket === 'eligible');
    const directorySorted = visible.filter((r) => r.bucket === 'extended_directory');
    eligibleSorted.forEach((r, i) => {
      r.finalBucket = i < 3 ? 'top3' : 'extended_confirmed';
      r.bucketRank = i < 3 ? i + 1 : i - 2;
    });
    directorySorted.forEach((r, i) => { r.finalBucket = 'extended_directory'; r.bucketRank = i + 1; });
    const finalVisible = [...eligibleSorted, ...directorySorted].slice(0, limit);

    const confSnapshot = (r) => r.matchedRows.reduce(
      (best, s) => (CONF_ORDER[s.confirmation_level || 'not_confirmed'] > CONF_ORDER[best] ? (s.confirmation_level || 'not_confirmed') : best),
      'not_confirmed'
    );

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
      is_verified: !!r.loc.is_verified,
      profile_control_status: r.elig.pcs,
      services: r.locServices,
      specializations: r.locSpecs,
      professional_types: r.roles,
      facilities: r.locFacilities,
      matched_services: r.matched,
      matched_facilities: r.relevantFacilities,
      availability_label: r.availabilityLabel,
      match_reasons: r.reasons,
      expansion_tier: r.tier,
      result_bucket: r.finalBucket,
      bucket_rank: r.bucketRank,
      is_top3_eligible: r.bucket === 'eligible',
    }));

    const safetyKeys = SAFETY_RULES.filter((rule) => rule.enabled).map((rule) => rule.key);

    // Persist RequestMatch records when a real PatientRequest exists.
    if (payload.request_id) {
      const rows = finalVisible.slice(0, 10).map((r, i) => ({
        request_id: payload.request_id,
        location_id: r.loc.id,
        rank: i + 1,
        match_reasons: r.reasons,
        expansion_tier: r.tier,
        status: 'matched',
        result_bucket: r.finalBucket,
        need_level_snapshot: needLevel,
        profile_control_status_snapshot: r.elig.pcs,
        service_confirmation_level_snapshot: confSnapshot(r),
        is_top3_eligible: r.bucket === 'eligible',
        exclusion_reasons: r.elig.reasons,
        bucket_rank: r.bucketRank,
      }));
      const exRows = excludedList.slice(0, 10).map((r, i) => ({
        request_id: payload.request_id,
        location_id: r.loc.id,
        match_reasons: [],
        expansion_tier: r.tier,
        status: 'matched',
        result_bucket: 'excluded',
        need_level_snapshot: needLevel,
        profile_control_status_snapshot: r.elig.pcs,
        service_confirmation_level_snapshot: confSnapshot(r),
        is_top3_eligible: false,
        exclusion_reasons: r.elig.reasons,
        bucket_rank: i + 1,
      }));
      const allRows = [...rows, ...exRows];
      if (allRows.length > 0) await svc.entities.RequestMatch.bulkCreate(allRows);
      if (safetyKeys.length > 0) {
        await svc.entities.SafetyFlag.bulkCreate(
          safetyKeys.map((k) => ({ request_id: payload.request_id, flag_key: k, rule_version: 'v0-disabled', shown_at: new Date().toISOString() }))
        );
      }
    }

    return Response.json({ results, need_level: needLevel, safety_message_keys: safetyKeys });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});