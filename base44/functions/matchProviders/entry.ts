import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Safety rule registry — architecture in place, DISABLED by default.
// Wording and trigger rules must be reviewed by a qualified ophthalmologist before enabling.
const SAFETY_RULES = [
  { key: 'urgent_care_notice', enabled: false },
  { key: 'no_diagnosis_notice', enabled: false },
  { key: 'repair_no_guarantee', enabled: false },
  { key: 'child_under_3', enabled: false },
];

// Availability/access mode labels. These are not real-time promises.
const AVAILABILITY_LABELS = {
  astazi: 'Primeste clienti fara programare',
  urmatoarele_zile: 'Primeste clienti si cu programare',
  saptamana_aceasta: 'Walk-in pentru optica, programare pentru consultatii',
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
  eyeglasses: 'ochelari de vedere',
  frames: 'rame de ochelari',
  prescription_lenses: 'lentile pentru ochelari',
  contact_lenses: 'lentile de contact',
  optometry_consultation: 'consult optometric',
  ophthalmology_consultation: 'consult oftalmologic',
  eyeglasses_adjustment: 'reglaj rame',
  eyeglasses_repair: 'reparatii ochelari',
  lens_fitting: 'montaj lentile',
};

const FACILITY_REASONS = {
  laborator_optic_propriu: 'Are laborator optic propriu',
  atelier_service_propriu: 'Are atelier de service propriu',
  reparatii_pe_loc: 'Face reparatii pe loc',
  laborator_partener: 'Lucreaza cu laborator partener',
  montaj_lentile_in_locatie: 'Monteaza lentile in locatie',
};

const PATIENT_FACING_PROFILE_TYPES = [
  'independent_optical_store', 'optical_chain', 'ophthalmology_clinic', 'ophthalmology_office',
];

const ROLE_CANONICAL = { medic_oftalmolog: 'ophthalmologist', ophthalmologist: 'ophthalmologist', optometrist: 'optometrist', optician: 'optician' };

const OPHTHALMO_TYPES = ['clinica_oftalmologica', 'cabinet_oftalmologic'];
const OPTICAL_TYPES = ['optica_medicala', 'laborator_optic', 'cabinet_optometric'];
const REPAIR_FACILITIES = ['atelier_service_propriu', 'reparatii_pe_loc', 'laborator_optic_propriu', 'laborator_partener', 'montaj_lentile_in_locatie'];
const FACILITY_INTENTS = ['reparatii_ochelari', 'ochelari_lentile', 'lentile_contact'];

const GENERAL_SERVICE_KEYS = [
  'eyeglasses', 'frames', 'prescription_lenses', 'sunglasses', 'prescription_sunglasses', 'children_frames',
  'sports_glasses', 'safety_glasses', 'accessories', 'single_vision_lenses', 'progressive_lenses', 'office_lenses',
  'reading_lenses', 'thin_lenses', 'photochromic_lenses', 'polarized_lenses', 'blue_light_lenses', 'prism_lenses',
  'pd_measurement', 'digital_centering', 'optometry_consultation', 'visual_acuity_test', 'refraction',
  'autorefractometry', 'binocular_vision', 'dry_eye_screening', 'color_vision_test', 'occupational_vision',
  'contact_lenses', 'contact_lens_consultation', 'contact_lens_fitting', 'contact_lens_trial',
  'toric_contact_lenses', 'multifocal_contact_lenses', 'rgp_lenses', 'scleral_lenses', 'contact_lens_followup',
  // Legacy request/service keys.
  'control_vedere_adulti', 'eye_exam', 'lentile_contact', 'lentile_progresive',
];
const TECHNICAL_SERVICE_KEYS = [
  'eyeglasses_adjustment', 'eyeglasses_repair', 'lens_fitting', 'frame_repair', 'screw_replacement',
  'lens_replacement', 'frame_cleaning', 'workshop_orders',
  // Legacy request/service keys.
  'reparatii_ochelari', 'reglaj_rame', 'montaj_lentile',
];
const SPECIALIZED_MEDICAL_SERVICE_KEYS = [
  // Canonical ophthalmology consultations.
  'ophthalmology_consultation', 'complete_eye_exam', 'prescription_check', 'eye_pressure_check', 'fundus_exam',
  'anterior_segment_exam', 'followup_consultation', 'second_opinion',
  // Canonical investigations.
  'oct', 'visual_field_analyzer', 'fundus_camera', 'pachymeter', 'biometer', 'corneal_topography', 'keratometry',
  'tonometry', 'gonioscopy', 'ultrasound', 'specular_microscopy', 'angiography',
  // Canonical specialties.
  'retina_consultation', 'glaucoma_consultation', 'cataract_consultation', 'cornea_consultation',
  'pediatric_ophthalmology', 'strabismus', 'neuro_ophthalmology', 'uveitis', 'myopia_management',
  'dry_eye_management', 'diabetic_retinopathy', 'macular_degeneration', 'emergency_ophthalmology',
  // Canonical procedures and surgery.
  'cataract_surgery', 'refractive_surgery', 'laser_procedures', 'yag_laser', 'retinal_laser',
  'intravitreal_injections', 'eyelid_surgery', 'chalazion_treatment', 'minor_eye_procedures',
  // Canonical services for children and prevention.
  'children_eye_exam', 'pediatric_refraction', 'amblyopia_screening', 'strabismus_screening', 'school_screening',
  'myopia_control_children', 'vision_therapy',
  // Legacy request/service keys.
  'control_vedere_copii', 'children', 'consult_oftalmologic', 'ophthalmology', 'camp_vizual', 'tonometrie',
  'fund_de_ochi', 'topografie_corneana', 'ochi_uscat', 'dry_eye', 'managementul_miopiei',
  'retina', 'glaucom', 'cataracta', 'chirurgie_refractiva',
];
const SERVICE_NEED_LEVELS = Object.fromEntries([
  ...GENERAL_SERVICE_KEYS.map((key) => [key, 'general']),
  ...TECHNICAL_SERVICE_KEYS.map((key) => [key, 'technical']),
  ...SPECIALIZED_MEDICAL_SERVICE_KEYS.map((key) => [key, 'specialized_medical']),
]);
const NEED_ORDER = { general: 0, technical: 1, specialized_medical: 2 };

const SERVICE_ALIAS_GROUPS = [
  ['contact_lenses', 'lentile_contact'],
  ['eye_exam', 'control_vedere_adulti', 'optometry_consultation'],
  ['children', 'control_vedere_copii', 'children_eye_exam'],
  ['ophthalmology', 'consult_oftalmologic', 'ophthalmology_consultation'],
  ['dry_eye', 'ochi_uscat', 'dry_eye_management'],
  ['myopia_management', 'managementul_miopiei'],
  ['prescription_lenses', 'lentile_progresive'],
  ['eyeglasses_adjustment', 'reglaj_rame'],
  ['eyeglasses_repair', 'reparatii_ochelari'],
  ['lens_fitting', 'montaj_lentile'],
  ['camp_vizual', 'visual_field_analyzer'],
  ['tonometrie', 'tonometry'],
  ['fund_de_ochi', 'fundus_exam'],
  ['topografie_corneana', 'corneal_topography'],
];
const SERVICE_ALIASES = {};
for (const group of SERVICE_ALIAS_GROUPS) {
  for (const key of group) SERVICE_ALIASES[key] = group.filter((alias) => alias !== key);
}
const DIRECTORY_OK_CONF = ['publicly_listed', 'provider_confirmed', 'vezunde_verified'];

function needLevelOf(key) {
  return SERVICE_NEED_LEVELS[key] || 'unknown';
}

function serviceNeedLevelOfRow(service) {
  const canonicalLevel = needLevelOf(service.service_key);
  if (canonicalLevel === 'unknown') return 'unknown';
  if (service.is_advanced_service || service.service_need_level === 'specialized_medical') return 'specialized_medical';
  if (service.service_need_level === 'technical' && canonicalLevel === 'general') return 'technical';
  return canonicalLevel;
}

function expandServiceKeys(serviceKeys) {
  return [...new Set(serviceKeys.flatMap((key) => [key, ...(SERVICE_ALIASES[key] || [])]))];
}

function isPublicSafeService(s, pcs) {
  if (s.is_active === false) return false;
  if (s.migration_review_required) return false;
  if (!DIRECTORY_OK_CONF.includes(s.confirmation_level)) return false;
  const level = serviceNeedLevelOfRow(s);
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
    // Unknown request keys are treated as medical until explicitly classified.
    if (l === 'unknown') return 'specialized_medical';
    if (NEED_ORDER[l] > NEED_ORDER[level]) level = l;
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
    const qualifying = matchedRows.filter((s) => {
      if (s.matching_allowed !== true || s.migration_review_required) return false;
      const rowLevel = serviceNeedLevelOfRow(s);
      if (rowLevel === 'unknown') return false;
      if (rowLevel === 'specialized_medical') return pcs === 'verified' && s.confirmation_level === 'vezunde_verified';
      return ['provider_confirmed', 'vezunde_verified'].includes(s.confirmation_level);
    });
    if (qualifying.length === 0) {
      if (!matchedRows.some((s) => s.matching_allowed === true)) reasons.push('matching_not_allowed');
      reasons.push(needLevel === 'specialized_medical' ? 'service_not_vezunde_verified' : 'service_not_confirmed');
    }
    if (reasons.length === 0) return { eligible: true, reasons: [], pcs, qualifying };
  }
  return { eligible: false, reasons, pcs, qualifying: [] };
}

function classifyMatchBucket(elig, matchedRows, needLevel) {
  if (elig.eligible) return 'eligible';
  if (needLevel === 'specialized_medical' || elig.pcs === 'suspended') return 'excluded';
  if (matchedRows.length === 0) return 'excluded';

  // Advanced and unclassified services must never fall back to directory results.
  const directorySafeRows = matchedRows.filter((service) => {
    const rowLevel = serviceNeedLevelOfRow(service);
    return rowLevel === 'general' || rowLevel === 'technical';
  });
  if (directorySafeRows.length === 0) return 'excluded';

  const directoryQualifies = needLevel === 'general' && directorySafeRows.some((service) => (
    service.matching_allowed === true
    && DIRECTORY_OK_CONF.includes(service.confirmation_level)
    && !service.migration_review_required
  ));
  if (elig.pcs === 'directory' && !directoryQualifies) return 'excluded';
  return 'extended_directory';
}

function hasCoordinates(value) {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function distanceKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
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
  if (Number.isFinite(Number(loc.service_radius_km)) && Number(loc.service_radius_km) > 0) return Number(loc.service_radius_km);
  const profileType = loc.provider_profile_type || '';
  if (profileType === 'ophthalmology_clinic') return 50;
  if (profileType === 'ophthalmology_office') return 35;
  if (profileType === 'independent_optical_store' || profileType === 'optical_chain') return 15;
  if (loc.provider_type === 'clinica_oftalmologica') return 50;
  if (loc.provider_type === 'cabinet_oftalmologic') return 35;
  return 20;
}

function serviceReason(key) {
  if (key === 'control_vedere_copii') return 'Potrivit pentru control vedere copii';
  if (key === 'consult_oftalmologic') return 'Are consult oftalmologic';
  return `Ofera ${SERVICE_LABELS[key] || key}`;
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
    const serviceKeys = Array.isArray(payload.service_keys) ? payload.service_keys : [];
    const providerTypes = Array.isArray(payload.provider_types) ? payload.provider_types : [];
    const requiredRoles = Array.isArray(payload.required_professional_types)
      ? payload.required_professional_types.map((r) => ROLE_CANONICAL[r] || r)
      : [];
    const sirutaCode = String(payload.locality_siruta_code || '').trim();
    const city = (payload.city || '').trim();
    const clientLocation = {
      lat: Number(payload.client_lat),
      lng: Number(payload.client_lng),
    };
    const hasClientCoords = hasCoordinates(clientLocation);
    const clientLocationSource = hasClientCoords ? (payload.client_location_source || 'browser') : '';
    const clientAddressText = String(payload.client_address_text || '').trim();
    const scope = payload.scope || (hasClientCoords ? 'nearby' : ((sirutaCode || city) ? 'city' : 'national'));
    const limit = Math.min(payload.limit || 20, 50);
    const needLevel = requestNeedLevel(serviceKeys, intent);
    const expandedServiceKeys = expandServiceKeys(serviceKeys);

    const [locations, services, specs, assigns, facilities] = await Promise.all([
      svc.entities.ProviderLocation.filter({ status: 'publicata' }, null, 500),
      svc.entities.LocationService.list(null, 2000),
      svc.entities.LocationSpecialization.list(null, 2000),
      svc.entities.ProfessionalLocationAssignment.filter({ active_status: 'activ' }, null, 2000),
      svc.entities.LocationFacility.list(null, 2000),
    ]);

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
      roleMap[a.location_id].push(ROLE_CANONICAL[a.professional_type] || a.professional_type);
    }
    const facMap = {};
    for (const f of facilities) {
      if (f.is_active === false) continue;
      if (!facMap[f.location_id]) facMap[f.location_id] = [];
      facMap[f.location_id].push(f.facility_key);
    }

    const now = Date.now();
    const scored = [];
    const excludedList = [];

    for (const loc of locations) {
      if (loc.active_status === 'inactiva') continue;
      if (!loc.provider_profile_type || !PATIENT_FACING_PROFILE_TYPES.includes(loc.provider_profile_type)) continue;
      if (providerTypes.length > 0 && !providerTypes.includes(loc.provider_type)) continue;

      const locRows = svcRowMap[loc.id] || [];
      const roles = roleMap[loc.id] || [];
      const locFacilities = facMap[loc.id] || [];
      const matchedRows = serviceKeys.length > 0 ? locRows.filter((r) => expandedServiceKeys.includes(r.service_key)) : locRows;
      const matched = serviceKeys.length > 0 ? matchedRows.map((r) => r.service_key) : [];

      if (intent === 'simptome_oftalmologice' || intent === 'investigatii') {
        if (!OPHTHALMO_TYPES.includes(loc.provider_type) && !roles.includes('ophthalmologist')) continue;
      }
      if (intent === 'reparatii_ochelari') {
        if (!OPTICAL_TYPES.includes(loc.provider_type)) continue;
        const hasRepairFacility = locFacilities.some((k) => REPAIR_FACILITIES.includes(k));
        if (matched.length === 0 && !hasRepairFacility) continue;
      } else if (serviceKeys.length > 0 && matched.length === 0) {
        continue;
      }
      if (requiredRoles.length > 0 && !requiredRoles.some((r) => roles.includes(r))) continue;

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

      const locSpecs = specMap[loc.id] || [];
      const specMatched = locSpecs.filter((k) => serviceKeys.includes(k));
      const relevantFacilities = FACILITY_INTENTS.includes(intent) ? locFacilities.filter((k) => REPAIR_FACILITIES.includes(k)) : [];

      let availabilityLabel = null;
      if (loc.availability_status && loc.availability_status !== 'necunoscuta' && loc.availability_updated_at) {
        const ageDays = (now - new Date(loc.availability_updated_at).getTime()) / 86400000;
        if (ageDays >= 0 && ageDays <= AVAILABILITY_STALE_DAYS) availabilityLabel = AVAILABILITY_LABELS[loc.availability_status] || null;
      }

      const elig = evaluateEligibility(loc, matchedRows, needLevel);
      let bucket;
      let directoryMatchType = null;
      bucket = classifyMatchBucket(elig, matchedRows, needLevel);
      if (bucket === 'extended_directory' && serviceKeys.length > 0) directoryMatchType = 'service_alias_match';

      const pcsForDisplay = loc.profile_control_status || 'directory';
      const safeMatchedRows = matchedRows.filter((s) => isPublicSafeService(s, pcsForDisplay));
      const safeLocRows = locRows.filter((s) => isPublicSafeService(s, pcsForDisplay));
      let score = matched.length * 3 + specMatched.length * 2 + Math.min(relevantFacilities.length, 2);
      const reasons = safeMatchedRows.slice(0, 2).map((s) => serviceReason(s.service_key));
      if (elig.pcs === 'verified') score += 2;
      else if (elig.pcs === 'claimed') score += 1;
      if (Number.isFinite(distance_km)) score += Math.max(0, 3 - Math.min(distance_km / 10, 3));
      if (availabilityLabel) { score += 1; reasons.push('Mod de primire publicat de furnizor'); }
      if (directoryMatchType) reasons.push(directoryMatchType);

      const entry = { loc, matched, matchedRows, tier, score, reasons, availabilityLabel, safeLocRows, safeMatchedRows, locSpecs, roles, locFacilities, relevantFacilities, elig, bucket, directoryMatchType, distance_km, service_radius_km: radius };
      entry.routing_reason = routingReason(entry);
      if (bucket === 'excluded') excludedList.push(entry);
      else scored.push(entry);
    }

    scored.sort((a, b) => {
      if (Number.isFinite(a.distance_km) && Number.isFinite(b.distance_km)) return a.distance_km - b.distance_km || b.score - a.score;
      return b.score - a.score;
    });
    const visible = scored;

    const eligibleSorted = visible.filter((r) => r.bucket === 'eligible');
    const directorySorted = visible.filter((r) => r.bucket === 'extended_directory');
    eligibleSorted.forEach((r, i) => {
      r.finalBucket = i < 3 ? 'top3' : 'extended_confirmed';
      r.bucketRank = i < 3 ? i + 1 : i - 2;
    });
    directorySorted.forEach((r, i) => { r.finalBucket = 'extended_directory'; r.bucketRank = i + 1; });
    const finalVisible = [...eligibleSorted, ...directorySorted].slice(0, limit);

    const results = finalVisible.map((r) => ({
      id: r.loc.id,
      name: r.loc.name,
      provider_type: r.loc.provider_type,
      city: r.loc.city,
      county: r.loc.county || null,
      address: r.loc.address || null,
      phone: r.loc.phone_public || r.loc.public_phone || null,
      website: r.loc.website || r.loc.website_url || null,
      opening_hours: r.loc.opening_hours || null,
      saturday_hours: r.loc.saturday_hours || null,
      profile_control_status: r.elig.pcs,
      public_services: r.safeLocRows.map(toPublicService),
      matched_public_services: r.safeMatchedRows.map(toPublicService),
      availability_label: r.availabilityLabel,
      match_reasons: r.reasons,
      directory_match_type: r.directoryMatchType || null,
      expansion_tier: r.tier,
      result_bucket: r.finalBucket,
      bucket_rank: r.bucketRank,
      is_top3_eligible: r.bucket === 'eligible',
      distance_km: Number.isFinite(r.distance_km) ? Math.round(r.distance_km * 10) / 10 : null,
      service_radius_km: Math.round(r.service_radius_km),
      routing_reason: r.routing_reason,
    }));

    const safetyKeys = SAFETY_RULES.filter((rule) => rule.enabled).map((rule) => rule.key);
    const body = {
      results,
      need_level: needLevel,
      safety_message_keys: safetyKeys,
      client_location_source: clientLocationSource || null,
      client_address_text: clientAddressText || null,
      routing_mode: hasClientCoords ? 'perimeter' : (scope === 'national' ? 'national' : 'locality'),
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
